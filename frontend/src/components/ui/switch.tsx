"use client";

import * as React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";

import { cn } from "./utils";

type IconSwitchProps = React.ComponentProps<typeof SwitchPrimitive.Root> & {
  leftIcon?: React.ReactNode;   // icon shown on the left (unchecked side)
  rightIcon?: React.ReactNode;  // icon shown on the right (checked side)
  leftLabel?: string;  // text label for unchecked state
  rightLabel?: string; // text label for checked state
};

function Switch({
  className,
  leftIcon,
  rightIcon,
  leftLabel,
  rightLabel,
  ...props
}: IconSwitchProps) {
  const [isChecked, setIsChecked] = React.useState(props.checked || props.defaultChecked || false);

  React.useEffect(() => {
    if (props.checked !== undefined) {
      setIsChecked(props.checked);
    }
  }, [props.checked]);

  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer relative inline-flex h-8 shrink-0 cursor-pointer items-center rounded-full p-0.5",
        leftLabel || rightLabel ? "w-[100px]" : "w-14",
        "transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
        "focus-visible:ring-offset-white dark:focus-visible:ring-offset-black",
        "disabled:cursor-not-allowed disabled:opacity-50",

        // Track
        "border shadow-sm",
        isChecked
          ? "bg-gradient-to-r from-blue-500 to-indigo-600 border-blue-600/30 shadow-[0_0_12px_rgba(59,130,246,0.5)]"
          : "bg-gray-100 border-gray-200 dark:bg-gray-900 dark:border-white/10",

        // Inner highlight
        "before:pointer-events-none before:absolute before:inset-0 before:rounded-full before:content-['']",
        "before:shadow-[inset_0_1px_0_rgba(255,255,255,0.45)] dark:before:shadow-[inset_0_1px_0_rgba(255,255,255,0.10)]",

        className,
      )}
      onCheckedChange={(checked) => {
        setIsChecked(checked);
        props.onCheckedChange?.(checked);
      }}
      {...props}
    >
      {/* Track labels/icons */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-between px-2">
        <span
          className={cn(
            "flex items-center justify-center transition-all duration-300 ease-in-out text-xs font-medium",
            isChecked
              ? "opacity-0 scale-75"
              : "opacity-100 scale-100 text-gray-600 dark:text-gray-300",
          )}
        >
          {leftLabel || leftIcon || "Off"}
        </span>

        <span
          className={cn(
            "flex items-center justify-center transition-all duration-300 ease-in-out text-xs font-medium",
            isChecked
              ? "opacity-100 scale-100 text-white"
              : "opacity-0 scale-75",
          )}
        >
          {rightLabel || rightIcon || "On"}
        </span>
      </div>

      {/* Thumb */}
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none relative z-10 block h-7 w-7 rounded-full bg-white",
          "shadow-[0_2px_8px_rgba(0,0,0,0.15),0_4px_16px_rgba(0,0,0,0.1)]",
          "transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
          isChecked ? "translate-x-[calc(100%-28px)]" : "translate-x-0",
          isChecked ? "scale-105" : "scale-100",
          "after:pointer-events-none after:absolute after:inset-0 after:rounded-full after:content-['']",
          "after:shadow-[inset_0_1px_2px_rgba(255,255,255,0.9)]",
        )}
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
