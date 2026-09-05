import icon128 from "../icons/icon128.png";

export function BrandMark({ className }: { className?: string }) {
  return (
    <img
      className={className ? `brand-mark ${className}` : "brand-mark"}
      src={icon128}
      width={36}
      height={36}
      alt="Aira"
      decoding="async"
    />
  );
}
