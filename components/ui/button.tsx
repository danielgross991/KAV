import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { FormPendingOverlay } from "@/components/form-pending-overlay";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-[background-color,border-color,color,transform] duration-150 active:scale-[0.985] disabled:pointer-events-none disabled:opacity-50 focus-visible:border-ring focus-visible:ring-ring/40 focus-visible:ring-[3px] outline-none",
  {
    variants: {
      variant: {
        default: "bg-primary !text-white hover:bg-primary/90",
        destructive:
          "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20",
        outline:
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary: "border border-input bg-card text-secondary-foreground hover:bg-muted",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-6",
        icon: "size-10 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  loadingOverlay = true,
  type,
  variant,
  size,
  ...props
}: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { loadingOverlay?: boolean }) {
  return (
    <>
      {loadingOverlay && type !== "button" ? <FormPendingOverlay /> : null}
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        type={type}
        {...props}
      />
    </>
  );
}

export { Button, buttonVariants };
