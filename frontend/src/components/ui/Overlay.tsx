import type { ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from './Button';
import { cn } from '@/lib/cn';

interface BaseProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}

function Shell({ open, onOpenChange, title, description, children, footer, variant }: BaseProps & { variant: 'modal' | 'drawer' }) {
  const drawer = variant === 'drawer';
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[3px]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              />
            </Dialog.Overlay>
            <Dialog.Content asChild forceMount aria-describedby={description ? undefined : undefined}>
              <motion.div
                className={cn(
                  'fixed z-50 flex flex-col border border-border bg-surface shadow-lg outline-none',
                  drawer
                    ? 'inset-y-0 right-0 w-full max-w-[520px] rounded-l-2xl max-sm:rounded-none'
                    : 'left-1/2 top-1/2 max-h-[88vh] w-[calc(100%-2rem)] max-w-md rounded-2xl',
                )}
                style={drawer ? undefined : { x: '-50%', y: '-50%' }}
                initial={drawer ? { x: '100%' } : { opacity: 0, scale: 0.96, y: '-46%' }}
                animate={drawer ? { x: 0 } : { opacity: 1, scale: 1, y: '-50%' }}
                exit={drawer ? { x: '100%' } : { opacity: 0, scale: 0.97, y: '-48%' }}
                transition={{ type: 'spring', stiffness: 420, damping: 38 }}
              >
                <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-4">
                  <div>
                    <Dialog.Title className="text-base font-semibold">{title}</Dialog.Title>
                    {description ? (
                      <Dialog.Description className="mt-0.5 text-sm text-fg-muted">{description}</Dialog.Description>
                    ) : (
                      <Dialog.Description className="sr-only">{title}</Dialog.Description>
                    )}
                  </div>
                  <Dialog.Close asChild>
                    <Button variant="ghost" size="icon" className="-mr-2 -mt-1 !size-8" aria-label="Kapat">
                      <X className="size-4" />
                    </Button>
                  </Dialog.Close>
                </div>
                <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
                {footer && <div className="flex justify-end gap-2 border-t border-border bg-surface-2/50 px-6 py-4">{footer}</div>}
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}

export const Modal = (p: BaseProps) => <Shell {...p} variant="modal" />;
export const Drawer = (p: BaseProps) => <Shell {...p} variant="drawer" />;

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Onayla',
  danger,
  loading,
  onConfirm,
  children,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  children?: ReactNode;
}) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Vazgeç</Button>
          <Button variant={danger ? 'danger' : 'primary'} loading={loading} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex gap-3">
        {danger && (
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-danger/12 text-danger">
            <AlertTriangle className="size-5" />
          </div>
        )}
        <div className="space-y-3 text-sm text-fg-muted">
          <p>{description}</p>
          {children}
        </div>
      </div>
    </Modal>
  );
}
