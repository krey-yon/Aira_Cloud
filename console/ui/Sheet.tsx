import type { ReactNode } from "react";

type Props = {
  title: string;
  onClose: () => void;
  children: ReactNode;
  actions?: ReactNode;
  eyebrow?: string;
};

/** Full canvas surface for dock panels (not a modal sheet). */
export function Sheet({ title, onClose, children, actions, eyebrow }: Props) {
  return (
    <section className="canvas-panel glass" aria-label={title}>
      <div className="sheet-header">
        <div className="sheet-heading">
          {eyebrow ? <span className="sheet-eyebrow">{eyebrow}</span> : null}
          <h3>{title}</h3>
        </div>
        <div className="sheet-header-actions">
          {actions}
          <button type="button" className="sheet-close" aria-label="Close" onClick={onClose}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
              <path d="M2.5 2.5l7 7M9.5 2.5l-7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>
      <div className="sheet-body">{children}</div>
    </section>
  );
}
