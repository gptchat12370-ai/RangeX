import * as React from "react";
import { Slot } from "@radix-ui/react-slot@1.1.2";
import { cva, type VariantProps } from "class-variance-authority@0.7.1";

import { cn } from "./utils";

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-lg px-2.5 py-1 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none transition-all duration-200 overflow-hidden relative",
  {
    variants: {
      variant: {
        default: [
          "bg-gradient-to-r from-cyan-500/20 via-blue-500/20 to-cyan-500/20",
          "text-cyan-600 dark:text-cyan-400",
          "border border-cyan-500/30",
          "shadow-sm shadow-cyan-500/10",
          "hover:shadow-md hover:shadow-cyan-500/20",
          "hover:border-cyan-500/50",
        ].join(" "),
        secondary: [
          "bg-gradient-to-r from-slate-500/15 to-slate-600/15",
          "text-slate-700 dark:text-slate-300",
          "border border-slate-400/30",
          "hover:bg-gradient-to-r hover:from-slate-500/25 hover:to-slate-600/25",
        ].join(" "),
        destructive: [
          "bg-gradient-to-r from-red-500/20 to-red-600/20",
          "text-red-600 dark:text-red-400",
          "border border-red-500/30",
          "shadow-sm shadow-red-500/10",
        ].join(" "),
        outline: [
          "bg-transparent",
          "text-foreground",
          "border border-foreground/20",
          "hover:border-foreground/40",
          "hover:bg-foreground/5",
        ].join(" "),
        success: [
          "bg-gradient-to-r from-green-500/20 to-emerald-500/20",
          "text-green-600 dark:text-green-400",
          "border border-green-500/30",
          "shadow-sm shadow-green-500/10",
        ].join(" "),
        warning: [
          "bg-gradient-to-r from-orange-500/20 to-amber-500/20",
          "text-orange-600 dark:text-orange-400",
          "border border-orange-500/30",
          "shadow-sm shadow-orange-500/10",
        ].join(" "),
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span";

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
