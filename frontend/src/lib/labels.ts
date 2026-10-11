import type { DeviceStatus, FaultStatus, ReturnReason, Role } from './types';

export const STATUS_LABEL: Record<DeviceStatus, string> = {
  IN_STOCK: 'Depoda',
  ASSIGNED: 'Zimmetli',
  FAULTY: 'Arızalı',
  RETIRED: 'Hizmet dışı',
};

export const STATUS_TONE: Record<DeviceStatus, 'info' | 'success' | 'danger' | 'neutral'> = {
  IN_STOCK: 'info',
  ASSIGNED: 'success',
  FAULTY: 'danger',
  RETIRED: 'neutral',
};

export const RETURN_REASON_LABEL: Record<ReturnReason, string> = {
  MANUAL: 'İade alındı',
  FAULT_REPORTED: 'Arıza nedeniyle düşüldü',
  USER_DEACTIVATED: 'Personel pasife alındı',
  RETIRED: 'Hizmet dışı bırakıldı',
  REASSIGNED: 'Devredildi',
};

export const STATUSES = Object.keys(STATUS_LABEL) as DeviceStatus[];
export { BUILTIN_TYPES as TYPES, TYPE_LABEL, typeColor, typeLabel } from './deviceTypes';

export const ROLE_LABEL: Record<Role, string> = { ADMIN: 'Yönetici', UNIT_MANAGER: 'Birim sorumlusu', STAFF: 'Personel' };
export const FAULT_LABEL: Record<FaultStatus, string> = { OPEN: 'Açık', IN_PROGRESS: 'İnceleniyor', RESOLVED: 'Çözüldü' };
export const FAULT_TONE: Record<FaultStatus, 'danger' | 'warning' | 'success'> = { OPEN: 'danger', IN_PROGRESS: 'warning', RESOLVED: 'success' };
export const faultNo = (n: number) => `AR-${String(n).padStart(5, '0')}`;
export const receiptNo = (n: number, at: string) => `ZT-${new Date(at).getFullYear()}-${String(n).padStart(6, '0')}`;

