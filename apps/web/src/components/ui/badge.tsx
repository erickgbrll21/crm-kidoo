import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

export const badgeVariants = cva(
  'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11.5px] font-medium leading-4 [&_svg]:size-3',
  {
    variants: {
      variant: {
        default: 'bg-moss-100 text-moss-800',
        solid: 'bg-primary text-primary-foreground',
        outline: 'border border-border text-muted-foreground',
        danger: 'bg-destructive-soft text-destructive',
        warning: 'bg-warning-soft text-warning',
        success: 'bg-success-soft text-success',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export function Badge({ className, variant, ...props }: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
