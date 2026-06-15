import Link from "next/link";
import clsx from "clsx";

const LOGO_SRC = "/asset/images/TrustAI_logo.png";

type LogoProps = {
  href?: string;
  className?: string;
  height?: number;
};

export function Logo({ href = "/", className, height = 36 }: LogoProps) {
  const image = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={LOGO_SRC}
      alt="TrustAI"
      height={height}
      className={clsx("block w-auto max-w-full object-contain object-left", className)}
      style={{ height: `${height}px` }}
    />
  );

  if (href) {
    return (
      <Link href={href} className="block max-w-full">
        {image}
      </Link>
    );
  }

  return <span className="block max-w-full">{image}</span>;
}
