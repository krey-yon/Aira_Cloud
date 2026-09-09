import { useState } from "react";

type Props = {
  message: string | null;
};

function playToastTone() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 660;
    gain.gain.value = 0.0001;
    osc.connect(gain);
    gain.connect(ctx.destination);
    const now = ctx.currentTime;
    gain.gain.exponentialRampToValueAtTime(0.04, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    osc.frequency.exponentialRampToValueAtTime(420, now + 0.16);
    osc.start(now);
    osc.stop(now + 0.2);
    window.setTimeout(() => void ctx.close(), 260);
  } catch {
    // Audio optional.
  }
}

export function MailToast({ message }: Props) {
  if (!message) return null;
  return (
    <div className="mail-toast" role="status" aria-live="polite">
      {message}
    </div>
  );
}

export function useMailToast() {
  const [message, setMessage] = useState<string | null>(null);
  const push = (text: string) => {
    setMessage(text);
    playToastTone();
    window.setTimeout(() => setMessage(null), 2200);
  };
  return { message, push };
}
