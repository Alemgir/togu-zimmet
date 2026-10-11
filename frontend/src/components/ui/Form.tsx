import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';

const control =
  'w-full rounded-xl border border-border bg-surface px-3.5 text-sm text-fg shadow-sm transition placeholder:text-fg-subtle hover:border-border-strong focus:border-accent focus:outline-none focus:ring-4 focus:ring-[var(--ring)]/40 disabled:opacity-60 aria-[invalid=true]:border-danger';

export function Field({ label, error, hint, children, htmlFor }: { label?: string; error?: string; hint?: string; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={htmlFor} className="block text-[13px] font-medium text-fg-muted">
          {label}
        </label>
      )}
      {children}
      {error ? (
        <p role="alert" className="text-xs text-danger">{error}</p>
      ) : hint ? (
        <p className="text-xs text-fg-subtle">{hint}</p>
      ) : null}
    </div>
  );
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: ReactNode;
}
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ label, error, hint, icon, className, id, ...rest }, ref) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <Field label={label} error={error} hint={hint} htmlFor={fid}>
      <div className="relative">
        {icon && <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-subtle">{icon}</span>}
        <input ref={ref} id={fid} aria-invalid={!!error} className={cn(control, 'h-10', icon && 'pl-10', className)} {...rest} />
      </div>
    </Field>
  );
});

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
}
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select({ label, error, className, id, children, ...rest }, ref) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <Field label={label} error={error} htmlFor={fid}>
      <div className="relative">
        <select ref={ref} id={fid} aria-invalid={!!error} className={cn(control, 'h-10 appearance-none pr-9', className)} {...rest}>
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" aria-hidden />
      </div>
    </Field>
  );
});

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea({ label, error, className, id, ...rest }, ref) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <Field label={label} error={error} htmlFor={fid}>
      <textarea ref={ref} id={fid} aria-invalid={!!error} className={cn(control, 'min-h-[88px] resize-y py-2.5', className)} {...rest} />
    </Field>
  );
});
