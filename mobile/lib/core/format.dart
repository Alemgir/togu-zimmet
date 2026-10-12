import 'package:intl/intl.dart';

final _date = DateFormat('d MMM y', 'tr');
final _dateTime = DateFormat('d MMM y, HH:mm', 'tr');

String fmtDate(DateTime? d) => d == null ? '—' : _date.format(d.toLocal());
String fmtDateTime(DateTime? d) => d == null ? '—' : _dateTime.format(d.toLocal());

String relative(DateTime d) {
  final diff = DateTime.now().difference(d.toLocal());
  if (diff.inMinutes < 1) return 'şimdi';
  if (diff.inMinutes < 60) return '${diff.inMinutes} dk önce';
  if (diff.inHours < 24) return '${diff.inHours} sa önce';
  if (diff.inDays < 7) return '${diff.inDays} gün önce';
  return fmtDate(d);
}

/// Bugünden verilen tarihe kalan gün (geçmişse negatif).
int daysUntil(DateTime d) {
  final now = DateTime.now();
  final a = DateTime(now.year, now.month, now.day);
  final l = d.toLocal();
  return DateTime(l.year, l.month, l.day).difference(a).inDays;
}

String initials(String name) {
  final p = name.trim().split(RegExp(r'\s+')).where((e) => e.isNotEmpty).toList();
  if (p.isEmpty) return '?';
  if (p.length == 1) return p.first.substring(0, 1).toUpperCase();
  return (p.first.substring(0, 1) + p.last.substring(0, 1)).toUpperCase();
}

/// Türkçe büyük harf (Dart'ın toUpperCase'i i→I yapar, İ olmalı).
String trUpper(String s) => s.replaceAll('i', 'İ').replaceAll('ı', 'I').toUpperCase();
