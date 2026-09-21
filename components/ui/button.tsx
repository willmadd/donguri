import Link from "next/link";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// Solid variants pair with text-washi rather than a fixed white/black:
// washi flips paper↔ink across light/dark themes in lockstep with how
// light/dark the brand colors themselves go, so contrast holds in both.
export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium transition disabled:cursor-not-allowed disabled:opacity-60",
  {
    variants: {
      variant: {
        primary: "bg-ai text-washi hover:bg-ai-dark",
        secondary: "bg-matcha text-washi hover:bg-matcha-dark",
        accent: "bg-sakura text-washi hover:bg-sakura-dark",
        outline:
          "border border-ghost-border bg-transparent text-ghost-text hover:bg-ghost-hover",
      },
      tone: {
        neutral: "",
        danger: "",
      },
      size: {
        sm: "h-9 px-4 text-sm",
        md: "h-11 px-6",
        lg: "h-12 px-7",
      },
      fullWidth: {
        true: "w-full",
      },
    },
    compoundVariants: [
      {
        variant: "outline",
        tone: "danger",
        class:
          "border-shu/30 text-shu hover:border-shu/40 hover:bg-shu/10 hover:text-shu-dark",
      },
    ],
    defaultVariants: {
      variant: "primary",
      tone: "neutral",
      size: "md",
    },
  },
);

type ButtonVariantProps = VariantProps<typeof buttonVariants>;

type CommonProps = ButtonVariantProps & {
  className?: string;
};

type ButtonAsButton = CommonProps &
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    href?: undefined;
  };

type ButtonAsLink = CommonProps &
  Omit<React.ComponentProps<typeof Link>, "className"> & {
    href: string;
  };

export type ButtonProps = ButtonAsButton | ButtonAsLink;

export function Button({
  className,
  variant,
  tone,
  size,
  fullWidth,
  ...props
}: ButtonProps) {
  const classes = cn(
    buttonVariants({ variant, tone, size, fullWidth }),
    className,
  );

  if (props.href !== undefined) {
    const { href, ...linkProps } = props as ButtonAsLink;
    return <Link href={href} className={classes} {...linkProps} />;
  }

  const { type = "button", ...buttonProps } = props as ButtonAsButton;
  return <button type={type} className={classes} {...buttonProps} />;
}
