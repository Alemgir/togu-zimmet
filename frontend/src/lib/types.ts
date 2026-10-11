export type Role = 'ADMIN' | 'UNIT_MANAGER' | 'STAFF';
/** Yerleşik kod (LAPTOP…) ya da kullanıcının yazdığı özel tür adı */
export type DeviceType = string;
export type DeviceStatus = 'IN_STOCK' | 'ASSIGNED' | 'FAULTY' | 'RETIRED';
export type ReturnReason = 'MANUAL' | 'FAULT_REPORTED' | 'USER_DEACTIVATED' | 'RETIRED' | 'REASSIGNED';
export type EventType = 'CREATED' | 'UPDATED' | 'ASSIGNED' | 'RETURNED' | 'STATUS_CHANGED' | 'FAULT_REPORTED';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  department: string | null;
  title: string | null;
  isActive: boolean;
  createdAt: string;
  activeDeviceCount?: number;
}

export interface Holder {
  id: string;
  name: string;
  email: string;
  department: string | null;
  title: string | null;
}

export interface Device {
  id: string;
  assetTag: string;
  type: DeviceType;
  brand: string;
  model: string;
  serialNumber: string;
  purchaseDate: string;
  warrantyEnd: string | null;
  status: DeviceStatus;
  location: string | null;
  notes: string | null;
  qrToken: string;
  createdAt: string;
  holder: Holder | null;
  assignedAt: string | null;
  dueAt: string | null;
  assignmentId: string | null;
}

export interface AssignmentRecord {
  id: string;
  assignedAt: string;
  returnedAt: string | null;
  returnReason: ReturnReason | null;
  note: string | null;
  returnNote: string | null;
  dueAt: string | null;
  receiptNo: number;
  user: { id: string; name: string; department: string | null };
  assignedBy: { id: string; name: string };
  returnedBy: { id: string; name: string } | null;
  device?: Pick<Device, 'id' | 'assetTag' | 'brand' | 'model' | 'type'>;
}

export interface DeviceEventRecord {
  id: string;
  type: EventType;
  message: string;
  createdAt: string;
  actor: { id: string; name: string } | null;
}

export interface Paged<T> {
  data: T[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

export type FaultStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';

export interface FaultTicket {
  id: string;
  ticketNo: number;
  status: FaultStatus;
  description: string;
  resolution: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  device: Pick<Device, 'id' | 'assetTag' | 'brand' | 'model' | 'type' | 'status' | 'location'>;
  reportedBy: { id: string; name: string; department: string | null } | null;
  handledBy: { id: string; name: string } | null;
}

export type NotificationType = 'FAULT_REPORTED' | 'FAULT_UPDATED' | 'ASSIGNED' | 'RETURNED' | 'WARRANTY_EXPIRING' | 'ASSIGNMENT_DUE' | 'ASSIGNMENT_OVERDUE';
export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface DashboardData {
  scope: 'all' | 'department' | 'self';
  type: DeviceType | null;
  totals: { devices: number; users: number; inStock: number; assigned: number; faulty: number; retired: number };
  trend: { devices: number[]; assigned: number[]; faulty: number[]; inStock: number[] };
  deltas: { devices: number; assigned: number; inStock: number; faulty: number };
  byType: { type: DeviceType; count: number }[];
  byDepartment: { department: string; count: number }[];
  attention: {
    faults: { id: string; ticketNo: number; status: FaultStatus; description: string; createdAt: string; reportedBy: string | null; device: { id: string; assetTag: string; brand: string; model: string; location: string | null } }[];
    warranty: { id: string; assetTag: string; brand: string; model: string; warrantyEnd: string; days: number }[];
    overdue: { id: string; dueAt: string; days: number; user: { id: string; name: string }; device: { id: string; assetTag: string; brand: string; model: string } }[];
    stale: { count: number; items: { id: string; assetTag: string; brand: string; model: string; days: number }[] };
  };
  recentEvents: (DeviceEventRecord & { device: { id: string; assetTag: string; brand: string; model: string } })[];
}

export interface ReportData {
  type: DeviceType | null;
  total: number;
  health: { score: number; grade: 'excellent' | 'good' | 'warning' | 'critical'; utilization: number; faultyRate: number; expiredWarrantyRate: number; oldRate: number };
  byType: { type: DeviceType; count: number }[];
  status: Record<DeviceStatus, number>;
  ageBuckets: number[];
  warrantyMonths: number[];
  renewal: { year: number; count: number }[];
  byDepartment: { department: string; count: number }[];
  activity: { date: string; assigned: number; returned: number }[];
}

export interface CountProgress {
  expected: number;
  scanned: number;
  missing: number;
  unexpected: number;
}
export interface CountSessionRecord {
  id: string;
  name: string;
  location: string | null;
  status: 'OPEN' | 'CLOSED';
  createdAt: string;
  closedAt: string | null;
  createdBy: { name: string };
  progress?: CountProgress;
}
export interface CountItemRecord {
  id: string;
  expected: boolean;
  scannedAt: string | null;
  scannedBy: { name: string } | null;
  device: Pick<Device, 'id' | 'assetTag' | 'brand' | 'model' | 'type' | 'location' | 'status'>;
}
