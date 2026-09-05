import type { ReactNode } from "react";

type Props = {
  title: string;
  onClose: () => void;
  children: ReactNode;
};

export function Sheet({ title, onClose, children }: Props) {
  return (
    <aside className="sheet glass" role="dialog" aria-label={title}>
      <div className="sheet-header">
        <h3>{title}</h3>
        <button type="button" className="sheet-close" aria-label="Close" onClick={onClose}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
            <path d="M2.5 2.5l7 7M9.5 2.5l-7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      <div className="sheet-body">{children}</div>
    </aside>
  );
}
