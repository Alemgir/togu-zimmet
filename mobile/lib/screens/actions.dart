import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/api.dart';
import '../core/format.dart';
import '../core/models.dart';
import '../core/theme.dart';
import '../state/providers.dart';
import '../widgets/ui.dart';

void refreshAll(WidgetRef ref, String deviceId) {
  ref.invalidate(deviceDetailProvider(deviceId));
  ref.invalidate(myDevicesProvider);
  ref.invalidate(totalsProvider);
  ref.invalidate(notificationsProvider);
  ref.invalidate(inventoryProvider);
}

class _SheetHead extends StatelessWidget {
  const _SheetHead(this.icon, this.color, this.title, this.subtitle);
  final IconData icon;
  final Color color;
  final String title, subtitle;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 16),
        child: Row(children: [
          Container(width: 46, height: 46, decoration: BoxDecoration(color: color.withValues(alpha: .14), borderRadius: BorderRadius.circular(14)), child: Icon(icon, color: color)),
          const SizedBox(width: 14),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(title, style: const TextStyle(fontSize: 18.5, fontWeight: FontWeight.w800)),
            const SizedBox(height: 2),
            Text(subtitle, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(color: context.t.muted, fontSize: 13)),
          ])),
        ]),
      );
}

// ───────────────────────── Arıza bildir ─────────────────────────
Future<void> showFaultSheet(BuildContext context, WidgetRef ref, Device d) => showSheet(context, (ctx) => _FaultSheet(device: d, outer: context));

class _FaultSheet extends ConsumerStatefulWidget {
  const _FaultSheet({required this.device, required this.outer});
  final Device device;
  final BuildContext outer;
  @override
  ConsumerState<_FaultSheet> createState() => _FaultSheetState();
}

class _FaultSheetState extends ConsumerState<_FaultSheet> {
  final _note = TextEditingController();
  bool _busy = false;
  static const _quick = ['Açılmıyor', 'Ekran sorunu', 'Yavaş çalışıyor', 'Ağa bağlanmıyor', 'Fiziksel hasar'];

  @override
  void dispose() {
    _note.dispose();
    super.dispose();
  }

  Future<void> _go() async {
    setState(() => _busy = true);
    try {
      await ref.read(apiProvider).reportFault(widget.device.id, _note.text.trim());
      refreshAll(ref, widget.device.id);
      if (mounted) Navigator.pop(context);
      if (widget.outer.mounted) showToast(widget.outer, 'Arıza bildirildi. Cihaz zimmetten düşüldü.');
    } on ApiException catch (e) {
      if (mounted) showToast(context, e.message, kind: ToastKind.error);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    return SingleChildScrollView(
      padding: const EdgeInsets.only(bottom: 20),
      child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        _SheetHead(Icons.report_problem_rounded, t.danger, 'Arıza bildir', widget.device.title),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Wrap(spacing: 8, runSpacing: 8, children: [
              for (final q in _quick)
                Pressable(
                  onTap: () => setState(() => _note.text = q),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    decoration: BoxDecoration(color: t.surface2, borderRadius: BorderRadius.circular(99), border: Border.all(color: t.border)),
                    child: Text(q, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: t.muted)),
                  ),
                ),
            ]),
            const SizedBox(height: 14),
            Field(controller: _note, label: 'Sorunu kısaca anlatın', maxLines: 3),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(color: t.warning.withValues(alpha: .1), borderRadius: BorderRadius.circular(12)),
              child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Icon(Icons.info_outline_rounded, size: 18, color: t.warning),
                const SizedBox(width: 8),
                Expanded(child: Text('Bildirim sonrası cihaz "Arızalı" olur ve zimmetten otomatik düşer.', style: TextStyle(fontSize: 12.8, color: t.warning, height: 1.35))),
              ]),
            ),
            const SizedBox(height: 16),
            AppButton(label: 'Arızayı bildir', icon: Icons.send_rounded, kind: BtnKind.danger, loading: _busy, onPressed: _go),
          ]),
        ),
      ]),
    );
  }
}

// ───────────────────────── Geri kabul ─────────────────────────
Future<void> showReturnSheet(BuildContext context, WidgetRef ref, Device d) => showSheet(context, (ctx) => _ReturnSheet(device: d, outer: context));

class _ReturnSheet extends ConsumerStatefulWidget {
  const _ReturnSheet({required this.device, required this.outer});
  final Device device;
  final BuildContext outer;
  @override
  ConsumerState<_ReturnSheet> createState() => _ReturnSheetState();
}

class _ReturnSheetState extends ConsumerState<_ReturnSheet> {
  final _note = TextEditingController();
  bool _faulty = false, _busy = false;

  @override
  void dispose() {
    _note.dispose();
    super.dispose();
  }

  Future<void> _go() async {
    setState(() => _busy = true);
    try {
      await ref.read(apiProvider).returnDevice(widget.device.id, faulty: _faulty, note: _note.text.trim());
      refreshAll(ref, widget.device.id);
      if (mounted) Navigator.pop(context);
      if (widget.outer.mounted) showToast(widget.outer, _faulty ? 'Cihaz arızalı olarak geri alındı' : 'Cihaz geri kabul edildi, depoya alındı');
    } on ApiException catch (e) {
      if (mounted) showToast(context, e.message, kind: ToastKind.error);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final h = widget.device.holder;
    return SingleChildScrollView(
      padding: const EdgeInsets.only(bottom: 20),
      child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        _SheetHead(Icons.assignment_return_rounded, t.teal, 'Cihazı geri kabul et', widget.device.title),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            if (h != null)
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(color: t.surface2, borderRadius: BorderRadius.circular(14)),
                child: Row(children: [
                  Avatar(h.name, size: 38),
                  const SizedBox(width: 12),
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(h.name, style: const TextStyle(fontWeight: FontWeight.w700)),
                    Text('Teslim eden${h.department != null ? ' · ${h.department}' : ''}', style: TextStyle(color: t.muted, fontSize: 12.5)),
                  ])),
                ]),
              ),
            const SizedBox(height: 16),
            Text('Cihazın durumu', style: TextStyle(fontWeight: FontWeight.w700, color: t.muted, fontSize: 13)),
            const SizedBox(height: 8),
            Row(children: [
              Expanded(child: _Choice(selected: !_faulty, icon: Icons.check_circle_rounded, label: 'Sağlam', color: t.success, onTap: () => setState(() => _faulty = false))),
              const SizedBox(width: 10),
              Expanded(child: _Choice(selected: _faulty, icon: Icons.build_circle_rounded, label: 'Arızalı', color: t.danger, onTap: () => setState(() => _faulty = true))),
            ]),
            const SizedBox(height: 14),
            Field(controller: _note, label: 'Not (isteğe bağlı)', maxLines: 2),
            const SizedBox(height: 16),
            AppButton(label: 'Geri kabul et', icon: Icons.check_rounded, loading: _busy, onPressed: _go),
          ]),
        ),
      ]),
    );
  }
}

class _Choice extends StatelessWidget {
  const _Choice({required this.selected, required this.icon, required this.label, required this.color, required this.onTap});
  final bool selected;
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) {
    final t = context.t;
    return Pressable(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(vertical: 14),
        decoration: BoxDecoration(
          color: selected ? color.withValues(alpha: .13) : t.surface,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: selected ? color : t.border, width: selected ? 1.8 : 1),
        ),
        child: Column(children: [
          Icon(icon, color: selected ? color : t.subtle, size: 26),
          const SizedBox(height: 4),
          Text(label, style: TextStyle(fontWeight: FontWeight.w700, color: selected ? color : t.muted)),
        ]),
      ),
    );
  }
}

// ───────────────────────── Personele teslim et ─────────────────────────
Future<void> showAssignSheet(BuildContext context, WidgetRef ref, Device d) =>
    showSheet(context, (ctx) => ConstrainedBox(constraints: BoxConstraints(maxHeight: MediaQuery.of(ctx).size.height * .88), child: _AssignSheet(device: d, outer: context)));

class _AssignSheet extends ConsumerStatefulWidget {
  const _AssignSheet({required this.device, required this.outer});
  final Device device;
  final BuildContext outer;
  @override
  ConsumerState<_AssignSheet> createState() => _AssignSheetState();
}

class _AssignSheetState extends ConsumerState<_AssignSheet> {
  final _search = TextEditingController();
  final _note = TextEditingController();
  Timer? _deb;
  List<AppUser> _users = [];
  bool _loading = true, _busy = false;
  AppUser? _picked;
  DateTime? _due;

  @override
  void initState() {
    super.initState();
    _load('');
  }

  @override
  void dispose() {
    _deb?.cancel();
    _search.dispose();
    _note.dispose();
    super.dispose();
  }

  Future<void> _load(String q) async {
    setState(() => _loading = true);
    try {
      final u = await ref.read(apiProvider).users(q);
      if (mounted) setState(() => _users = u);
    } on ApiException catch (e) {
      if (mounted) showToast(context, e.message, kind: ToastKind.error);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _pickDate() async {
    final now = DateTime.now();
    final d = await showDatePicker(context: context, initialDate: _due ?? now.add(const Duration(days: 30)), firstDate: now, lastDate: now.add(const Duration(days: 365 * 3)), locale: const Locale('tr'));
    if (d != null) setState(() => _due = d);
  }

  Future<void> _go() async {
    final u = _picked;
    if (u == null) return;
    setState(() => _busy = true);
    try {
      await ref.read(apiProvider).assign(deviceId: widget.device.id, userId: u.id, note: _note.text.trim(), dueAt: _due);
      refreshAll(ref, widget.device.id);
      if (mounted) Navigator.pop(context);
      if (widget.outer.mounted) showToast(widget.outer, '${widget.device.title}, ${u.name} adlı personele zimmetlendi');
    } on ApiException catch (e) {
      if (mounted) showToast(context, e.message, kind: ToastKind.error);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    return Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      _SheetHead(Icons.person_add_alt_1_rounded, t.accent == t.teal ? t.teal : (t.dark ? t.teal : t.accent), 'Personele teslim et', widget.device.title),
      Padding(
        padding: const EdgeInsets.symmetric(horizontal: 20),
        child: Field(
          controller: _search,
          label: 'Personel ara (ad, e-posta, birim)',
          icon: Icons.search_rounded,
          onChanged: (v) {
            _deb?.cancel();
            _deb = Timer(const Duration(milliseconds: 300), () => _load(v.trim()));
          },
        ),
      ),
      const SizedBox(height: 10),
      Flexible(
        child: _loading && _users.isEmpty
            ? const Padding(padding: EdgeInsets.all(28), child: Center(child: LogoSpinner(size: 34, plate: false)))
            : _users.isEmpty
                ? const EmptyState(icon: Icons.person_search_rounded, title: 'Personel bulunamadı')
                : ListView.builder(
                    shrinkWrap: true,
                    padding: const EdgeInsets.symmetric(horizontal: 14),
                    itemCount: _users.length,
                    itemBuilder: (_, i) {
                      final u = _users[i];
                      final sel = _picked?.id == u.id;
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 6),
                        child: Pressable(
                          onTap: () => setState(() => _picked = sel ? null : u),
                          child: AnimatedContainer(
                            duration: const Duration(milliseconds: 180),
                            padding: const EdgeInsets.all(10),
                            decoration: BoxDecoration(
                              color: sel ? t.accentSoft : Colors.transparent,
                              borderRadius: BorderRadius.circular(14),
                              border: Border.all(color: sel ? (t.dark ? t.teal : t.accent) : Colors.transparent, width: 1.6),
                            ),
                            child: Row(children: [
                              Avatar(u.name, size: 40),
                              const SizedBox(width: 12),
                              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                Text(u.name, style: const TextStyle(fontWeight: FontWeight.w700)),
                                Text([u.title, u.department].whereType<String>().join(' · ').ifEmpty(u.email), maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(color: t.muted, fontSize: 12.5)),
                              ])),
                              if (sel) Icon(Icons.check_circle_rounded, color: t.dark ? t.teal : t.accent),
                            ]),
                          ),
                        ),
                      );
                    },
                  ),
      ),
      AnimatedSize(
        duration: const Duration(milliseconds: 260),
        curve: Curves.easeOutCubic,
        child: _picked == null
            ? const SizedBox(width: double.infinity)
            : Padding(
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 0),
                child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                  Field(controller: _note, label: 'Not (isteğe bağlı)'),
                  const SizedBox(height: 10),
                  Pressable(
                    onTap: _pickDate,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 15),
                      decoration: BoxDecoration(color: t.surface2.withValues(alpha: .55), borderRadius: BorderRadius.circular(14), border: Border.all(color: t.border)),
                      child: Row(children: [
                        Icon(Icons.event_rounded, size: 20, color: t.muted),
                        const SizedBox(width: 12),
                        Expanded(child: Text(_due == null ? 'Planlı iade tarihi (isteğe bağlı)' : 'Planlı iade: ${fmtDate(_due)}', style: TextStyle(color: _due == null ? t.muted : t.fg, fontWeight: _due == null ? FontWeight.w400 : FontWeight.w600))),
                        if (_due != null) GestureDetector(onTap: () => setState(() => _due = null), child: Icon(Icons.close_rounded, size: 19, color: t.muted)),
                      ]),
                    ),
                  ),
                ]),
              ),
      ),
      Padding(
        padding: const EdgeInsets.fromLTRB(20, 14, 20, 18),
        child: AppButton(label: _picked == null ? 'Bir personel seçin' : '${_picked!.name} adına zimmetle', icon: Icons.check_rounded, loading: _busy, onPressed: _picked == null ? null : _go),
      ),
    ]);
  }
}

extension on String {
  String ifEmpty(String other) => isEmpty ? other : this;
}
