type Props = {
  subtitle: string;
};

export function BrandPill({ subtitle }: Props) {
  return (
    <div className="brand-pill workspace-pill">
      <img src="./aira-mark.svg" alt="" aria-hidden />
      <div>
        <div>
          <span className="brand-name">Aira</span>
          <span className="brand-chip">Cloud</span>
        </div>
        <div className="brand-meta">
          <span className="pulse" />
          {subtitle}
        </div>
      </div>
    </div>
  );
}
