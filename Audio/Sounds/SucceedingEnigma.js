// Inspiré du jingle "nouvel objet obtenu" de Zelda : une petite course de notes qui grimpe vite,
// puis un accord qui atterrit et qu'on laisse sonner un instant. La course fait le "déclic",
// l'accord final fait le "voilà, c'est débloqué" — sans pour autant durer aussi longtemps
// qu'une vraie fanfare de victoire (ça reste une simple énigme, pas la fin du jeu).

const RUN_HZ = [523.25, 659.25, 783.99, 1046.50, 1318.51]; // Do5, Mi5, Sol5, Do6, Mi6 : ça grimpe d'une octave
const RUN_SPACING = 0.085;
const RUN_NOTE_DECAY = 0.18;

const LANDING_HZ = [783.99, 1046.50, 1318.51]; // Sol5, Do6, Mi6 : l'accord sur lequel la course se pose
const LANDING_DECAY = 0.75;

const LANDING_TIME = RUN_HZ.length * RUN_SPACING;
const TOTAL_DURATION = LANDING_TIME + LANDING_DECAY + 0.1;

/**
 * Le petit "objet débloqué" joué à chaque énigme réussie : une course qui grimpe, puis un accord
 * qui se pose et résonne brièvement.
 *
 * @param {AudioContext} ctx
 * @param {AudioNode} destination - la sortie du AudioManager (volume général)
 */
export function playSucceedingEnigma(ctx, destination) {
    const t0 = ctx.currentTime;

    addClick(ctx, t0, destination);
    RUN_HZ.forEach((freq, index) => addNote(ctx, t0 + index * RUN_SPACING, destination, freq, RUN_NOTE_DECAY, 0.22));

    const landingTime = t0 + LANDING_TIME;
    LANDING_HZ.forEach(freq => addNote(ctx, landingTime, destination, freq, LANDING_DECAY, 0.16, 'triangle'));
}

/**
 * Une note de l'arpège ou de l'accord final : attaque immédiate, décroissance qui lui est propre.
 * Le 'triangle' de l'accord final lui donne un peu plus de corps que les sinusoïdes de la course.
 */
function addNote(ctx, time, destination, freq, decay, gain, type = 'sine') {
    const osc = ctx.createOscillator();
    const envelope = ctx.createGain();

    osc.type = type;
    osc.frequency.value = freq;

    envelope.gain.setValueAtTime(0.0001, time);
    envelope.gain.exponentialRampToValueAtTime(gain, time + 0.008);
    envelope.gain.exponentialRampToValueAtTime(0.0001, time + decay);

    osc.connect(envelope);
    envelope.connect(destination);

    osc.start(time);
    osc.stop(time + decay + 0.02);
    osc.onended = () => envelope.disconnect();
}

/**
 * Le déclic du mécanisme, juste avant la course de notes : un bref souffle filtré, comme un loquet
 * qui cède. C'est lui qui fait entendre un "déverrouillage" plutôt qu'une simple mélodie qui démarre.
 */
function addClick(ctx, t0, destination) {
    const length = Math.floor(ctx.sampleRate * 0.02);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const samples = buffer.getChannelData(0);

    for (let i = 0; i < length; i++) samples[i] = Math.random() * 2 - 1;

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const bandpass = ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.value = 2400;
    bandpass.Q.value = 1.2;

    const envelope = ctx.createGain();
    envelope.gain.setValueAtTime(0.15, t0);
    envelope.gain.exponentialRampToValueAtTime(0.001, t0 + 0.02);

    noise.connect(bandpass);
    bandpass.connect(envelope);
    envelope.connect(destination);

    noise.start(t0);
    noise.onended = () => envelope.disconnect();
}

export const SUCCEEDING_ENIGMA_DURATION = TOTAL_DURATION;
