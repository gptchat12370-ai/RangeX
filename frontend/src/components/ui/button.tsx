import * as React from "react";
import { Slot } from "@radix-ui/react-slot@1.1.2";
import { cva, type VariantProps } from "class-variance-authority@0.7.1";

import { cn } from "./utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-all duration-300 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 relative overflow-hidden group",
  {
    variants: {
      variant: {
        default: [
          // Base gradient background
          "bg-gradient-to-r from-cyan-500 via-blue-500 to-cyan-500 bg-[length:200%_100%]",
          "text-white font-semibold",
          "shadow-lg shadow-cyan-500/30",
          // Hover effects
          "hover:bg-[position:100%_0]",
          "hover:shadow-[0_0_30px_rgba(6,182,212,0.6),0_0_60px_rgba(6,182,212,0.3)]",
          "hover:scale-[1.02]",
          "hover:-translate-y-0.5",
          // Active state
          "active:scale-[0.98]",
          "active:shadow-[0_0_40px_rgba(6,182,212,0.8),0_0_80px_rgba(6,182,212,0.4)]",
          // Shine effect
          "before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent",
          "before:translate-x-[-200%] before:transition-transform before:duration-700",
          "hover:before:translate-x-[200%]",
        ].join(" "),
        destructive: [
          "bg-gradient-to-r from-red-500 via-red-600 to-red-500 bg-[length:200%_100%]",
          "text-white font-semibold",
          "shadow-lg shadow-red-500/30",
          "hover:bg-[position:100%_0]",
          "hover:shadow-[0_0_30px_rgba(239,68,68,0.6)]",
          "hover:scale-[1.02]",
          "active:scale-[0.98]",
        ].join(" "),
        outline: [
          // Glassmorphism background
          "bg-gradient-to-br from-white/10 via-white/5 to-transparent",
          "backdrop-blur-sm",
          "text-foreground",
          // Gradient border effect
          "border-2 border-transparent",
          "before:absolute before:inset-0 before:rounded-xl before:p-[2px]",
          "before:bg-gradient-to-br before:from-cyan-400 before:via-blue-500 before:to-purple-500",
          "before:-z-10 before:transition-all before:duration-300",
          "before:opacity-60",
          // Hover effects
          "hover:text-white",
          "hover:bg-gradient-to-br hover:from-cyan-500/20 hover:via-blue-500/20 hover:to-purple-500/20",
          "hover:before:opacity-100",
          "hover:shadow-[0_0_25px_rgba(6,182,212,0.4)]",
          "hover:scale-[1.02]",
          // Active state
          "active:scale-[0.98]",
          "active:shadow-[0_0_35px_rgba(6,182,212,0.6)]",
        ].join(" "),
        secondary: [
          "bg-gradient-to-br from-slate-600/90 to-slate-700/90",
          "text-white",
          "shadow-md shadow-slate-500/20",
          "hover:from-slate-500/90 hover:to-slate-600/90",
          "hover:shadow-lg hover:shadow-slate-500/30",
          "hover:scale-[1.02]",
          "active:scale-[0.98]",
        ].join(" "),
        ghost: [
          "text-foreground",
          "hover:bg-gradient-to-br hover:from-cyan-500/10 hover:to-blue-500/10",
          "hover:text-primary",
          "hover:shadow-sm",
          "active:bg-cyan-500/20",
        ].join(" "),
        link: "text-primary underline-offset-4 hover:underline shadow-none hover:scale-105",
      },
      size: {
        default: "h-10 px-5 py-2.5",
        sm: "h-9 rounded-lg px-4 text-xs",
        lg: "h-12 rounded-xl px-7 text-base",
        icon: "size-10 rounded-xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
