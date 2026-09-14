/**
 * Son de déverrouillage d'une énigme, calé sur la cinématique de
 * components/cinematics.css (6,5 s).
 *
 * Référence : les fanfares d'objet de Zelda — Breath of the Wild, mais jouées
 * par un orchestre et non par une puce. Le motif est écrit pour ce jeu : on
 * emprunte le genre (l'arpège de harpe, l'élan, la résolution majeure franche),
 * pas les notes de Nintendo.
 *
 * Quatre choix font la différence entre « synthé » et « orchestre », et ce
 * sont eux qui structurent ce fichier :
 *
 *   1. UNE SALLE. Tout passe dans une réverbération à convolution dont la
 *      réponse impulsionnelle est fabriquée ici même (du bruit qui décroît).
 *      C'est de loin ce qui compte le plus : un son sec s'entend comme un
 *      synthé, le même son dans une salle s'entend comme un enregistrement.
 *
 *   2. DES PUPITRES. Chaque note tenue est jouée par deux ou trois voix
 *      légèrement désaccordées et décalées de quelques millisecondes. Un
 *      violon seul et dix violons ne sonnent pas pareil, et c'est ce petit
 *      désordre qui fait entendre « section ».
 *
 *   3. DES TIMBRES CONSTRUITS. Plus de dent de scie brute : les ondes sont
 *      décrites partiel par partiel (createPeriodicWave), ce qui permet de
 *      donner à chaque famille son propre spectre.
 *
 *   4. DU SOUFFLE ET DU VIBRATO. Un peu de bruit filtré au moment de l'attaque
 *      des cuivres, et un vibrato lent sur les notes tenues. Les instruments
 *      réels ne tiennent jamais une hauteur parfaitement fixe.
 *
 * Repères, alignés sur les temps de l'animation :
 *   0,00 s  les cordes s'installent et posent la tonalité
 *   0,90 s  la harpe monte, d'abord posée
 *   2,05 s  elle repart plus vite : ça se resserre
 *   3,30 s  l'élan : trois notes brèves aux cuivres
 *   3,70 s  VERROUILLAGE : tutti en Do majeur
 *   4,70 s  la traîne de harpe et de célesta s'éteint dans la salle
 *
 * Comme tous les sons de ce dossier, cette fonction ne crée PAS de contexte
 * audio : elle reçoit celui de l'AudioManager et se branche sur la sortie
 * qu'il lui donne.
 *
 * @param {AudioContext} ctx
 * @param {AudioNode} destination - la sortie du AudioManager (volume général)
 */
export function playTabUnlockingSound(ctx, destination) {
    const t0 = ctx.currentTime;

    // ------------------------------------------------------------------
    // La salle
    // ------------------------------------------------------------------

    // Un passe-bas très haut placé : il retire la dureté des aigus qui trahit
    // la synthèse, sans rien étouffer.
    const couleur = ctx.createBiquadFilter();
    couleur.type = 'lowpass';
    couleur.frequency.value = 8200;
    couleur.Q.value = 0.4;
    couleur.connect(destination);

    // Le bus où jouent tous les instruments : une seule poignée de volume.
    const bus = ctx.createGain();
    bus.gain.value = 0.62;

    const direct = ctx.createGain();
    direct.gain.value = 1;
    bus.connect(direct);
    direct.connect(couleur);

    /**
     * Réponse impulsionnelle fabriquée : du bruit dont l'amplitude décroît en
     * puissance. Les deux canaux sont tirés indépendamment, ce qui écarte
     * l'image stéréo — une salle n'est jamais identique à gauche et à droite.
     */
    const salle = ctx.createConvolver();
    const dureeSalle = 2.4;
    const ir = ctx.createBuffer(2, Math.ceil(ctx.sampleRate * dureeSalle), ctx.sampleRate);
    for (let canal = 0; canal < 2; canal++) {
        const data = ir.getChannelData(canal);
        for (let i = 0; i < data.length; i++) {
            const avancement = i / data.length;
            // la pré-atténuation du tout début évite un « clap » au lieu d'une queue
            const enveloppe = Math.pow(1 - avancement, 2.6) * Math.min(1, avancement * 40);
            data[i] = (Math.random() * 2 - 1) * enveloppe;
        }
    }
    salle.buffer = ir;

    const reverbere = ctx.createGain();
    reverbere.gain.value = 0.42;
    bus.connect(salle);
    salle.connect(reverbere);
    reverbere.connect(couleur);

    // ------------------------------------------------------------------
    // Le vibrato, partagé par toutes les notes tenues
    // ------------------------------------------------------------------

    const vibrato = ctx.createOscillator();
    const profondeur = ctx.createGain();
    vibrato.type = 'sine';
    vibrato.frequency.value = 4.6;
    profondeur.gain.setValueAtTime(0, t0);
    // il s'installe progressivement : un vibrato présent dès la première
    // milliseconde s'entend comme un effet, pas comme un musicien
    profondeur.gain.linearRampToValueAtTime(7, t0 + 1.6);
    vibrato.connect(profondeur);
    vibrato.start(t0);
    vibrato.stop(t0 + 6.8);

    // ------------------------------------------------------------------
    // Les timbres
    // ------------------------------------------------------------------

    /** Construit une onde à partir d'une liste d'amplitudes de partiels. */
    const onde = (partiels) => {
        const reel = new Float32Array(partiels.length + 1);
        const imaginaire = new Float32Array(partiels.length + 1);
        partiels.forEach((a, i) => { imaginaire[i + 1] = a; });
        return ctx.createPeriodicWave(reel, imaginaire, { disableNormalization: false });
    };

    // cordes : décroissance douce en 1/n, rien d'agressif dans l'aigu
    const ondeCordes = onde([1, 0.52, 0.32, 0.20, 0.13, 0.09, 0.06, 0.04, 0.03]);
    // cuivres : les partiels tiennent beaucoup plus haut, d'où l'éclat
    const ondeCuivres = onde([1, 0.78, 0.62, 0.50, 0.40, 0.31, 0.24, 0.18, 0.13, 0.09, 0.06]);
    // harpe : deux ou trois partiels seulement, et ça s'éteint vite
    const ondeHarpe = onde([1, 0.34, 0.17, 0.08, 0.045, 0.025]);

    const voix = [];

    /**
     * Une note. `pupitre` décide du nombre de voix empilées : c'est lui qui
     * transforme un oscillateur en section.
     */
    const note = ({ timbre, freq, debut, attaque, duree, niveau, pupitre = 1, tenue = true }) => {
        for (let v = 0; v < pupitre; v++) {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.setPeriodicWave(timbre);
            osc.frequency.value = freq;
            // désaccord et décalage temporel croissants d'une voix à l'autre
            osc.detune.value = v === 0 ? 0 : (v % 2 ? 1 : -1) * (4 + v * 3);
            const retard = v * 0.012;

            if (tenue) profondeur.connect(osc.detune);

            const d = debut + retard;
            gain.gain.setValueAtTime(0.0001, d);
            gain.gain.linearRampToValueAtTime(niveau / pupitre, d + attaque);
            // exponentielle : une extinction linéaire s'entend comme une coupure
            gain.gain.exponentialRampToValueAtTime(0.0001, d + duree);

            osc.connect(gain);
            gain.connect(bus);

            osc.start(d);
            osc.stop(d + duree + 0.05);
            osc.onended = () => gain.disconnect(); // on ne laisse pas les noeuds s'accumuler
            voix.push(osc);
        }
    };

    /**
     * Le souffle de l'attaque des cuivres : un éclat de bruit filtré, très
     * court et très bas. On ne l'entend pas comme du bruit, seulement comme
     * de l'air — sans lui l'attaque sonne électronique.
     */
    const souffle = (freq, debut, niveau) => {
        const duree = 0.16;
        const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duree), ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

        const source = ctx.createBufferSource();
        const filtre = ctx.createBiquadFilter();
        const gain = ctx.createGain();

        source.buffer = buffer;
        filtre.type = 'bandpass';
        filtre.frequency.value = freq * 3;
        filtre.Q.value = 0.8;

        gain.gain.setValueAtTime(niveau, debut);
        gain.gain.exponentialRampToValueAtTime(0.0001, debut + duree);

        source.connect(filtre);
        filtre.connect(gain);
        gain.connect(bus);
        source.start(debut);
        source.onended = () => gain.disconnect();
    };

    /** La harpe : attaque sèche, longue résonance, aucune tenue donc aucun vibrato. */
    const harpe = (freq, debut, niveau = 0.17, duree = 2.6) =>
        note({ timbre: ondeHarpe, freq, debut, attaque: 0.006, duree, niveau, tenue: false });

    /** Les cordes : attaque lente, pupitre de trois. */
    const cordes = (freq, debut, niveau, duree, attaque = 0.35) =>
        note({ timbre: ondeCordes, freq, debut, attaque, duree, niveau, pupitre: 3 });

    /** Les cuivres : pupitre de deux, plus le souffle de l'attaque. */
    const cuivres = (freq, debut, niveau, duree, attaque = 0.06) => {
        note({ timbre: ondeCuivres, freq, debut, attaque, duree, niveau, pupitre: 2 });
        souffle(freq, debut, niveau * 0.35);
    };

    /**
     * Le célesta : une fondamentale douce et une partielle non entière. C'est
     * ce rapport inharmonique qui fait « métal » plutôt que « flûte ».
     */
    const celesta = (freq, debut, niveau, duree = 2.4) => {
        note({ timbre: ondeHarpe, freq, debut, attaque: 0.004, duree, niveau, tenue: false });
        note({ timbre: ondeHarpe, freq: freq * 2.76, debut, attaque: 0.004, duree: duree * 0.4, niveau: niveau * 0.22, tenue: false });
    };


    // --- Notes utilisées (Do majeur) -------------------------------------
    const C3 = 130.81, G3 = 196.00;
    const C4 = 261.63, E4 = 329.63, G4 = 392.00;
    const C5 = 523.25, E5 = 659.25, G5 = 783.99;
    const C6 = 1046.50, E6 = 1318.51, G6 = 1567.98;


    // --- 1. Les cordes d'ouverture (0 → 4,4 s) ---------------------------
    // Très en retrait, entrées décalées : elles ne font qu'installer Do majeur
    // sous le reste, pour que l'arpège tombe dans une tonalité déjà posée.
    cordes(C3, t0, 0.070, 4.4, 1.3);
    cordes(G3, t0 + 0.18, 0.050, 4.2, 1.4);
    cordes(E4, t0 + 0.36, 0.036, 4.0, 1.5);


    // --- 2. L'arpège de harpe (0,90 → 3,25 s) ----------------------------
    // Deux passes : la première posée, la seconde plus serrée et plus haute.
    // C'est l'accélération qui fait monter l'attente, pas le volume.
    [C4, E4, G4, C5].forEach((freq, i) => harpe(freq, t0 + 0.90 + i * 0.28, 0.155));
    [E4, G4, C5, E5, G5, C6].forEach((freq, i) => harpe(freq, t0 + 2.05 + i * 0.195, 0.135 + i * 0.010));


    // --- 3. L'élan (3,30 → 3,57 s) ---------------------------------------
    // Trois notes brèves qui montent vers l'accord : la harpe donne l'attaque,
    // les cuivres donnent le poids.
    [[G4, 3.30], [C5, 3.44], [E5, 3.57]].forEach(([freq, instant]) => {
        harpe(freq, t0 + instant, 0.13, 0.9);
        cuivres(freq, t0 + instant, 0.075, 0.38, 0.035);
    });


    // --- 4. Le tutti (3,70 s) --------------------------------------------
    const verrou = t0 + 3.70;

    // La timbale : une peau grave qu'on frappe, pas une basse de synthé.
    const timbale = ctx.createOscillator();
    const gainTimbale = ctx.createGain();
    timbale.type = 'sine';
    timbale.frequency.setValueAtTime(96, verrou);
    timbale.frequency.exponentialRampToValueAtTime(62, verrou + 0.4);
    gainTimbale.gain.setValueAtTime(0.0001, verrou);
    gainTimbale.gain.linearRampToValueAtTime(0.21, verrou + 0.02);
    gainTimbale.gain.exponentialRampToValueAtTime(0.0001, verrou + 1.5);
    timbale.connect(gainTimbale);
    gainTimbale.connect(bus);
    timbale.start(verrou);
    timbale.stop(verrou + 1.55);
    timbale.onended = () => gainTimbale.disconnect();
    souffle(120, verrou, 0.07);

    // L'accord plein. L'attaque n'est pas instantanée : même sur un accent, un
    // orchestre met quelques dizaines de millisecondes à s'installer, et c'est
    // ce délai qui empêche d'entendre un déclenchement de sampler.
    [[C3, 0.075], [G3, 0.062], [C4, 0.070], [E4, 0.056], [G4, 0.050]].forEach(([freq, niveau]) => {
        cuivres(freq, verrou, niveau, 2.8, 0.045);
        cordes(freq, verrou + 0.02, niveau * 0.6, 3.2, 0.12);
    });

    // La harpe redouble l'accord dans l'aigu, en arpège très serré : c'est
    // elle qu'on entend briller par-dessus les cuivres.
    [C5, E5, G5, C6].forEach((freq, i) => harpe(freq, verrou + i * 0.022, 0.14, 3.0));
    celesta(C6, verrou + 0.03, 0.085, 2.8);

    // Dernières cordes, très douces : elles referment sur la tonique et
    // laissent la salle finir toute seule.
    cordes(C4, t0 + 4.70, 0.042, 2.0, 0.6);
    cordes(G4, t0 + 4.85, 0.030, 1.8, 0.7);


    // On coupe le bus une fois la dernière voix éteinte. L'oscillateur ne sert
    // que d'horloge : il passe par un gain à zéro, donc il ne s'entend pas —
    // mais il reste branché, sinon le navigateur peut l'éliminer avant qu'il
    // ait déclenché son onended.
    const horloge = ctx.createOscillator();
    const silence = ctx.createGain();
    silence.gain.value = 0;
    horloge.connect(silence);
    silence.connect(bus);
    horloge.start(t0);
    // on laisse la queue de réverbération finir avant de tout débrancher
    horloge.stop(t0 + 8.4);
    horloge.onended = () => {
        profondeur.disconnect();
        silence.disconnect();
        direct.disconnect();
        reverbere.disconnect();
        salle.disconnect();
        bus.disconnect();
        couleur.disconnect();
    };
}
