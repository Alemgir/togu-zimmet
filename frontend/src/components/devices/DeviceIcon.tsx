import { Box, Camera, Cpu, HardDrive, Headphones, Keyboard, Laptop, Monitor, Mouse, Presentation, Printer, Projector, Router, ScanLine, Server, Smartphone, Speaker, Tablet, Tv, Zap, type LucideIcon } from 'lucide-react';
import { keyOf } from '@/lib/text';
import { cn } from '@/lib/cn';

const BUILTIN: Record<string, LucideIcon> = {
  LAPTOP: Laptop, DESKTOP: Cpu, SERVER: Server, MONITOR: Monitor, PRINTER: Printer, PHONE: Smartphone, TABLET: Tablet, NETWORK: Router, OTHER: Box,
};

// Özel (yazılan) türler için anahtar kelimeden simge tahmini; bulunamazsa genel kutu simgesi
const KEYWORDS: [RegExp, LucideIcon][] = [
  [/projeksiyon|projector/, Projector],
  [/akıllı tahta|tahta|sunum/, Presentation],
  [/\bups\b|güç kayna|enerji/, Zap],
  [/kamera|camera/, Camera],
  [/tarayıcı|scanner|barkod/, ScanLine],
  [/klavye|keyboard/, Keyboard],
  [/mouse|fare/, Mouse],
  [/kulaklık|headset/, Headphones],
  [/hoparlör|speaker/, Speaker],
  [/disk|depolama|nas/, HardDrive],
  [/televizyon|\btv\b|ekran/, Tv],
  [/switch|router|modem|access point|ağ/, Router],
];

export function iconFor(type: string): LucideIcon {
  if (BUILTIN[type]) return BUILTIN[type]!;
  const k = keyOf(type);
  return KEYWORDS.find(([re]) => re.test(k))?.[1] ?? Box;
}

export function DeviceIcon({ type, className, size = 'md' }: { type: string; className?: string; size?: 'sm' | 'md' | 'lg' }) {
  const Icon = iconFor(type);
  const box = size === 'lg' ? 'size-14 rounded-2xl' : size === 'sm' ? 'size-8 rounded-lg' : 'size-10 rounded-xl';
  const ic = size === 'lg' ? 'size-7' : size === 'sm' ? 'size-4' : 'size-5';
  return (
    <span className={cn('flex shrink-0 items-center justify-center bg-accent-soft text-accent', box, className)}>
      <Icon className={ic} strokeWidth={1.8} />
    </span>
  );
}
