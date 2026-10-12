import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../core/format.dart';
import '../core/models.dart';
import '../core/theme.dart';
import '../state/providers.dart';
import '../widgets/ui.dart';

class NotificationsScreen extends ConsumerWidget {
  const NotificationsScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.t;
    final async = ref.watch(notificationsProvider);
    return SafeArea(
      bottom: false,
      child: RefreshIndicator(
        color: t.teal,
        onRefresh: () async => ref.refresh(notificationsProvider.future),
        child: ListView(padding: const EdgeInsets.fromLTRB(18, 14, 18, 120), physics: const AlwaysScrollableScrollPhysics(), children: [
          Row(children: [
            const Expanded(child: Text('Bildirimler', style: TextStyle(fontSize: 28, fontWeight: FontWeight.w800, letterSpacing: -.5))),
            if ((async.value?.unread ?? 0) > 0)
              TextButton.icon(
                onPressed: () async {
                  await ref.read(apiProvider).readAll();
                  ref.invalidate(notificationsProvider);
                },
                icon: Icon(Icons.done_all_rounded, size: 18, color: t.teal),
                label: Text('Tümünü oku', style: TextStyle(color: t.teal, fontWeight: FontWeight.w700)),
              ),
          ]),
          const SizedBox(height: 12),
          async.when(
            loading: () => const SkeletonList(count: 5, height: 78),
            error: (e, _) => ErrorState(error: e, onRetry: () => ref.invalidate(notificationsProvider)),
            data: (d) => d.items.isEmpty
                ? const EmptyState(icon: Icons.notifications_none_rounded, title: 'Bildirim yok', message: 'Zimmet, arıza ve iade hatırlatmaları burada görünür.')
                : Column(children: [for (var i = 0; i < d.items.length; i++) Padding(padding: const EdgeInsets.only(bottom: 10), child: Reveal(index: i, child: _Item(d.items[i])))]),
          ),
        ]),
      ),
    );
  }
}

class _Item extends ConsumerWidget {
  const _Item(this.n);
  final NotificationItem n;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.t;
    final (icon, color) = switch (n.type) {
      'ASSIGNED' => (Icons.person_add_alt_1_rounded, t.success),
      'RETURNED' => (Icons.assignment_return_rounded, t.info),
      'FAULT_REPORTED' || 'FAULT_UPDATED' => (Icons.report_problem_rounded, t.danger),
      'WARRANTY_EXPIRING' => (Icons.shield_rounded, t.warning),
      _ => (Icons.schedule_rounded, t.warning),
    };
    final id = RegExp(r'/devices/([^/?#]+)').firstMatch(n.link ?? '')?.group(1);
    return AppCard(
      padding: const EdgeInsets.all(14),
      color: n.unread ? Color.alphaBlend(t.accentSoft, t.surface) : null,
      onTap: () async {
        if (n.unread) {
          await ref.read(apiProvider).readOne(n.id);
          ref.invalidate(notificationsProvider);
        }
        if (id != null && context.mounted) context.push('/device/$id');
      },
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Container(width: 40, height: 40, decoration: BoxDecoration(color: color.withValues(alpha: .14), borderRadius: BorderRadius.circular(12)), child: Icon(icon, color: color, size: 21)),
        const SizedBox(width: 12),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Expanded(child: Text(n.title, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14.5))),
            if (n.unread) Container(width: 8, height: 8, decoration: BoxDecoration(color: t.teal, shape: BoxShape.circle)),
          ]),
          const SizedBox(height: 3),
          Text(n.body, style: TextStyle(color: t.muted, fontSize: 13, height: 1.35)),
          const SizedBox(height: 6),
          Text(relative(n.createdAt), style: TextStyle(color: t.subtle, fontSize: 11.5)),
        ])),
      ]),
    );
  }
}
