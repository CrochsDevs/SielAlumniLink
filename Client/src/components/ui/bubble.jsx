// Bubble primitives used by @shadcn-space/bubble-03.
// Adapted from shadcn/ui's new-york-v4 Bubble for this app's Tailwind 3 setup.
import { Slot } from '@radix-ui/react-slot';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const bubbleVariants = cva(
  'group/bubble relative flex w-fit min-w-0 max-w-[80%] flex-col gap-1 data-[align=end]:self-end',
  {
    variants: {
      variant: {
        default: '[&>[data-slot=bubble-content]]:bg-primary [&>[data-slot=bubble-content]]:text-primary-foreground',
        secondary: '[&>[data-slot=bubble-content]]:bg-secondary [&>[data-slot=bubble-content]]:text-secondary-foreground',
        muted: '[&>[data-slot=bubble-content]]:bg-muted [&>[data-slot=bubble-content]]:text-muted-foreground',
        outline: '[&>[data-slot=bubble-content]]:border-border [&>[data-slot=bubble-content]]:bg-background',
        ghost: 'max-w-full [&>[data-slot=bubble-content]]:border-0 [&>[data-slot=bubble-content]]:bg-transparent [&>[data-slot=bubble-content]]:p-0',
        destructive: '[&>[data-slot=bubble-content]]:bg-destructive/10 [&>[data-slot=bubble-content]]:text-destructive',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

function BubbleGroup({ className, ...props }) {
  return <div data-slot="bubble-group" className={cn('flex min-w-0 flex-col gap-2', className)} {...props} />;
}

function Bubble({ variant = 'default', align = 'start', className, ...props }) {
  return <div data-slot="bubble" data-variant={variant} data-align={align} className={cn(bubbleVariants({ variant }), className)} {...props} />;
}

function BubbleContent({ asChild = false, className, ...props }) {
  const Comp = asChild ? Slot : 'div';
  return <Comp data-slot="bubble-content" className={cn('w-fit min-w-0 max-w-full overflow-hidden whitespace-pre-wrap break-words rounded-xl border border-transparent px-3 py-2 text-[13px] leading-relaxed [overflow-wrap:anywhere] group-data-[align=end]/bubble:self-end', className)} {...props} />;
}

function BubbleReactions({ side = 'bottom', align = 'end', className, ...props }) {
  return <div data-slot="bubble-reactions" data-align={align} data-side={side} className={cn('absolute z-10 flex w-fit items-center justify-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-sm ring-2 ring-card', side === 'top' ? 'top-0 -translate-y-3/4' : 'bottom-0 translate-y-3/4', align === 'start' ? 'left-3' : 'right-3', className)} {...props} />;
}

export { Bubble, BubbleContent, BubbleGroup, BubbleReactions };
