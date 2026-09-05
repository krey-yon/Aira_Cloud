export function BrandMark({ className }: { className?: string }) {
  return (
    <img
      className={className ? `brand-mark ${className}` : "brand-mark"}
      src="./icons/icon128.png"
      width={36}
      height={36}
      alt="Aira"
      decoding="async"
    />
  );
}
