import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../core/models.dart';
import '../core/theme.dart';
import '../state/providers.dart';
import '../widgets/device_widgets.dart';
import '../widgets/ui.dart';

String _greeting() {
  final h = DateTime.now().hour;
  return h < 6 ? 'İyi geceler' : h < 12 ? 'Günaydın' : h < 18 ? 'İyi günler' : 'İyi akşamlar';
}

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.t;
    final me = currentUser(ref)!;
    final mine = ref.watch(myDevicesProvider);
    return RefreshIndicator(
      color: t.teal,
      onRefresh: () async {
        ref.invalidate(totalsProvider);
        ref.invalidate(myDevicesProvider);
        await ref.read(myDevicesProvider.future);
      },
      child: ListView(padding: EdgeInsets.zero, physics: const AlwaysScrollableScrollPhysics(), children: [
        // Başlık: kömür zemin
        Container(
          padding: EdgeInsets.fromLTRB(20, MediaQuery.of(context).padding.top + 14, 20, 26),
          decoration: BoxDecoration(color: t.sb, borderRadius: const BorderRadius.vertical(bottom: Radius.circular(30))),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Container(padding: const EdgeInsets.all(7), decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12)), child: const BrandSymbol(size: 24)),
              const SizedBox(width: 10),
              const Text('Zimmet', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 17)),
              const Spacer(),
              Chip2(label: roleLabel[me.role]!, color: const Color(0xFF4CC6E6)),
            ]),
            const SizedBox(height: 22),
            Reveal(
              child: Row(children: [
                Avatar(me.name, size: 54),
                const SizedBox(width: 14),
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(_greeting(), style: const TextStyle(color: Color(0xFFAAB1BA), fontSize: 13.5)),
                  const SizedBox(height: 2),
                  Text(me.name, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Colors.white, fontSize: 21, fontWeight: FontWeight.w800, letterSpacing: -.3)),
                  if (me.department != null) Text(me.department!, style: const TextStyle(color: Color(0xFFAAB1BA), fontSize: 12.5)),
                ])),
              ]),
            ),
            if (me.isManager) ...[const SizedBox(height: 22), const _Stats()],
          ]),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(18, 0, 18, 120),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            const SizedBox(height: 18),
            Reveal(index: 2, child: _ScanBanner(onTap: () => context.push('/scan'))),
            SectionTitle('Üzerimdeki cihazlar', trailing: mine.maybeWhen(data: (d) => Chip2(label: '${d.length}', color: t.teal), orElse: () => null)),
            mine.when(
              loading: () => const SkeletonList(count: 3),
              error: (e, _) => ErrorState(error: e, onRetry: () => ref.invalidate(myDevicesProvider)),
              data: (list) => list.isEmpty
                  ? const EmptyState(icon: Icons.inventory_2_outlined, title: 'Üzerinize zimmetli cihaz yok', message: 'Size bir cihaz zimmetlendiğinde burada görünür.')
                  : Column(children: [
                      for (var i = 0; i < list.length; i++)
                        Padding(padding: const EdgeInsets.only(bottom: 12), child: Reveal(index: i + 3, child: DeviceTile(device: list[i], onTap: () => context.push('/device/${list[i].id}')))),
                    ]),
            ),
          ]),
        ),
      ]),
    );
  }
}

class _Stats extends ConsumerWidget {
  const _Stats();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(totalsProvider);
    return async.when(
      loading: () => const Row(children: [Expanded(child: Shimmer(height: 74, radius: 16)), SizedBox(width: 8), Expanded(child: Shimmer(height: 74, radius: 16)), SizedBox(width: 8), Expanded(child: Shimmer(height: 74, radius: 16)), SizedBox(width: 8), Expanded(child: Shimmer(height: 74, radius: 16))]),
      error: (e, _) => const SizedBox.shrink(),
      data: (s) => Row(children: [
        _Stat('Toplam', s.devices, Icons.devices_other_rounded, const Color(0xFFB58BD6)),
        const SizedBox(width: 8),
        _Stat('Zimmetli', s.assigned, Icons.person_rounded, const Color(0xFF5FD3A0)),
        const SizedBox(width: 8),
        _Stat('Boşta', s.inStock, Icons.inventory_2_rounded, const Color(0xFF4CC6E6)),
        const SizedBox(width: 8),
        _Stat('Arızalı', s.faulty, Icons.build_rounded, const Color(0xFFFF8AA5)),
      ]),
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat(this.label, this.value, this.icon, this.color);
  final String label;
  final int value;
  final IconData icon;
  final Color color;
  @override
  Widget build(BuildContext context) => Expanded(
        child: Container(
          padding: const EdgeInsets.fromLTRB(10, 10, 10, 10),
          decoration: BoxDecoration(color: Colors.white.withValues(alpha: .07), borderRadius: BorderRadius.circular(16), border: Border.all(color: Colors.white.withValues(alpha: .1))),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Icon(icon, size: 16, color: color),
            const SizedBox(height: 6),
            CountUp(value, style: const TextStyle(color: Colors.white, fontSize: 21, fontWeight: FontWeight.w800, height: 1)),
            const SizedBox(height: 3),
            Text(label, style: const TextStyle(color: Color(0xFFAAB1BA), fontSize: 11.5)),
          ]),
        ),
      );
}

class _ScanBanner extends StatelessWidget {
  const _ScanBanner({required this.onTap});
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) {
    final t = context.t;
    return Pressable(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: t.dark ? const [Color(0xFF0E7C97), Color(0xFF1FB0D3)] : const [Color(0xFF462B55), Color(0xFF6A3F82)]),
          borderRadius: BorderRadius.circular(22),
          boxShadow: softShadow(t, blur: 26, y: 12),
        ),
        child: Row(children: [
          Container(width: 54, height: 54, decoration: BoxDecoration(color: Colors.white.withValues(alpha: .18), borderRadius: BorderRadius.circular(17)), child: const Icon(Icons.qr_code_scanner_rounded, color: Colors.white, size: 30)),
          const SizedBox(width: 14),
          const Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('Cihaz QR kodunu okut', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 16.5)),
            SizedBox(height: 3),
            Text('Bilgileri gör, teslim et veya arıza bildir', style: TextStyle(color: Color(0xCCFFFFFF), fontSize: 12.8)),
          ])),
          const Icon(Icons.arrow_forward_rounded, color: Colors.white),
        ]),
      ),
    );
  }
}
