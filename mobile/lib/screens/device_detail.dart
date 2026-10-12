import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../core/format.dart';
import '../core/models.dart';
import '../core/theme.dart';
import '../state/providers.dart';
import '../widgets/device_widgets.dart';
import '../widgets/ui.dart';
import 'actions.dart';

class DeviceDetailScreen extends ConsumerWidget {
  const DeviceDetailScreen({super.key, required this.id});
  final String id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.t;
    final async = ref.watch(deviceDetailProvider(id));
    final me = currentUser(ref);
    return Scaffold(
      backgroundColor: t.bg,
      body: async.when(
        loading: () => const _Loading(),
        error: (e, _) => SafeArea(child: Column(children: [Align(alignment: Alignment.centerLeft, child: BackButton(onPressed: () => context.pop())), ErrorState(error: e, onRetry: () => ref.invalidate(deviceDetailProvider(id)))])),
        data: (data) => _Body(data: data, me: me!, id: id),
      ),
    );
  }
}

class _Loading extends StatelessWidget {
  const _Loading();
  @override
  Widget build(BuildContext context) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(children: [
            Align(alignment: Alignment.centerLeft, child: BackButton(onPressed: () => context.pop())),
            const SizedBox(height: 10),
            const Shimmer(height: 190, radius: 26),
            const SizedBox(height: 16),
            const SkeletonList(count: 3, height: 90),
          ]),
        ),
      );
}

class _Body extends ConsumerWidget {
  const _Body({required this.data, required this.me, required this.id});
  final DeviceDetailData data;
  final AppUser me;
  final String id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.t;
    final d = data.device;
    final holder = d.holder;
    final w = warrantyInfo(t, d.warrantyEnd);
    final isHolder = holder?.id == me.id;
    final managed = me.role == Role.unitManager && holder != null && holder.department != null && holder.department == me.department;
    final canFault = (d.status == DeviceStatus.assigned || d.status == DeviceStatus.inStock) && (me.isAdmin || isHolder || managed);
    final canAssign = me.isAdmin && d.status == DeviceStatus.inStock;
    final canReturn = me.isAdmin && d.status == DeviceStatus.assigned;
    final hasAction = canFault || canAssign || canReturn;
    final c = typeColor(d.type);

    return Stack(children: [
      RefreshIndicator(
        color: t.teal,
        onRefresh: () async => ref.refresh(deviceDetailProvider(id).future),
        child: ListView(padding: EdgeInsets.only(bottom: hasAction ? 150 : 40), physics: const AlwaysScrollableScrollPhysics(), children: [
          // ── Kahraman alan
          Container(
            padding: EdgeInsets.fromLTRB(20, MediaQuery.of(context).padding.top + 6, 20, 26),
            decoration: BoxDecoration(
              gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [Color.lerp(c, Colors.black, .12)!, Color.lerp(c, Colors.black, .55)!]),
              borderRadius: const BorderRadius.vertical(bottom: Radius.circular(32)),
            ),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                _RoundBtn(Icons.arrow_back_rounded, () => context.pop()),
                const Spacer(),
                _RoundBtn(Icons.copy_rounded, () {
                  Clipboard.setData(ClipboardData(text: d.assetTag));
                  showToast(context, '${d.assetTag} kopyalandı', kind: ToastKind.info);
                }),
              ]),
              const SizedBox(height: 18),
              Reveal(
                child: Row(crossAxisAlignment: CrossAxisAlignment.center, children: [
                  Hero(
                    tag: 'dev-${d.id}',
                    child: Container(
                      width: 68,
                      height: 68,
                      decoration: BoxDecoration(color: Colors.white.withValues(alpha: .16), borderRadius: BorderRadius.circular(22), border: Border.all(color: Colors.white.withValues(alpha: .25))),
                      child: Icon(typeIcon(d.type), color: Colors.white, size: 34),
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(d.title, style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w800, height: 1.15, letterSpacing: -.3)),
                    const SizedBox(height: 4),
                    Text('${typeLabel(d.type)} · ${d.assetTag}', style: TextStyle(color: Colors.white.withValues(alpha: .8), fontSize: 13.5)),
                  ])),
                ]),
              ),
              const SizedBox(height: 18),
              Wrap(spacing: 8, runSpacing: 8, children: [
                _OnHero(statusLabel[d.status]!, switch (d.status) { DeviceStatus.inStock => Icons.inventory_2_rounded, DeviceStatus.assigned => Icons.person_rounded, DeviceStatus.faulty => Icons.build_rounded, DeviceStatus.retired => Icons.block_rounded }),
                _OnHero(w.text, w.icon),
              ]),
            ]),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 18),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              // ── Kimde
              const SectionTitle('Zimmet durumu'),
              Reveal(index: 1, child: _HolderCard(device: d)),
              // ── Bilgiler
              const SectionTitle('Cihaz bilgileri'),
              Reveal(
                index: 2,
                child: AppCard(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                  child: Column(children: [
                    _Row(Icons.tag_rounded, 'Demirbaş no', d.assetTag, mono: true, copy: true),
                    _Row(Icons.qr_code_2_rounded, 'Seri no', d.serialNumber, mono: true, copy: true),
                    _Row(Icons.shopping_bag_outlined, 'Alım tarihi', fmtDate(d.purchaseDate)),
                    _Row(Icons.verified_user_outlined, 'Garanti bitişi', d.warrantyEnd == null ? '—' : fmtDate(d.warrantyEnd)),
                    _Row(Icons.place_outlined, 'Konum', d.location ?? '—', last: d.notes == null),
                    if (d.notes != null) _Row(Icons.notes_rounded, 'Not', d.notes!, last: true),
                  ]),
                ),
              ),
              if (d.warrantyEnd != null) ...[const SizedBox(height: 12), Reveal(index: 3, child: _WarrantyBar(purchase: d.purchaseDate, end: d.warrantyEnd!))],
              // ── Geçmiş
              if (data.events.isNotEmpty) ...[
                const SectionTitle('Geçmiş'),
                Reveal(index: 4, child: AppCard(child: Column(children: [for (var i = 0; i < data.events.length.clamp(0, 8); i++) _EventRow(data.events[i], last: i == data.events.length.clamp(0, 8) - 1)]))),
              ],
            ]),
          ),
        ]),
      ),
      if (hasAction)
        Positioned(
          left: 0,
          right: 0,
          bottom: 0,
          child: Container(
            padding: EdgeInsets.fromLTRB(18, 14, 18, MediaQuery.of(context).padding.bottom + 14),
            decoration: BoxDecoration(color: t.surface, border: Border(top: BorderSide(color: t.border)), boxShadow: softShadow(t, blur: 30, y: -6)),
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              if (canAssign) AppButton(label: 'Personele teslim et', icon: Icons.person_add_alt_1_rounded, onPressed: () => showAssignSheet(context, ref, d)),
              if (canReturn) AppButton(label: 'Cihazı geri kabul et', icon: Icons.assignment_return_rounded, onPressed: () => showReturnSheet(context, ref, d)),
              if (canFault) ...[
                if (canAssign || canReturn) const SizedBox(height: 10),
                AppButton(label: 'Arıza bildir', icon: Icons.report_problem_rounded, kind: (canAssign || canReturn) ? BtnKind.danger : BtnKind.primary, onPressed: () => showFaultSheet(context, ref, d)),
              ],
            ]),
          ),
        ),
    ]);
  }
}

class _RoundBtn extends StatelessWidget {
  const _RoundBtn(this.icon, this.onTap);
  final IconData icon;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => Pressable(
        onTap: onTap,
        child: Container(width: 42, height: 42, decoration: BoxDecoration(color: Colors.white.withValues(alpha: .16), shape: BoxShape.circle), child: Icon(icon, color: Colors.white, size: 20)),
      );
}

class _OnHero extends StatelessWidget {
  const _OnHero(this.text, this.icon);
  final String text;
  final IconData icon;
  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
        decoration: BoxDecoration(color: Colors.white.withValues(alpha: .16), borderRadius: BorderRadius.circular(99)),
        child: Row(mainAxisSize: MainAxisSize.min, children: [Icon(icon, size: 15, color: Colors.white), const SizedBox(width: 6), Text(text, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 12.5))]),
      );
}

class _HolderCard extends StatelessWidget {
  const _HolderCard({required this.device});
  final Device device;
  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final h = device.holder;
    if (h == null) {
      final txt = switch (device.status) { DeviceStatus.inStock => 'Cihaz depoda, kimseye zimmetli değil.', DeviceStatus.faulty => 'Arızalı, şu an kimseye zimmetli değil.', _ => 'Hizmet dışı, zimmetli değil.' };
      return AppCard(child: Row(children: [Icon(Icons.inventory_2_outlined, color: t.muted), const SizedBox(width: 12), Expanded(child: Text(txt, style: TextStyle(color: t.muted, height: 1.35)))]));
    }
    final overdue = device.dueAt != null && daysUntil(device.dueAt!) < 0;
    return AppCard(
      child: Column(children: [
        Row(children: [
          Avatar(h.name, size: 48),
          const SizedBox(width: 14),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(h.name, style: const TextStyle(fontSize: 16.5, fontWeight: FontWeight.w800)),
            Text([h.title, h.department].whereType<String>().join(' · '), style: TextStyle(color: t.muted, fontSize: 13)),
          ])),
        ]),
        const SizedBox(height: 14),
        Row(children: [
          Expanded(child: _Mini('Zimmet tarihi', fmtDate(device.assignedAt), Icons.event_available_rounded, t.muted)),
          const SizedBox(width: 10),
          Expanded(child: _Mini('Planlı iade', device.dueAt == null ? 'Belirtilmedi' : fmtDate(device.dueAt), Icons.event_repeat_rounded, overdue ? t.danger : t.muted)),
        ]),
      ]),
    );
  }
}

class _Mini extends StatelessWidget {
  const _Mini(this.label, this.value, this.icon, this.color);
  final String label, value;
  final IconData icon;
  final Color color;
  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(color: context.t.surface2, borderRadius: BorderRadius.circular(12)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [Icon(icon, size: 15, color: color), const SizedBox(width: 5), Text(label, style: TextStyle(fontSize: 11.5, color: color, fontWeight: FontWeight.w600))]),
          const SizedBox(height: 4),
          Text(value, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
        ]),
      );
}

class _Row extends StatelessWidget {
  const _Row(this.icon, this.label, this.value, {this.mono = false, this.copy = false, this.last = false});
  final IconData icon;
  final String label, value;
  final bool mono, copy, last;
  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final row = Container(
      padding: const EdgeInsets.symmetric(vertical: 13),
      decoration: BoxDecoration(border: last ? null : Border(bottom: BorderSide(color: t.border))),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Icon(icon, size: 19, color: t.muted),
        const SizedBox(width: 12),
        SizedBox(width: 108, child: Text(label, style: TextStyle(color: t.muted, fontSize: 13.5))),
        Expanded(child: Text(value, textAlign: TextAlign.right, style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14, fontFamily: mono ? 'Menlo' : null))),
      ]),
    );
    if (!copy) return row;
    return Pressable(
      onTap: () {
        Clipboard.setData(ClipboardData(text: value));
        showToast(context, '$label kopyalandı', kind: ToastKind.info);
      },
      child: row,
    );
  }
}

class _WarrantyBar extends StatelessWidget {
  const _WarrantyBar({required this.purchase, required this.end});
  final DateTime purchase, end;
  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final total = end.difference(purchase).inDays.clamp(1, 100000);
    final used = DateTime.now().difference(purchase).inDays.clamp(0, total);
    final frac = used / total;
    final left = daysUntil(end);
    final color = left < 0 ? t.danger : (left <= 90 ? t.warning : t.success);
    return AppCard(
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Text('Garanti süresi', style: TextStyle(fontWeight: FontWeight.w700, color: t.muted, fontSize: 13)),
          const Spacer(),
          Text(left < 0 ? '${-left} gün önce bitti' : '$left gün kaldı', style: TextStyle(fontWeight: FontWeight.w800, color: color, fontSize: 13)),
        ]),
        const SizedBox(height: 12),
        ClipRRect(
          borderRadius: BorderRadius.circular(99),
          child: TweenAnimationBuilder<double>(
            tween: Tween(begin: 0, end: frac),
            duration: const Duration(milliseconds: 1000),
            curve: Curves.easeOutCubic,
            builder: (_, v, __) => LinearProgressIndicator(value: v, minHeight: 9, color: color, backgroundColor: t.surface2),
          ),
        ),
      ]),
    );
  }
}

class _EventRow extends StatelessWidget {
  const _EventRow(this.e, {required this.last});
  final DeviceEvent e;
  final bool last;
  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final (icon, color) = switch (e.type) {
      'ASSIGNED' => (Icons.person_add_alt_1_rounded, t.success),
      'RETURNED' => (Icons.assignment_return_rounded, t.info),
      'FAULT_REPORTED' => (Icons.report_problem_rounded, t.danger),
      'CREATED' => (Icons.add_circle_rounded, t.teal),
      _ => (Icons.edit_rounded, t.muted),
    };
    return IntrinsicHeight(
      child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Column(children: [
          Container(width: 30, height: 30, decoration: BoxDecoration(color: color.withValues(alpha: .14), shape: BoxShape.circle), child: Icon(icon, size: 16, color: color)),
          if (!last) Expanded(child: Container(width: 2, margin: const EdgeInsets.symmetric(vertical: 4), color: t.border)),
        ]),
        const SizedBox(width: 12),
        Expanded(
          child: Padding(
            padding: EdgeInsets.only(bottom: last ? 0 : 16, top: 4),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(e.message, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13.5, height: 1.3)),
              const SizedBox(height: 2),
              Text('${e.actor != null ? '${e.actor} · ' : ''}${fmtDateTime(e.createdAt)}', style: TextStyle(color: t.muted, fontSize: 12)),
            ]),
          ),
        ),
      ]),
    );
  }
}
