import 'package:flutter/material.dart';

import '../core/format.dart';
import '../core/models.dart';
import '../core/theme.dart';
import 'ui.dart';

/// Garanti durumu: kalan gün → rozet rengi/metni.
({String text, Color color, IconData icon}) warrantyInfo(Tokens t, DateTime? end) {
  if (end == null) return (text: 'Garanti bilgisi yok', color: t.muted, icon: Icons.shield_outlined);
  final d = daysUntil(end);
  if (d < 0) return (text: 'Garanti bitti', color: t.danger, icon: Icons.gpp_bad_rounded);
  if (d <= 90) return (text: '$d gün garanti', color: t.warning, icon: Icons.shield_rounded);
  return (text: 'Garantili', color: t.success, icon: Icons.verified_user_rounded);
}

class DeviceTile extends StatelessWidget {
  const DeviceTile({super.key, required this.device, required this.onTap, this.showHolder = false});
  final Device device;
  final VoidCallback onTap;
  final bool showHolder;
  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final w = warrantyInfo(t, device.warrantyEnd);
    final overdue = device.dueAt != null && daysUntil(device.dueAt!) < 0 && device.status == DeviceStatus.assigned;
    return AppCard(
      onTap: onTap,
      padding: const EdgeInsets.all(14),
      child: Row(children: [
        Hero(tag: 'dev-${device.id}', child: DeviceIconBox(device.type, size: 52)),
        const SizedBox(width: 14),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(device.title, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 15.5, fontWeight: FontWeight.w700)),
            const SizedBox(height: 3),
            Text('${device.assetTag} · ${typeLabel(device.type)}', style: TextStyle(color: t.muted, fontSize: 12.5, fontFeatures: const [FontFeature.tabularFigures()])),
            const SizedBox(height: 8),
            Wrap(spacing: 6, runSpacing: 6, children: [
              StatusChip(device.status),
              if (overdue) Chip2(label: 'İade gecikti', color: t.danger, icon: Icons.schedule_rounded) else if (showHolder && device.holder != null) Chip2(label: device.holder!.name, color: t.info, icon: Icons.person_rounded) else if (!showHolder) Chip2(label: w.text, color: w.color, icon: w.icon),
            ]),
          ]),
        ),
        Icon(Icons.chevron_right_rounded, color: t.subtle),
      ]),
    );
  }
}
