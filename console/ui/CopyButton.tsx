import { useState } from "react";

type Props = {
  text: string;
  label?: string;
  mode?: "icon" | "label";
  disabled?: boolean;
};

export function CopyButton({ text, label = "Copy", mode = "icon", disabled = false }: Props) {
  const [copied, setCopied] = useState(false);
  const idleLabel = label;
  const activeLabel = "Copied";

  return (
    <button
      type="button"
      className={
        mode === "label"
          ? `btn sheet-action${copied ? " is-copied" : ""}`
          : `icon-btn copy-btn${copied ? " is-copied" : ""}`
      }
      aria-label={copied ? activeLabel : idleLabel}
      title={copied ? activeLabel : idleLabel}
      disabled={disabled || !text}
      onClick={(event) => {
        event.stopPropagation();
        if (!text) return;
        void navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1400);
        });
      }}
    >
      {mode === "label" ? (
        copied ? activeLabel : idleLabel
      ) : copied ? (
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none">
          <path
            d="M5 13l4 4L19 7"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none">
          <rect
            x="8"
            y="8"
            width="11"
            height="11"
            rx="2"
            stroke="currentColor"
            strokeWidth="1.7"
          />
          <path
            d="M6 15V6a2 2 0 0 1 2-2h9"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        </svg>
      )}
    </button>
  );
}
