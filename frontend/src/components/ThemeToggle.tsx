import * as Menu from '@radix-ui/react-dropdown-menu';
import { AnimatePresence, motion } from 'framer-motion';
import { Monitor, Moon, Sun, type LucideIcon } from 'lucide-react';
import { useTheme, type Theme } from '@/lib/theme';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/Button';

export function ThemeToggle() {
  const { theme, setTheme, resolved } = useTheme();
  const opts: { v: Theme; label: string; icon: LucideIcon }[] = [
    { v: 'light', label: 'Açık', icon: Sun },
    { v: 'dark', label: 'Koyu', icon: Moon },
    { v: 'system', label: 'Sistem', icon: Monitor },
  ];
  return (
    <Menu.Root>
      <Menu.Trigger asChild>
        <Button variant="ghost" size="icon" aria-label="Tema">
          <AnimatePresence mode="wait" initial={false}>
            <motion.span key={resolved} initial={{ rotate: -60, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 60, opacity: 0 }} transition={{ duration: 0.15 }}>
              {resolved === 'dark' ? <Moon className="size-[18px]" /> : <Sun className="size-[18px]" />}
            </motion.span>
          </AnimatePresence>
        </Button>
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content align="end" sideOffset={8} className="z-50 min-w-36 rounded-xl border border-border bg-surface p-1.5 shadow-lg">
          {opts.map(({ v, label, icon: Icon }) => (
            <Menu.Item key={v} onSelect={() => setTheme(v)} className={cn('flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm outline-none data-[highlighted]:bg-surface-hover', theme === v && 'text-accent')}>
              <Icon className="size-4" /> {label}
            </Menu.Item>
          ))}
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}
