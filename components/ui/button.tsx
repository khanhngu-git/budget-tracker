import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Variant = "primary" | "outline" | "ghost" | "light" | "lightOutline" | "lightGhost";
type Size = "sm" | "md";

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-lg font-medium whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-60";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-foreground text-background hover:bg-foreground/90",
  outline:
    "border border-border bg-surface text-foreground hover:bg-surface-muted",
  ghost: "text-muted hover:text-foreground",
  // "light*" variants sit on the hero's photo scrim, where the themed
  // foreground/background tokens would invert into the wrong contrast.
  light: "bg-white text-zinc-950 hover:bg-white/90",
  lightOutline:
    "border border-white/30 bg-white/10 text-white backdrop-blur-sm hover:bg-white/20",
  lightGhost: "text-white/80 hover:text-white",
};

const SIZES: Record<Size, string> = {
  sm: "h-9 px-3.5 text-sm",
  md: "h-11 px-5 text-[0.9375rem]",
};

export function buttonClasses(variant: Variant = "primary", size: Size = "md") {
  return `${BASE} ${VARIANTS[variant]} ${SIZES[size]}`;
}

type ButtonProps = ComponentProps<"button"> & {
  variant?: Variant;
  size?: Size;
};

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ButtonProps) {
  return (
    <button className={`${buttonClasses(variant, size)} ${className}`} {...props} />
  );
}

type ButtonLinkProps = ComponentProps<typeof Link> & {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
};

export function ButtonLink({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ButtonLinkProps) {
  return (
    <Link className={`${buttonClasses(variant, size)} ${className}`} {...props} />
  );
}
