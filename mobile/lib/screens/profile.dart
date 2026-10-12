import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/api.dart';
import '../core/theme.dart';
import '../core/models.dart';
import '../state/providers.dart';
import '../widgets/ui.dart';
import 'login.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.t;
    final me = currentUser(ref)!;
    final mode = ref.watch(themeModeProvider);
    final session = ref.read(sessionProvider);
    return SafeArea(
      bottom: false,
      child: ListView(padding: const EdgeInsets.fromLTRB(18, 14, 18, 120), children: [
        const Text('Profil', style: TextStyle(fontSize: 28, fontWeight: FontWeight.w800, letterSpacing: -.5)),
        const SizedBox(height: 16),
        Reveal(
          child: AppCard(
            padding: const EdgeInsets.all(20),
            child: Column(children: [
              Avatar(me.name, size: 76),
              const SizedBox(height: 12),
              Text(me.name, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
              const SizedBox(height: 2),
              Text(me.email, style: TextStyle(color: t.muted)),
              const SizedBox(height: 10),
              Wrap(spacing: 8, runSpacing: 6, alignment: WrapAlignment.center, children: [
                Chip2(label: roleLabel[me.role]!, color: t.teal, icon: Icons.verified_user_rounded),
                if (me.department != null) Chip2(label: me.department!, color: t.muted),
                if (me.title != null) Chip2(label: me.title!, color: t.muted),
              ]),
            ]),
          ),
        ),
        const SectionTitle('Görünüm'),
        Reveal(
          index: 1,
          child: AppCard(
            padding: const EdgeInsets.all(8),
            child: Row(children: [
              for (final (m, label, icon) in [(ThemeMode.system, 'Sistem', Icons.brightness_auto_rounded), (ThemeMode.light, 'Açık', Icons.light_mode_rounded), (ThemeMode.dark, 'Koyu', Icons.dark_mode_rounded)])
                Expanded(
                  child: Pressable(
                    onTap: () {
                      ref.read(themeModeProvider.notifier).state = m;
                      session.setThemeMode(m.name);
                    },
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 220),
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      decoration: BoxDecoration(color: mode == m ? (t.dark ? t.teal : t.accent) : Colors.transparent, borderRadius: BorderRadius.circular(13)),
                      child: Column(children: [
                        Icon(icon, size: 21, color: mode == m ? t.accentFg : t.muted),
                        const SizedBox(height: 3),
                        Text(label, style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: mode == m ? t.accentFg : t.muted)),
                      ]),
                    ),
                  ),
                ),
            ]),
          ),
        ),
        const SectionTitle('Hesap'),
        Reveal(
          index: 2,
          child: AppCard(
            padding: const EdgeInsets.symmetric(horizontal: 6),
            child: Column(children: [
              _Tile(Icons.key_rounded, 'Şifre değiştir', () => _changePassword(context, ref)),
              Divider(height: 1, color: t.border),
              _Tile(Icons.dns_outlined, 'Sunucu adresi', () => showServerSheet(context, ref), trailing: Uri.tryParse(session.baseUrl)?.host),
            ]),
          ),
        ),
        const SizedBox(height: 18),
        Reveal(index: 3, child: AppButton(label: 'Çıkış yap', icon: Icons.logout_rounded, kind: BtnKind.danger, onPressed: () => ref.read(authProvider.notifier).logout())),
        const SizedBox(height: 22),
        Center(child: Opacity(opacity: .8, child: Column(children: [const BrandFull(height: 22), const SizedBox(height: 6), Text('IT Demirbaş ve Zimmet · Mobil 1.0', style: TextStyle(color: t.subtle, fontSize: 12))]))),
      ]),
    );
  }
}

class _Tile extends StatelessWidget {
  const _Tile(this.icon, this.label, this.onTap, {this.trailing});
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final String? trailing;
  @override
  Widget build(BuildContext context) {
    final t = context.t;
    return Pressable(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 15),
        child: Row(children: [
          Icon(icon, size: 21, color: t.muted),
          const SizedBox(width: 14),
          Expanded(child: Text(label, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15))),
          if (trailing != null) Text(trailing!, style: TextStyle(color: t.subtle, fontSize: 12.5)),
          const SizedBox(width: 4),
          Icon(Icons.chevron_right_rounded, color: t.subtle),
        ]),
      ),
    );
  }
}

Future<void> _changePassword(BuildContext context, WidgetRef ref) {
  final cur = TextEditingController(), next = TextEditingController();
  bool busy = false;
  return showSheet(
    context,
    (ctx) => StatefulBuilder(
      builder: (ctx, set) => Padding(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 20),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          const Text('Şifre değiştir', style: TextStyle(fontSize: 19, fontWeight: FontWeight.w800)),
          const SizedBox(height: 4),
          Text('En az 8 karakter, en az bir harf ve bir rakam.', style: TextStyle(color: ctx.t.muted)),
          const SizedBox(height: 16),
          Field(controller: cur, label: 'Mevcut şifre', icon: Icons.lock_outline_rounded, obscure: true),
          const SizedBox(height: 12),
          Field(controller: next, label: 'Yeni şifre', icon: Icons.lock_reset_rounded, obscure: true),
          const SizedBox(height: 16),
          AppButton(
            label: 'Kaydet',
            icon: Icons.check_rounded,
            loading: busy,
            onPressed: () async {
              set(() => busy = true);
              try {
                await ref.read(apiProvider).changePassword(cur.text, next.text);
                if (ctx.mounted) Navigator.pop(ctx);
                if (context.mounted) showToast(context, 'Şifreniz güncellendi');
              } on ApiException catch (e) {
                if (ctx.mounted) showToast(ctx, e.message, kind: ToastKind.error);
              } finally {
                if (ctx.mounted) set(() => busy = false);
              }
            },
          ),
        ]),
      ),
    ),
  );
}
