import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { Check, ChevronDown, Plus, Sparkles, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { keyOf, normalize, similarTo, validateLabel } from '@/lib/text';
import { Field } from './Form';

export interface ComboOption {
  value: string;
  label: string;
  hint?: string;
}

interface Props {
  label?: string;
  /** Saklanan değer (etiket değil): örn. tür için "LAPTOP", marka için "Dell" */
  value: string;
  onChange: (value: string) => void;
  options: (ComboOption | string)[];
  placeholder?: string;
  /** Listede olmayan değerin yazılarak eklenmesine izin verir (varsayılan: açık) */
  allowCreate?: boolean;
  /** Filtre modu: "Tümü" gibi boş seçenek etiketi; seçilince value='' olur */
  clearLabel?: string;
  /** Yazılan değeri (yeni eklenirken) çözümler: örn. "dizüstü" → LAPTOP. Varsayılan: normalize edilmiş metin */
  resolve?: (typed: string) => { value: string; label: string };
  /** Ek doğrulama; hata mesajı döndürür */
  validate?: (typed: string) => string | undefined;
  min?: number;
  max?: number;
  fieldLabel?: string;
  error?: string;
  hint?: string;
  disabled?: boolean;
  id?: string;
  'aria-label'?: string;
  className?: string;
}

const toOpt = (o: ComboOption | string): ComboOption => (typeof o === 'string' ? { value: o, label: o } : o);

/**
 * Seçenekli + yazılabilir giriş (combobox). Listeden seçilir ya da yoksa yazılıp eklenir.
 * Yazılan değer denetlenir (uzunluk/karakter), mevcut bir kayıtla aynıysa o yazıma birleştirilir
 * (örn. "dell" → "Dell") ve yakın yazımlar için "Şunu mu demek istediniz?" önerisi gösterilir.
 */
export function Combobox({
  label, value, onChange, options, placeholder, allowCreate = true, clearLabel, resolve, validate, min = 2, max = 80,
  fieldLabel, error, hint, disabled, id, className, ...rest
}: Props) {
  const auto = useId();
  const fid = id ?? auto;
  const listId = `${fid}-list`;
  const opts = useMemo(() => options.map(toOpt), [options]);
  const current = opts.find((o) => o.value === value);
  const shown = value === '' ? '' : (current?.label ?? value);

  const [text, setText] = useState(shown);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [localError, setLocalError] = useState<string | undefined>();
  const [typing, setTyping] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  // Dışarıdan değer değişince (form sıfırlama vb.) metni eşitle
  useEffect(() => {
    if (!typing) setText(shown);
  }, [shown, typing]);

  const typedKey = keyOf(text);
  const filtered = useMemo(() => {
    if (!typing || !typedKey) return opts;
    const starts = opts.filter((o) => keyOf(o.label).startsWith(typedKey));
    const contains = opts.filter((o) => !keyOf(o.label).startsWith(typedKey) && keyOf(o.label).includes(typedKey));
    return [...starts, ...contains];
  }, [opts, typing, typedKey]);

  const exact = opts.find((o) => keyOf(o.label) === typedKey || keyOf(o.value) === typedKey);
  const similar = useMemo(() => (allowCreate && typing && typedKey && !exact ? similarTo(text, opts, (o) => o.label) : []), [allowCreate, typing, typedKey, exact, text, opts]);
  const canCreate = allowCreate && typing && typedKey.length > 0 && !exact;

  // Liste öğeleri: [Tümü] + filtrelenmiş seçenekler + [Yeni ekle]
  type Item = { kind: 'clear' } | { kind: 'opt'; o: ComboOption } | { kind: 'create' };
  const items: Item[] = [
    ...(clearLabel ? [{ kind: 'clear' } as Item] : []),
    ...filtered.map((o) => ({ kind: 'opt', o }) as Item),
    ...(canCreate ? [{ kind: 'create' } as Item] : []),
  ];
  // Liste açılınca mevcut seçim vurgulanır; yazarken ilk sonuç vurgulanır
  useEffect(() => {
    const i = typing ? 0 : items.findIndex((it) => it.kind === 'opt' && it.o.value === value);
    setActive(Math.max(0, i));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typedKey, open]);

  const close = () => {
    setOpen(false);
    setTyping(false);
  };

  const pick = (o: ComboOption) => {
    onChange(o.value);
    setText(o.label);
    setLocalError(undefined);
    close();
  };

  const createFromText = (): boolean => {
    const typed = normalize(text);
    const msg = validate?.(typed) ?? validateLabel(typed, { min, max, label: fieldLabel ?? label ?? 'Değer' });
    if (msg) {
      setLocalError(msg);
      return false;
    }
    const r = resolve ? resolve(typed) : { value: typed, label: typed };
    onChange(r.value);
    setText(r.label);
    setLocalError(undefined);
    close();
    return true;
  };

  /** Odak kaybında / Enter'da yazılanı sonuçlandır */
  const commit = () => {
    if (!typing) return;
    const typed = normalize(text);
    if (!typed) {
      if (clearLabel || !current) {
        onChange('');
        setText('');
        setLocalError(undefined);
      }
      return close();
    }
    const hit = opts.find((o) => keyOf(o.label) === keyOf(typed) || keyOf(o.value) === keyOf(typed));
    if (hit) return pick(hit);
    if (allowCreate) {
      if (!createFromText()) setOpen(false); // hata gösterilir, metin korunur
      return;
    }
    // Listede yok ve ekleme kapalı: önceki değere dön
    setText(shown);
    setLocalError(undefined);
    close();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) return setOpen(true);
      setActive((a) => Math.min(a + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      if (open && typing && items[active]) {
        e.preventDefault();
        const it = items[active]!;
        if (it.kind === 'opt') pick(it.o);
        else if (it.kind === 'clear') (onChange(''), setText(''), close());
        else createFromText();
      } else if (typing) {
        e.preventDefault();
        commit();
      } else if (open && items[active]) {
        e.preventDefault();
        const it = items[active]!;
        if (it.kind === 'opt') pick(it.o);
        else if (it.kind === 'clear') (onChange(''), setText(''), close());
      }
    } else if (e.key === 'Escape') {
      if (open) {
        e.preventDefault();
        e.stopPropagation(); // üstteki çekmece/pencere kapanmasın
        setText(shown);
        setLocalError(undefined);
        close();
      }
    }
  };

  const shownError = error ?? localError;
  const isNew = !!value && !current && !typing;

  return (
    <Field label={label} error={shownError} hint={!shownError ? hint : undefined} htmlFor={fid}>
      <Popover.Root open={open && !disabled} onOpenChange={(o) => !o && close()}>
        <Popover.Anchor asChild>
          <div className="relative">
            <input
              ref={input}
              id={fid}
              role="combobox"
              aria-expanded={open}
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={open && items[active] ? `${fid}-opt-${active}` : undefined}
              aria-invalid={!!shownError}
              aria-label={rest['aria-label']}
              autoComplete="off"
              spellCheck={false}
              disabled={disabled}
              value={text}
              placeholder={placeholder ?? (clearLabel ?? 'Seçin veya yazın')}
              onFocus={() => setOpen(true)}
              onClick={() => setOpen(true)}
              onChange={(e) => {
                setText(e.target.value);
                setTyping(true);
                setOpen(true);
                setLocalError(undefined);
              }}
              onBlur={commit}
              onKeyDown={onKeyDown}
              className={cn(
                'h-10 w-full rounded-xl border border-border bg-surface px-3.5 pr-16 text-sm text-fg shadow-sm transition placeholder:text-fg-subtle hover:border-border-strong focus:border-accent focus:outline-none focus:ring-4 focus:ring-[var(--ring)]/40 disabled:opacity-60 aria-[invalid=true]:border-danger',
                className,
              )}
            />
            <span className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center gap-0.5">
              {value && !disabled && (clearLabel || allowCreate) && (
                <button type="button" tabIndex={-1} aria-label="Temizle" onMouseDown={(e) => e.preventDefault()} onClick={() => { onChange(''); setText(''); setTyping(false); setLocalError(undefined); input.current?.focus(); }} className="flex size-7 items-center justify-center rounded-lg text-fg-subtle hover:bg-surface-hover hover:text-fg"><X className="size-3.5" /></button>
              )}
              <button type="button" tabIndex={-1} aria-label="Seçenekleri aç" onMouseDown={(e) => e.preventDefault()} onClick={() => { setOpen((o) => !o); input.current?.focus(); }} className="flex size-7 items-center justify-center rounded-lg text-fg-subtle hover:text-fg"><ChevronDown className={cn('size-4 transition', open && 'rotate-180')} /></button>
            </span>
          </div>
        </Popover.Anchor>
        <Popover.Portal>
          <Popover.Content
            align="start"
            sideOffset={6}
            onOpenAutoFocus={(e) => e.preventDefault()}
            onCloseAutoFocus={(e) => e.preventDefault()}
            onInteractOutside={(e) => { if (input.current && e.target instanceof Node && input.current.contains(e.target)) e.preventDefault(); }}
            className="z-[80] w-[var(--radix-popper-anchor-width)] min-w-[200px] overflow-hidden rounded-xl border border-border bg-surface p-1 shadow-lg outline-none"
          >
            {similar.length > 0 && (
              <div className="mb-1 rounded-lg bg-warning/12 px-2.5 py-2 text-xs text-warning" role="note">
                <p className="mb-1.5 flex items-center gap-1.5 font-medium"><Sparkles className="size-3.5" />Şunu mu demek istediniz?</p>
                <div className="flex flex-wrap gap-1.5">
                  {similar.map((o) => (
                    <button key={o.value} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(o)} className="rounded-md bg-surface px-2 py-0.5 font-medium text-fg shadow-sm hover:bg-accent-soft">{o.label}</button>
                  ))}
                </div>
              </div>
            )}
            <ul id={listId} role="listbox" aria-label={label ?? 'Seçenekler'} className="max-h-56 overflow-y-auto">
              {items.map((it, i) => {
                const isActive = i === active;
                const base = cn('flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm', isActive ? 'bg-accent-soft' : 'hover:bg-surface-hover');
                if (it.kind === 'clear') {
                  return (
                    <li key="clear" id={`${fid}-opt-${i}`} role="option" aria-selected={value === ''} onMouseDown={(e) => e.preventDefault()} onMouseMove={() => setActive(i)} onClick={() => { onChange(''); setText(''); close(); }} className={base}>
                      <span className="flex-1 font-medium text-fg-muted">{clearLabel}</span>{value === '' && <Check className="size-4 text-accent" />}
                    </li>
                  );
                }
                if (it.kind === 'create') {
                  return (
                    <li key="create" id={`${fid}-opt-${i}`} role="option" aria-selected={false} onMouseDown={(e) => e.preventDefault()} onMouseMove={() => setActive(i)} onClick={() => createFromText()} className={cn(base, 'mt-0.5 border-t border-border')}>
                      <Plus className="size-4 text-accent" /><span className="min-w-0 flex-1 truncate">“<b className="font-semibold">{normalize(text)}</b>” olarak ekle</span><span className="rounded-md bg-accent-soft px-1.5 py-0.5 text-[10px] font-semibold text-accent">YENİ</span>
                    </li>
                  );
                }
                const selected = it.o.value === value;
                return (
                  <li key={it.o.value} id={`${fid}-opt-${i}`} role="option" aria-selected={selected} onMouseDown={(e) => e.preventDefault()} onMouseMove={() => setActive(i)} onClick={() => pick(it.o)} className={base}>
                    <span className="min-w-0 flex-1 truncate">{it.o.label}</span>
                    {it.o.hint && <span className="text-xs text-fg-subtle">{it.o.hint}</span>}
                    {selected && <Check className="size-4 text-accent" />}
                  </li>
                );
              })}
              {filtered.length === 0 && !canCreate && <li role="presentation" className="px-3 py-4 text-center text-sm text-fg-subtle">{allowCreate ? 'Yazmaya başlayın' : 'Sonuç yok'}</li>}
            </ul>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      {isNew && !shownError && <p className="mt-1.5 flex items-center gap-1.5 text-xs text-info"><Plus className="size-3" />Yeni değer olarak kaydedilecek</p>}
    </Field>
  );
}
