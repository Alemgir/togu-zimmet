import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as Dialog from '@radix-ui/react-dialog';
import { AnimatePresence, motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, BarChart3, Boxes, ClipboardCheck, ClipboardList, CornerDownLeft, LayoutDashboard, Laptop, Search, UserRound, Users, Wrench } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useDebounced } from '@/lib/useDebounced';
import { cn } from '@/lib/cn';
import type { Device, Paged, User } from '@/lib/types';

interface Item {
  id: string;
  label: string;
  hint?: string;
  icon: React.ReactNode;
  to: string;
  group: string;
}

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const navigate = useNavigate();
  const { isAdmin, isManager } = useAuth();
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const dq = useDebounced(q.trim(), 200);

  useEffect(() => {
    if (open) {
      setQ('');
      setActive(0);
    }
  }, [open]);

  const devices = useQuery({
    queryKey: ['palette-devices', dq],
    enabled: open && dq.length > 0,
    queryFn: async () => (await api.get<Paged<Device>>('/devices', { params: { search: dq, pageSize: 5 } })).data.data,
  });
  const users = useQuery({
    queryKey: ['palette-users', dq],
    enabled: open && dq.length > 0 && isManager,
    queryFn: async () => (await api.get<Paged<User>>('/users', { params: { search: dq, pageSize: 4 } })).data.data,
  });

  const items = useMemo<Item[]>(() => {
    const nav: Item[] = isManager
      ? [
          { id: 'n1', label: 'Panel', icon: <LayoutDashboard className="size-4" />, to: '/', group: 'Git' },
          { id: 'n2', label: 'Envanter', icon: <Boxes className="size-4" />, to: '/devices', group: 'Git' },
          { id: 'n3', label: 'Zimmetler', icon: <ClipboardList className="size-4" />, to: '/assignments', group: 'Git' },
          { id: 'n4', label: 'Arızalar', icon: <Wrench className="size-4" />, to: '/faults', group: 'Git' },
          ...(isAdmin ? [{ id: 'n5', label: 'Envanter sayımı', icon: <ClipboardCheck className="size-4" />, to: '/counts', group: 'Git' }] : []),
          { id: 'n6', label: 'Raporlar', icon: <BarChart3 className="size-4" />, to: '/reports', group: 'Git' },
          { id: 'n7', label: 'Kullanıcılar', icon: <Users className="size-4" />, to: '/users', group: 'Git' },
        ]
      : [
          { id: 'n1', label: 'Zimmetlerim', icon: <Laptop className="size-4" />, to: '/', group: 'Git' },
          { id: 'n2', label: 'Arızalarım', icon: <Wrench className="size-4" />, to: '/faults', group: 'Git' },
        ];
    // Sayfa adları gecikmesiz (yazılan anında) süzülür; böylece hızlı yazıp Enter'a basınca doğru sayfa seçilir
    const nq = q.trim().toLocaleLowerCase('tr');
    const filtered = nq ? nav.filter((n) => n.label.toLocaleLowerCase('tr').includes(nq)) : nav;
    const fresh = dq === q.trim(); // cihaz/kişi sonuçları yalnızca güncel aramaya aitse gösterilir
    const d: Item[] = (fresh ? (devices.data ?? []) : []).map((x) => ({
      id: `d${x.id}`,
      label: `${x.brand} ${x.model}`,
      hint: `${x.assetTag}${x.holder ? ` · ${x.holder.name}` : ''}`,
      icon: <Laptop className="size-4" />,
      to: `/devices/${x.id}`,
      group: 'Cihazlar',
    }));
    const u: Item[] = (fresh ? (users.data ?? []) : []).map((x) => ({
      id: `u${x.id}`,
      label: x.name,
      hint: x.department ?? x.email,
      icon: <UserRound className="size-4" />,
      to: `/users?search=${encodeURIComponent(x.name)}`,
      group: 'Kullanıcılar',
    }));
    return [...filtered, ...d, ...u];
  }, [isAdmin, isManager, q, dq, devices.data, users.data]);

  useEffect(() => setActive(0), [items.length]);

  const run = (it?: Item) => {
    if (!it) return;
    onOpenChange(false);
    navigate(it.to);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') (e.preventDefault(), setActive((a) => Math.min(a + 1, items.length - 1)));
    else if (e.key === 'ArrowUp') (e.preventDefault(), setActive((a) => Math.max(a - 1, 0)));
    else if (e.key === 'Enter') (e.preventDefault(), run(items[active]));
  };

  let lastGroup = '';
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-[3px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
            </Dialog.Overlay>
            <Dialog.Content asChild forceMount onKeyDown={onKeyDown}>
              <motion.div
                className="fixed left-1/2 top-[14vh] z-[60] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-2xl border border-border bg-surface shadow-lg outline-none"
                initial={{ opacity: 0, y: -12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.98 }}
                transition={{ type: 'spring', stiffness: 460, damping: 36 }}
              >
                <Dialog.Title className="sr-only">Komut paleti</Dialog.Title>
                <Dialog.Description className="sr-only">Sayfa, cihaz veya kullanıcı arayın</Dialog.Description>
                <div className="flex items-center gap-3 border-b border-border px-4">
                  <Search className="size-4 text-fg-subtle" />
                  <input
                    autoFocus
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder={isManager ? 'Cihaz, seri no, kişi veya sayfa ara…' : 'Sayfa ara…'}
                    className="h-14 flex-1 bg-transparent text-[15px] outline-none placeholder:text-fg-subtle"
                  />
                  <kbd className="rounded-md border border-border px-1.5 py-0.5 text-[11px] text-fg-subtle">Esc</kbd>
                </div>
                <div className="max-h-[50vh] overflow-y-auto p-2">
                  {items.length === 0 && (
                    <p className="px-3 py-10 text-center text-sm text-fg-muted">
                      {devices.isFetching || users.isFetching ? 'Aranıyor…' : 'Sonuç bulunamadı'}
                    </p>
                  )}
                  {items.map((it, i) => {
                    const header = it.group !== lastGroup ? ((lastGroup = it.group), it.group) : null;
                    return (
                      <div key={it.id}>
                        {header && <p className="px-3 pb-1 pt-3 text-[11px] font-medium uppercase tracking-wider text-fg-subtle">{header}</p>}
                        <button
                          onMouseMove={() => setActive(i)}
                          onClick={() => run(it)}
                          className={cn('flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors', i === active ? 'bg-accent-soft text-fg' : 'text-fg-muted')}
                        >
                          <span className={cn('flex size-8 items-center justify-center rounded-lg', i === active ? 'bg-accent text-accent-fg' : 'bg-surface-2')}>{it.icon}</span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium text-fg">{it.label}</span>
                            {it.hint && <span className="block truncate text-xs text-fg-subtle">{it.hint}</span>}
                          </span>
                          {i === active && <CornerDownLeft className="size-3.5 text-fg-subtle" />}
                          {i !== active && <ArrowRight className="size-3.5 opacity-0" />}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
