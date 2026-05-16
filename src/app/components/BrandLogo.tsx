type BrandLogoProps = {
  variant?: "full" | "mark";
  alt?: string;
  className?: string;
};

function cx(...classes: Array<string | undefined | false>) {
  return classes.filter(Boolean).join(" ");
}

export default function BrandLogo({
  variant = "full",
  alt = "TaxSync — Property Tax System",
  className,
}: BrandLogoProps) {
  if (variant === "mark") {
    /*
     * Compact icon badge.
     * The PNG has a white background, so `bg-white overflow-hidden rounded-xl`
     * clips it to clean rounded corners on any background colour.
     * Callers control size (h-*, w-*), shadow, and ring via className.
     */
    return (
      <div className={cx("bg-white overflow-hidden rounded-xl", className)}>
        <img
          src="/PropertyTax.png"
          alt={alt}
          className="block w-full h-full object-contain"
          draggable={false}
        />
      </div>
    );
  }

  /*
   * full variant — entire logo (shield + TaxSync wordmark) in a polished
   * white card with padding, shadow, and a subtle ring border.
   * Caller can override any of these via className.
   */
  return (
    <div className={cx("bg-white rounded-2xl shadow-2xl shadow-slate-950/30 p-5 ring-1 ring-slate-200/60", className)}>
      <img
        src="/PropertyTax.png"
        alt={alt}
        className="block h-auto w-full object-contain"
        draggable={false}
      />
    </div>
  );
}