export function BrandMark({ className }: { className?: string }) {
  return (
    <img
      className={className ? `brand-mark ${className}` : "brand-mark"}
      src="./aira-mark.svg"
      width={36}
      height={36}
      alt=""
      decoding="async"
    />
  );
}
