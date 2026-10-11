import { lazyWithRetry } from '@/lib/lazyWithRetry';

export const Dashboard = lazyWithRetry(() => import('@/pages/Dashboard'));
export const MyDevices = lazyWithRetry(() => import('@/pages/MyDevices'));
export const Devices = lazyWithRetry(() => import('@/pages/Devices'));
export const DeviceDetail = lazyWithRetry(() => import('@/pages/DeviceDetail'));
export const Assignments = lazyWithRetry(() => import('@/pages/Assignments'));
export const UsersPage = lazyWithRetry(() => import('@/pages/Users'));
export const Profile = lazyWithRetry(() => import('@/pages/Profile'));
export const Scan = lazyWithRetry(() => import('@/pages/Scan'));
export const NotFound = lazyWithRetry(() => import('@/pages/NotFound'));
export const Faults = lazyWithRetry(() => import('@/pages/Faults'));
export const Reports = lazyWithRetry(() => import('@/pages/Reports'));
export const Counts = lazyWithRetry(() => import('@/pages/Counts'));
export const CountDetail = lazyWithRetry(() => import('@/pages/CountDetail'));
export const Labels = lazyWithRetry(() => import('@/pages/Labels'));
export const ReceiptPage = lazyWithRetry(() => import('@/pages/Receipt').then((m) => ({ default: m.ReceiptPage })));
export const PersonSheetPage = lazyWithRetry(() => import('@/pages/Receipt').then((m) => ({ default: m.PersonSheetPage })));

const ALL = [Dashboard, MyDevices, Devices, DeviceDetail, Assignments, UsersPage, Profile, Scan, Faults, Reports, Counts, CountDetail, Labels, ReceiptPage, PersonSheetPage];

/** Oturum açıldıktan sonra boşta kalınca tüm sayfa parçalarını önceden indirir: gezinme anında ağ beklenmez. */
export function preloadAllPages() {
  const run = () => ALL.forEach((p) => p.preload());
  if ('requestIdleCallback' in window) (window as unknown as { requestIdleCallback: (cb: () => void) => void }).requestIdleCallback(run);
  else setTimeout(run, 800);
}
