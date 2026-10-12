import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../core/theme.dart';
import '../state/providers.dart';
import '../widgets/device_widgets.dart';
import '../widgets/ui.dart';

class InventoryScreen extends ConsumerStatefulWidget {
  const InventoryScreen({super.key});
  @override
  ConsumerState<InventoryScreen> createState() => _InventoryScreenState();
}

class _InventoryScreenState extends ConsumerState<InventoryScreen> {
  final _c = TextEditingController();
  Timer? _deb;
  String _q = '';
  String? _status;

  @override
  void dispose() {
    _deb?.cancel();
    _c.dispose();
    super.dispose();
  }

  static const _filters = [(null, 'Tümü'), ('IN_STOCK', 'Depoda'), ('ASSIGNED', 'Zimmetli'), ('FAULTY', 'Arızalı'), ('RETIRED', 'Hizmet dışı')];

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final q = InventoryQuery(search: _q, status: _status);
    final async = ref.watch(inventoryProvider(q));
    return SafeArea(
      bottom: false,
      child: RefreshIndicator(
        color: t.teal,
        onRefresh: () async => ref.refresh(inventoryProvider(q).future),
        child: ListView(padding: const EdgeInsets.fromLTRB(18, 14, 18, 120), physics: const AlwaysScrollableScrollPhysics(), children: [
          const Text('Envanter', style: TextStyle(fontSize: 28, fontWeight: FontWeight.w800, letterSpacing: -.5)),
          const SizedBox(height: 14),
          Field(
            controller: _c,
            label: 'Marka, model, demirbaş no…',
            icon: Icons.search_rounded,
            onChanged: (v) {
              _deb?.cancel();
              _deb = Timer(const Duration(milliseconds: 350), () => setState(() => _q = v.trim()));
            },
            suffix: _c.text.isEmpty ? null : IconButton(icon: const Icon(Icons.close_rounded, size: 19), onPressed: () => setState(() { _c.clear(); _q = ''; })),
          ),
          const SizedBox(height: 12),
          SizedBox(
            height: 38,
            child: ListView(scrollDirection: Axis.horizontal, children: [
              for (final (v, label) in _filters)
                Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: Pressable(
                    onTap: () => setState(() => _status = v),
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 200),
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: _status == v ? (t.dark ? t.teal : t.accent) : t.surface,
                        borderRadius: BorderRadius.circular(99),
                        border: Border.all(color: _status == v ? Colors.transparent : t.border),
                      ),
                      child: Text(label, style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5, color: _status == v ? t.accentFg : t.muted)),
                    ),
                  ),
                ),
            ]),
          ),
          const SizedBox(height: 16),
          async.when(
            loading: () => const SkeletonList(count: 5),
            error: (e, _) => ErrorState(error: e, onRetry: () => ref.invalidate(inventoryProvider(q))),
            data: (p) => p.items.isEmpty
                ? const EmptyState(icon: Icons.search_off_rounded, title: 'Cihaz bulunamadı', message: 'Arama veya filtreyi değiştirmeyi deneyin.')
                : Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                    Padding(padding: const EdgeInsets.only(left: 4, bottom: 10), child: Text('${p.total} cihaz', style: TextStyle(color: t.muted, fontWeight: FontWeight.w600, fontSize: 13))),
                    for (var i = 0; i < p.items.length; i++)
                      Padding(padding: const EdgeInsets.only(bottom: 12), child: Reveal(index: i, child: DeviceTile(device: p.items[i], showHolder: true, onTap: () => context.push('/device/${p.items[i].id}')))),
                  ]),
          ),
        ]),
      ),
    );
  }
}
