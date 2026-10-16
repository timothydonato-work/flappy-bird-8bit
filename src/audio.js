export function createAudio() {
  let context;
  let muted = false;
  const notes = { flap: [440, 660, 0.06], score: [880, 1320, 0.1], hit: [180, 40, 0.18], level: [660, 1760, 0.3] };
  return {
    get muted() { return muted; },
    unlock() {
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!context && AudioContext) context = new AudioContext();
        if (context?.state === 'suspended') context.resume().catch(() => {});
      } catch { /* Audio is optional on unsupported or restricted browsers. */ }
    },
    toggle() { muted = !muted; },
    play(name) {
      if (muted || !context || context.state !== 'running') return;
      try {
        const [from, to, duration] = notes[name];
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const now = context.currentTime;
        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(from, now);
        oscillator.frequency.exponentialRampToValueAtTime(to, now + duration);
        gain.gain.setValueAtTime(0.035, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(now);
        oscillator.stop(now + duration);
        oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
      } catch { /* A missing audio device must never interrupt the game. */ }
    },
  };
}
