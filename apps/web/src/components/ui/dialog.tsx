import * as React from 'react';
import { Dialog as D, AlertDialog as AD } from 'radix-ui';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buttonVariants } from './button';

export const Dialog = D.Root;
export const DialogTrigger = D.Trigger;
export const DialogClose = D.Close;

const overlay = 'fixed inset-0 z-50 bg-moss-950/40 data-[state=open]:animate-in';

export function DialogContent({ className, children, ...props }: React.ComponentProps<typeof D.Content>) {
  return (
    <D.Portal>
      <D.Overlay className={overlay} />
      <D.Content
        className={cn(
          'fixed top-1/2 left-1/2 z-50 flex max-h-[min(92dvh,760px)] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl bg-white shadow-pop data-[state=open]:animate-in',
          className,
        )}
        {...props}
      >
        {children}
        <D.Close className="absolute top-3.5 right-3.5 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
          <X className="size-4" />
          <span className="sr-only">Fechar</span>
        </D.Close>
      </D.Content>
    </D.Portal>
  );
}

export function DialogHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="border-b border-border px-6 pt-5 pb-4 pr-12">
      <D.Title className="text-base font-semibold tracking-[-0.01em]">{title}</D.Title>
      {description ? (
        <D.Description className="mt-1 text-[13px] text-muted-foreground">{description}</D.Description>
      ) : (
        <D.Description className="sr-only">{title}</D.Description>
      )}
    </div>
  );
}

export const DialogBody = ({ className, ...props }: React.ComponentProps<'div'>) => (
  <div className={cn('flex-1 overflow-y-auto px-6 py-5', className)} {...props} />
);

export const DialogFooter = ({ className, ...props }: React.ComponentProps<'div'>) => (
  <div className={cn('flex flex-col-reverse gap-2 border-t border-border px-6 py-4 sm:flex-row sm:justify-end', className)} {...props} />
);

/** Painel lateral (dossiê). Tela cheia no mobile. */
export function SheetContent({ className, children, ...props }: React.ComponentProps<typeof D.Content>) {
  return (
    <D.Portal>
      <D.Overlay className={overlay} />
      <D.Content
        className={cn(
          'fixed inset-y-0 right-0 z-50 flex h-dvh w-full flex-col bg-white shadow-pop data-[state=open]:animate-slide-in md:w-[min(46vw,760px)] md:min-w-[560px]',
          className,
        )}
        {...props}
      >
        {children}
      </D.Content>
    </D.Portal>
  );
}
export const SheetTitle = D.Title;
export const SheetDescription = D.Description;

/** Confirmação de ação destrutiva. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
  destructive = true,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  destructive?: boolean;
}) {
  return (
    <AD.Root open={open} onOpenChange={onOpenChange}>
      <AD.Portal>
        <AD.Overlay className={overlay} />
        <AD.Content className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-6 shadow-pop data-[state=open]:animate-in">
          <AD.Title className="text-base font-semibold">{title}</AD.Title>
          <AD.Description className="mt-2 text-sm text-muted-foreground">{description}</AD.Description>
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AD.Cancel className={buttonVariants({ variant: 'outline' })}>Cancelar</AD.Cancel>
            <AD.Action className={buttonVariants({ variant: destructive ? 'destructive' : 'default' })} onClick={onConfirm}>
              {confirmLabel}
            </AD.Action>
          </div>
        </AD.Content>
      </AD.Portal>
    </AD.Root>
  );
}
