import 'package:flutter/material.dart';

enum Role { admin, unitManager, staff }

Role roleOf(String s) => switch (s) { 'ADMIN' => Role.admin, 'UNIT_MANAGER' => Role.unitManager, _ => Role.staff };

const roleLabel = {Role.admin: 'Yönetici', Role.unitManager: 'Birim sorumlusu', Role.staff: 'Personel'};

DateTime? _d(dynamic v) => v == null ? null : DateTime.parse(v as String);

class AppUser {
  AppUser({required this.id, required this.name, required this.email, required this.role, this.department, this.title, this.activeDeviceCount});
  final String id, name, email;
  final Role role;
  final String? department, title;
  final int? activeDeviceCount;

  bool get isAdmin => role == Role.admin;
  bool get isManager => role != Role.staff;

  factory AppUser.fromJson(Map<String, dynamic> j) => AppUser(
        id: j['id'],
        name: j['name'],
        email: j['email'],
        role: roleOf(j['role']),
        department: j['department'],
        title: j['title'],
        activeDeviceCount: j['activeDeviceCount'],
      );
}

class Holder {
  Holder({required this.id, required this.name, this.department, this.title, this.email});
  final String id, name;
  final String? department, title, email;
  factory Holder.fromJson(Map<String, dynamic> j) =>
      Holder(id: j['id'], name: j['name'], department: j['department'], title: j['title'], email: j['email']);
}

enum DeviceStatus { inStock, assigned, faulty, retired }

DeviceStatus statusOf(String s) => switch (s) {
      'IN_STOCK' => DeviceStatus.inStock,
      'ASSIGNED' => DeviceStatus.assigned,
      'FAULTY' => DeviceStatus.faulty,
      _ => DeviceStatus.retired,
    };

const statusLabel = {
  DeviceStatus.inStock: 'Depoda',
  DeviceStatus.assigned: 'Zimmetli',
  DeviceStatus.faulty: 'Arızalı',
  DeviceStatus.retired: 'Hizmet dışı',
};

class Device {
  Device({
    required this.id,
    required this.assetTag,
    required this.type,
    required this.brand,
    required this.model,
    required this.serialNumber,
    required this.purchaseDate,
    required this.status,
    this.warrantyEnd,
    this.location,
    this.notes,
    this.holder,
    this.assignedAt,
    this.dueAt,
    this.assignmentId,
    this.receiptNo,
  });

  final String id, assetTag, type, brand, model, serialNumber;
  final DateTime purchaseDate;
  final DateTime? warrantyEnd, assignedAt, dueAt;
  final DeviceStatus status;
  final String? location, notes, assignmentId;
  final Holder? holder;
  final int? receiptNo;

  String get title => '$brand $model';

  factory Device.fromJson(Map<String, dynamic> j) => Device(
        id: j['id'],
        assetTag: j['assetTag'],
        type: j['type'],
        brand: j['brand'],
        model: j['model'],
        serialNumber: j['serialNumber'],
        purchaseDate: _d(j['purchaseDate'])!,
        warrantyEnd: _d(j['warrantyEnd']),
        status: statusOf(j['status']),
        location: j['location'],
        notes: j['notes'],
        holder: j['holder'] == null ? null : Holder.fromJson(j['holder']),
        assignedAt: _d(j['assignedAt']),
        dueAt: _d(j['dueAt']),
        assignmentId: j['assignmentId'],
        receiptNo: j['receiptNo'],
      );
}

class DeviceEvent {
  DeviceEvent({required this.id, required this.type, required this.message, required this.createdAt, this.actor});
  final String id, type, message;
  final DateTime createdAt;
  final String? actor;
  factory DeviceEvent.fromJson(Map<String, dynamic> j) => DeviceEvent(
        id: j['id'],
        type: j['type'],
        message: j['message'],
        createdAt: _d(j['createdAt'])!,
        actor: j['actor']?['name'],
      );
}

class DeviceDetailData {
  DeviceDetailData(this.device, this.events);
  final Device device;
  final List<DeviceEvent> events;
}

class NotificationItem {
  NotificationItem({required this.id, required this.type, required this.title, required this.body, required this.createdAt, this.link, this.readAt});
  final String id, type, title, body;
  final String? link;
  final DateTime createdAt;
  final DateTime? readAt;
  bool get unread => readAt == null;
  factory NotificationItem.fromJson(Map<String, dynamic> j) => NotificationItem(
        id: j['id'],
        type: j['type'],
        title: j['title'],
        body: j['body'],
        link: j['link'],
        createdAt: _d(j['createdAt'])!,
        readAt: _d(j['readAt']),
      );
}

class DashboardTotals {
  DashboardTotals({required this.devices, required this.inStock, required this.assigned, required this.faulty});
  final int devices, inStock, assigned, faulty;
  factory DashboardTotals.fromJson(Map<String, dynamic> j) =>
      DashboardTotals(devices: j['devices'], inStock: j['inStock'], assigned: j['assigned'], faulty: j['faulty']);
}

class Paged<T> {
  Paged(this.items, this.total);
  final List<T> items;
  final int total;
}

// ───────── Cihaz türü: etiket, ikon, renk (web ile aynı) ─────────
const typeLabels = {
  'LAPTOP': 'Dizüstü',
  'DESKTOP': 'Masaüstü',
  'SERVER': 'Sunucu',
  'MONITOR': 'Monitör',
  'PRINTER': 'Yazıcı',
  'PHONE': 'Telefon',
  'TABLET': 'Tablet',
  'NETWORK': 'Ağ cihazı',
  'OTHER': 'Diğer',
};
String typeLabel(String t) => typeLabels[t] ?? t;

IconData typeIcon(String t) => switch (t) {
      'LAPTOP' => Icons.laptop_mac_rounded,
      'DESKTOP' => Icons.desktop_windows_rounded,
      'SERVER' => Icons.dns_rounded,
      'MONITOR' => Icons.tv_rounded,
      'PRINTER' => Icons.print_rounded,
      'PHONE' => Icons.smartphone_rounded,
      'TABLET' => Icons.tablet_mac_rounded,
      'NETWORK' => Icons.router_rounded,
      _ => Icons.memory_rounded,
    };

Color typeColor(String t) {
  const m = {
    'LAPTOP': Color(0xFF462B55),
    'MONITOR': Color(0xFF00809B),
    'SERVER': Color(0xFF3564AF),
    'DESKTOP': Color(0xFF7A3FA8),
    'NETWORK': Color(0xFF16244D),
    'PRINTER': Color(0xFF00677C),
    'PHONE': Color(0xFF910C32),
    'TABLET': Color(0xFF8D5FB0),
    'OTHER': Color(0xFF6B6275),
  };
  if (m[t] != null) return m[t]!;
  var h = 0;
  for (final c in t.runes) {
    h = (h * 31 + c) % 360;
  }
  return HSLColor.fromAHSL(1, h.toDouble(), .42, .36).toColor();
}
