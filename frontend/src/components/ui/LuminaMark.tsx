import Image from "next/image";

// The Lumina brand mark (shared with lumina-clippers-app). Replaces the old
// generic play-triangle square so the whole app carries the real logo.
export function LuminaMark({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <Image
      src="/logo.png"
      alt="Lumina"
      width={size}
      height={size}
      priority
      className={`rounded-lg ${className}`}
    />
  );
}
