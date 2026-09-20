// Synthesized audio alert tones using Web Audio API
let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx || audioCtx.state === 'closed') {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

/**
 * Plays a double high-urgency beep sequence for Critical Alerts (Latency / Error)
 */
export function playCriticalAlarm() {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    // Pulse 1
    createBeep(ctx, 880, now, 0.15, 'sawtooth');
    // Pulse 2
    createBeep(ctx, 987, now + 0.18, 0.15, 'sawtooth');
    // Pulse 3
    createBeep(ctx, 1174, now + 0.36, 0.25, 'sine');
  } catch (err) {
    console.warn('Unable to play audio alert:', err);
  }
}

/**
 * Plays a recovery or confirmation chime
 */
export function playRecoveryChime() {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    createBeep(ctx, 523.25, now, 0.12, 'sine');
    createBeep(ctx, 659.25, now + 0.12, 0.12, 'sine');
    createBeep(ctx, 783.99, now + 0.24, 0.2, 'sine');
  } catch (err) {
    console.warn('Unable to play recovery chime:', err);
  }
}

function createBeep(
  ctx: AudioContext,
  frequency: number,
  startTime: number,
  duration: number,
  type: OscillatorType
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(frequency, startTime);

  gain.gain.setValueAtTime(0.001, startTime);
  gain.gain.exponentialRampToValueAtTime(0.3, startTime + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(startTime);
  osc.stop(startTime + duration + 0.05);
}
