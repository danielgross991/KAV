import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex min-h-6 items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium leading-4 transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary !text-white",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        outline: "text-foreground",
        success: "border-success/20 bg-success-soft text-success",
        warning: "border-warning/20 bg-warning-soft text-warning",
        danger: "border-destructive/20 bg-red-50 text-destructive",
        info: "border-info/20 bg-info-soft text-info",
        special: "border-special/20 bg-special-soft text-special",
        muted: "border-transparent bg-muted text-muted-foreground",
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
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span className={cn(badgeVariants({ variant, className }))} {...props} />
  );
}

export { Badge, badgeVariants };
