import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { AssignmentRecord, CountItemRecord, CountProgress, CountSessionRecord, DashboardData, Device, DeviceEventRecord, DeviceStatus, DeviceType, FaultStatus, FaultTicket, NotificationItem, Paged, ReportData, User } from '@/lib/types';

type Params = Record<string, string | number | boolean | undefined | null>;
const clean = (p: Params) => Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined && v !== null && v !== ''));

/* ───── Sorgular ───── */
export const useDashboard = (type?: DeviceType | null) =>
  useQuery({
    queryKey: ['dashboard', type ?? null],
    queryFn: async () => (await api.get<DashboardData>('/dashboard', { params: type ? { type } : {} })).data,
    placeholderData: keepPreviousData,
    refetchInterval: 20_000, // "canlı" akış
  });

export const useReport = (type?: DeviceType | null) =>
  useQuery({
    queryKey: ['report', type ?? null],
    queryFn: async () => (await api.get<ReportData>('/reports/summary', { params: type ? { type } : {} })).data,
    placeholderData: keepPreviousData,
  });

export const useNotifications = () =>
  useQuery({
    queryKey: ['notifications'],
    queryFn: async () => (await api.get<{ data: NotificationItem[]; unread: number }>('/notifications')).data,
    refetchInterval: 30_000,
  });

export const useFaultBoard = () =>
  useQuery({
    queryKey: ['fault-board'],
    queryFn: async () => (await api.get<Record<FaultStatus, FaultTicket[]>>('/faults/board')).data,
    refetchInterval: 30_000,
  });

export const useFaults = (params: Params) =>
  useQuery({
    queryKey: ['faults', params],
    queryFn: async () => (await api.get<Paged<FaultTicket>>('/faults', { params: clean(params) })).data,
    placeholderData: keepPreviousData,
  });

export const useFault = (id?: string | null) =>
  useQuery({
    queryKey: ['fault', id],
    enabled: !!id,
    queryFn: async () => (await api.get<{ ticket: FaultTicket; events: (DeviceEventRecord & { actor: { name: string } | null })[] }>(`/faults/${id}`)).data,
  });

export const useCounts = () =>
  useQuery({ queryKey: ['counts'], queryFn: async () => (await api.get<{ data: CountSessionRecord[] }>('/counts')).data.data });

export const useCount = (id: string | undefined, params: Params) =>
  useQuery({
    queryKey: ['count', id, params],
    enabled: !!id,
    queryFn: async () => (await api.get<Paged<CountItemRecord> & { session: CountSessionRecord; progress: CountProgress }>(`/counts/${id}`, { params: clean(params) })).data,
    placeholderData: keepPreviousData,
  });

export const useAssignment = (id?: string) =>
  useQuery({
    queryKey: ['assignment', id],
    enabled: !!id,
    queryFn: async () =>
      (
        await api.get<{
          assignment: AssignmentRecord & {
            device: Device;
            user: { id: string; name: string; email: string; department: string | null; title: string | null };
            assignedBy: { id: string; name: string; title: string | null };
            returnedBy: { id: string; name: string; title: string | null } | null;
          };
        }>(`/assignments/${id}`)
      ).data.assignment,
  });

export const useDevices = (params: Params) =>
  useQuery({
    queryKey: ['devices', params],
    queryFn: async () => (await api.get<Paged<Device>>('/devices', { params: clean(params) })).data,
    placeholderData: keepPreviousData,
  });

export interface DeviceDetail {
  device: Device;
  history: AssignmentRecord[];
  events: (DeviceEventRecord & { meta?: unknown })[];
  faults: (FaultTicket & { reportedBy: { name: string } | null })[];
}
export const useDevice = (id?: string) =>
  useQuery({ queryKey: ['device', id], enabled: !!id, queryFn: async () => (await api.get<DeviceDetail>(`/devices/${id}`)).data });

export const useMyDevices = () =>
  useQuery({
    queryKey: ['my-devices'],
    queryFn: async () => (await api.get<{ data: (Device & { assignmentNote: string | null; receiptNo: number })[] }>('/devices/mine')).data.data,
  });

export const useDeviceQr = (id?: string) =>
  useQuery({
    queryKey: ['device-qr', id],
    enabled: !!id,
    staleTime: Infinity,
    queryFn: async () => (await api.get<{ assetTag: string; payload: string; dataUrl: string; svg: string }>(`/devices/${id}/qr`)).data,
  });

/** Seçenek listeleri: marka, konum ve (yerleşik + özel) cihaz türleri */
export const useDeviceMeta = () =>
  useQuery({
    queryKey: ['device-meta'],
    staleTime: 30_000,
    queryFn: async () => (await api.get<{ brands: string[]; locations: string[]; types: string[] }>('/devices/meta')).data,
  });
export const useBrands = () => {
  const q = useDeviceMeta();
  return { ...q, data: q.data?.brands };
};

export const useTitles = () =>
  useQuery({ queryKey: ['titles'], staleTime: 30_000, queryFn: async () => (await api.get<{ titles: string[] }>('/meta/titles')).data.titles });

export const useDepartments = (enabled = true) =>
  useQuery({
    queryKey: ['departments'],
    enabled,
    queryFn: async () => (await api.get<{ departments: string[] }>('/meta/departments')).data.departments,
  });

export const useUsers = (params: Params) =>
  useQuery({
    queryKey: ['users', params],
    queryFn: async () => (await api.get<Paged<User>>('/users', { params: clean(params) })).data,
    placeholderData: keepPreviousData,
  });

export interface UserDetail {
  user: User;
  activeAssignments: (AssignmentRecord & { device: Device })[];
  history: (AssignmentRecord & { device: Device })[];
}
export const useUser = (id?: string) =>
  useQuery({ queryKey: ['user', id], enabled: !!id, queryFn: async () => (await api.get<UserDetail>(`/users/${id}`)).data });

export const useAssignments = (params: Params) =>
  useQuery({
    queryKey: ['assignments', params],
    queryFn: async () => (await api.get<Paged<AssignmentRecord>>('/assignments', { params: clean(params) })).data,
    placeholderData: keepPreviousData,
  });

/* ───── Mutasyonlar ─────
   Zimmet/durum işlemleri birçok ekranı etkilediği için (örn. otomatik zimmet düşme)
   başarıdan sonra tüm sorgular tazelenir. */
function useAction<TVars, TRes>(fn: (v: TVars) => Promise<TRes>) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries() });
}

export type DeviceInput = {
  type: string;
  brand: string;
  model: string;
  serialNumber: string;
  purchaseDate: string;
  warrantyEnd?: string;
  location?: string;
  notes?: string;
};

export const useCreateDevice = () => useAction(async (b: DeviceInput) => (await api.post<{ device: Device }>('/devices', b)).data.device);
export const useUpdateDevice = () =>
  useAction(async ({ id, ...b }: Partial<DeviceInput> & { id: string }) => (await api.patch<{ device: Device }>(`/devices/${id}`, b)).data.device);
export const useDeleteDevice = () => useAction(async (id: string) => (await api.delete(`/devices/${id}`)).data);
export const useSetStatus = () =>
  useAction(async ({ id, status, note }: { id: string; status: DeviceStatus; note?: string }) =>
    (await api.patch<{ device: Device; autoReturned: boolean }>(`/devices/${id}/status`, { status, note })).data);
export const useReturnDevice = () =>
  useAction(async ({ id, ...b }: { id: string; note?: string; condition?: 'OK' | 'FAULTY' }) =>
    (await api.post<{ device: Device }>(`/devices/${id}/return`, b)).data);
export const useReportFault = () =>
  useAction(async ({ id, note }: { id: string; note?: string }) =>
    (await api.post<{ device: Device; autoReturned: boolean }>(`/devices/${id}/report-fault`, { note })).data);
export const useAssign = () =>
  useAction(async (b: { deviceId: string; userId: string; note?: string; transfer?: boolean; dueAt?: string | null }) =>
    (await api.post<{ assignment: AssignmentRecord }>('/assignments', b)).data.assignment);

export interface BulkOutcome {
  results: { deviceId: string; ok: boolean; error?: string }[];
  ok: number;
  failed: number;
}
export const useBulkAssign = () =>
  useAction(async (b: { deviceIds: string[]; userId: string; note?: string; transfer?: boolean; dueAt?: string | null }) => (await api.post<BulkOutcome>('/assignments/bulk', b)).data);
export const useBulkStatus = () =>
  useAction(async (b: { ids: string[]; status: DeviceStatus; note?: string }) => (await api.post<BulkOutcome>('/devices/bulk-status', b)).data);
export const useSetDue = () => useAction(async ({ id, dueAt }: { id: string; dueAt: string | null }) => (await api.patch(`/assignments/${id}`, { dueAt })).data);
export const useRemind = () => useAction(async (id: string) => (await api.post(`/assignments/${id}/remind`)).data);

export const useUpdateFault = () =>
  useAction(async ({ id, ...b }: { id: string; status?: FaultStatus; resolution?: string | null; handledById?: string | null }) =>
    (await api.patch<{ ticket: FaultTicket }>(`/faults/${id}`, b)).data.ticket);

export const useCreateCount = () =>
  useAction(async (b: { name: string; location?: string | null }) => (await api.post<{ session: CountSessionRecord; progress: CountProgress }>('/counts', b)).data);
export const useCloseCount = () => useAction(async (id: string) => (await api.post(`/counts/${id}/close`)).data);

/** Okutma sık yapıldığı için tüm sorguları değil yalnızca ilgili sayımı tazeler. */
export function useScan(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (code: string) =>
      (await api.post<{ result: 'ok' | 'duplicate' | 'unexpected'; device: { id: string; assetTag: string; brand: string; model: string; location: string | null }; progress: CountProgress }>(`/counts/${id}/scan`, { code })).data,
    meta: { silent: true },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['count', id] }),
  });
}

export function useNotificationActions() {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ['notifications'] });
  return {
    markRead: useMutation({ mutationFn: async (id: string) => api.post(`/notifications/${id}/read`), onSuccess: refresh, meta: { silent: true } }),
    readAll: useMutation({ mutationFn: async () => api.post('/notifications/read-all'), onSuccess: refresh }),
  };
}

/** Kimlik doğrulamalı dosya indirme (CSV dışa aktarma) */
export async function downloadFile(url: string, params: Params = {}) {
  const res = await api.get<Blob>(url, { params: clean(params), responseType: 'blob' });
  const cd = String(res.headers['content-disposition'] ?? '');
  const name = cd.match(/filename="([^"]+)"/)?.[1] ?? 'dosya.csv';
  const a = document.createElement('a');
  a.href = URL.createObjectURL(res.data);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  return name;
}

export async function fetchQrBatch(ids: string[]) {
  return (await api.post<{ data: { id: string; assetTag: string; brand: string; model: string; serialNumber: string; dataUrl: string }[] }>('/devices/qr-batch', { ids })).data.data;
}

export type UserInput = { name: string; email: string; role: string; department?: string; title?: string; password?: string };
export const useCreateUser = () => useAction(async (b: UserInput) => (await api.post<{ user: User }>('/users', b)).data.user);
export const useUpdateUser = () =>
  useAction(async ({ id, ...b }: Partial<Omit<UserInput, 'password'>> & { id: string; isActive?: boolean }) =>
    (await api.patch<{ user: User }>(`/users/${id}`, b)).data.user);
export const useResetPassword = () =>
  useAction(async ({ id, newPassword }: { id: string; newPassword: string }) => (await api.patch(`/users/${id}/password`, { newPassword })).data);
export const useDeleteUser = () =>
  useAction(async (id: string) => (await api.delete<{ mode: 'deleted' | 'deactivated'; releasedDevices: number }>(`/users/${id}`)).data);
