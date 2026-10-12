import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../core/theme.dart';
import '../state/providers.dart';
import '../widgets/ui.dart';
import 'home.dart';
import 'inventory.dart';
import 'notifications.dart';
import 'profile.dart';

class MainShell extends ConsumerStatefulWidget {
  const MainShell({super.key});
  @override
  ConsumerState<MainShell> createState() => _MainShellState();
}

class _MainShellState extends ConsumerState<MainShell> {
  int _i = 0;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final me = currentUser(ref);
    if (me == null) return const SizedBox.shrink();
    final unread = ref.watch(notificationsProvider).value?.unread ?? 0;
    final tabs = <_Tab>[
      const _Tab('Ana sayfa', Icons.home_rounded, Icons.home_outlined, HomeScreen()),
      if (me.isManager) const _Tab('Envanter', Icons.inventory_2_rounded, Icons.inventory_2_outlined, InventoryScreen()),
      _Tab('Bildirim', Icons.notifications_rounded, Icons.notifications_none_rounded, const NotificationsScreen(), badge: unread),
      const _Tab('Profil', Icons.person_rounded, Icons.person_outline_rounded, ProfileScreen()),
    ];
    if (_i >= tabs.length) _i = 0;
    final half = tabs.length ~/ 2;

    Widget item(int idx) {
      final tab = tabs[idx];
      final sel = idx == _i;
      final col = sel ? (t.dark ? t.teal : t.accent) : t.subtle;
      return Expanded(
        child: Pressable(
          onTap: () => setState(() => _i = idx),
          scale: .9,
          child: SizedBox(
            height: 62,
            child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
              Stack(clipBehavior: Clip.none, children: [
                AnimatedContainer(
                  duration: const Duration(milliseconds: 260),
                  curve: Curves.easeOutCubic,
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                  decoration: BoxDecoration(color: sel ? t.accentSoft : Colors.transparent, borderRadius: BorderRadius.circular(99)),
                  child: AnimatedScale(scale: sel ? 1.08 : 1, duration: const Duration(milliseconds: 260), curve: Curves.easeOutBack, child: Icon(sel ? tab.icon : tab.iconOff, color: col, size: 24)),
                ),
                if (tab.badge > 0)
                  Positioned(
                    right: 6,
                    top: -2,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                      decoration: BoxDecoration(color: t.danger, borderRadius: BorderRadius.circular(99), border: Border.all(color: t.surface, width: 2)),
                      child: Text(tab.badge > 9 ? '9+' : '${tab.badge}', style: TextStyle(color: t.dark ? Colors.black : Colors.white, fontSize: 10, fontWeight: FontWeight.w800)),
                    ),
                  ),
              ]),
              const SizedBox(height: 2),
              Text(tab.label, style: TextStyle(fontSize: 11, fontWeight: sel ? FontWeight.w800 : FontWeight.w600, color: col)),
            ]),
          ),
        ),
      );
    }

    return Scaffold(
      extendBody: true,
      backgroundColor: t.bg,
      body: AnimatedSwitcher(
        duration: const Duration(milliseconds: 260),
        switchInCurve: Curves.easeOutCubic,
        transitionBuilder: (c, a) => FadeTransition(opacity: a, child: SlideTransition(position: Tween(begin: const Offset(0, .02), end: Offset.zero).animate(a), child: c)),
        child: KeyedSubtree(key: ValueKey(tabs[_i].label), child: tabs[_i].page),
      ),
      bottomNavigationBar: Container(
        padding: EdgeInsets.only(bottom: MediaQuery.of(context).padding.bottom),
        decoration: BoxDecoration(color: t.surface, border: Border(top: BorderSide(color: t.border)), boxShadow: softShadow(t, blur: 24, y: -4)),
        child: Row(children: [
          for (var i = 0; i < half; i++) item(i),
          // Ortadaki büyük QR düğmesi
          Expanded(
            child: Transform.translate(
              offset: const Offset(0, -16),
              child: Pressable(
                onTap: () => context.push('/scan'),
                scale: .9,
                child: Container(
                  width: 62,
                  height: 62,
                  margin: const EdgeInsets.symmetric(horizontal: 8),
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: t.dark ? const [Color(0xFF1FB0D3), Color(0xFF0E7C97)] : const [Color(0xFF6A3F82), Color(0xFF462B55)]),
                    border: Border.all(color: t.surface, width: 4),
                    boxShadow: [BoxShadow(color: (t.dark ? t.teal : t.accent).withValues(alpha: .5), blurRadius: 20, offset: const Offset(0, 8), spreadRadius: -4)],
                  ),
                  child: Icon(Icons.qr_code_scanner_rounded, color: t.dark ? Colors.black : Colors.white, size: 30),
                ),
              ),
            ),
          ),
          for (var i = half; i < tabs.length; i++) item(i),
        ]),
      ),
    );
  }
}

class _Tab {
  const _Tab(this.label, this.icon, this.iconOff, this.page, {this.badge = 0});
  final String label;
  final IconData icon, iconOff;
  final Widget page;
  final int badge;
}
