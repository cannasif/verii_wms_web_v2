let switchAudioContext: AudioContext | null = null;

function getSwitchAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;

  const AudioCtx = window.AudioContext
    ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!AudioCtx) return null;

  if (!switchAudioContext || switchAudioContext.state === 'closed') {
    switchAudioContext = new AudioCtx();
  }

  return switchAudioContext;
}

function createNoiseBuffer(ctx: AudioContext, durationSec: number, decayRatio: number): AudioBuffer {
  const bufferSize = Math.floor(ctx.sampleRate * durationSec);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < bufferSize; i += 1) {
    const envelope = Math.exp(-i / (bufferSize * decayRatio));
    data[i] = (Math.random() * 2 - 1) * envelope;
  }

  return buffer;
}

function playNoiseClick(
  ctx: AudioContext,
  start: number,
  {
    durationSec,
    decayRatio,
    filterType,
    frequency,
    q,
    peakGain,
  }: {
    durationSec: number;
    decayRatio: number;
    filterType: BiquadFilterType;
    frequency: number;
    q: number;
    peakGain: number;
  },
): void {
  const noise = ctx.createBufferSource();
  noise.buffer = createNoiseBuffer(ctx, durationSec, decayRatio);

  const filter = ctx.createBiquadFilter();
  filter.type = filterType;
  filter.frequency.value = frequency;
  filter.Q.value = q;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.linearRampToValueAtTime(peakGain, start + 0.0008);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + durationSec * 0.92);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  noise.start(start);
  noise.stop(start + durationSec + 0.01);
}

function playBodyThud(ctx: AudioContext, start: number, intensity: number): void {
  playNoiseClick(ctx, start, {
    durationSec: 0.038,
    decayRatio: 0.11,
    filterType: 'lowpass',
    frequency: 340,
    q: 0.7,
    peakGain: 0.72 * intensity,
  });

  playNoiseClick(ctx, start + 0.002, {
    durationSec: 0.022,
    decayRatio: 0.08,
    filterType: 'highpass',
    frequency: 1800,
    q: 0.5,
    peakGain: 0.12 * intensity,
  });
}

function playLatchSnap(ctx: AudioContext, start: number, intensity: number): void {
  playNoiseClick(ctx, start, {
    durationSec: 0.016,
    decayRatio: 0.06,
    filterType: 'bandpass',
    frequency: 680,
    q: 1.1,
    peakGain: 0.22 * intensity,
  });
}

function playPanelRattle(ctx: AudioContext, start: number): void {
  playNoiseClick(ctx, start, {
    durationSec: 0.028,
    decayRatio: 0.14,
    filterType: 'lowpass',
    frequency: 180,
    q: 0.4,
    peakGain: 0.08,
  });
}

/** Heavy double-throw breaker: two mechanical clacks, no synth beeps. */
export function playSwitchClick(): void {
  try {
    const ctx = getSwitchAudioContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      void ctx.resume();
    }

    const t = ctx.currentTime;

    playBodyThud(ctx, t, 1);
    playLatchSnap(ctx, t + 0.003, 0.85);

    playBodyThud(ctx, t + 0.046, 0.58);
    playLatchSnap(ctx, t + 0.049, 0.55);

    playPanelRattle(ctx, t + 0.052);
  } catch {
    // Ignore autoplay / unsupported environments.
  }
}
