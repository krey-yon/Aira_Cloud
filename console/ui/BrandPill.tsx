import { BrandMark } from "./BrandMark";

type Props = {
  subtitle: string;
};

export function BrandPill({ subtitle }: Props) {
  return (
    <div className="brand-pill workspace-pill">
      <BrandMark />
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
