import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/api.dart';
import '../core/theme.dart';
import '../state/providers.dart';
import '../widgets/ui.dart';

const _demo = bool.fromEnvironment('DEMO_LOGIN', defaultValue: true);

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});
  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> with SingleTickerProviderStateMixin {
  final _email = TextEditingController();
  final _pass = TextEditingController();
  bool _busy = false, _show = false;
  late final AnimationController _shake = AnimationController(vsync: this, duration: const Duration(milliseconds: 420));

  @override
  void dispose() {
    _email.dispose();
    _pass.dispose();
    _shake.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_busy) return;
    final e = _email.text.trim(), p = _pass.text;
    if (e.isEmpty || p.isEmpty) {
      _fail('E-posta ve şifre gerekli');
      return;
    }
    FocusScope.of(context).unfocus();
    setState(() => _busy = true);
    try {
      await ref.read(authProvider.notifier).login(e, p);
    } on ApiException catch (ex) {
      if (mounted) _fail(ex.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _fail(String m) {
    HapticFeedback.mediumImpact();
    _shake.forward(from: 0);
    showToast(context, m, kind: ToastKind.error);
  }

  void _fill(String e, String p) {
    HapticFeedback.selectionClick();
    setState(() {
      _email.text = e;
      _pass.text = p;
    });
  }

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final expired = ref.watch(authProvider) is SignedOut && (ref.watch(authProvider) as SignedOut).expired;
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
      backgroundColor: t.bg,
      body: Stack(children: [
        // Kömür başlık + çini deseni
        Positioned(top: 0, left: 0, right: 0, height: 360, child: DecoratedBox(decoration: BoxDecoration(color: t.sb), child: CustomPaint(painter: _TilePainter(t.dark)))),
        SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(22, 20, 22, 28),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 460),
                child: Column(children: [
                  Reveal(child: _Hero()),
                  const SizedBox(height: 26),
                  Reveal(
                    index: 2,
                    child: AnimatedBuilder(
                      animation: _shake,
                      builder: (_, child) => Transform.translate(offset: Offset(_shakeX(_shake.value), 0), child: child),
                      child: AppCard(
                        padding: const EdgeInsets.all(22),
                        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                          const Text('Giriş yap', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
                          const SizedBox(height: 4),
                          Text('Kurumsal hesabınızla devam edin', style: TextStyle(color: t.muted)),
                          if (expired) ...[
                            const SizedBox(height: 12),
                            Chip2(label: 'Oturum süresi doldu, tekrar giriş yapın', color: t.warning, icon: Icons.lock_clock_rounded),
                          ],
                          const SizedBox(height: 20),
                          Field(controller: _email, label: 'E-posta', icon: Icons.alternate_email_rounded, keyboard: TextInputType.emailAddress, textInputAction: TextInputAction.next),
                          const SizedBox(height: 12),
                          Field(
                            controller: _pass,
                            label: 'Şifre',
                            icon: Icons.lock_outline_rounded,
                            obscure: !_show,
                            textInputAction: TextInputAction.done,
                            onSubmitted: (_) => _submit(),
                            suffix: IconButton(
                              tooltip: _show ? 'Şifreyi gizle' : 'Şifreyi göster',
                              icon: Icon(_show ? Icons.visibility_off_rounded : Icons.visibility_rounded, size: 20, color: t.muted),
                              onPressed: () => setState(() => _show = !_show),
                            ),
                          ),
                          const SizedBox(height: 20),
                          AppButton(label: 'Giriş yap', icon: Icons.login_rounded, loading: _busy, onPressed: _submit),
                        ]),
                      ),
                    ),
                  ),
                  if (_demo) ...[
                    const SizedBox(height: 16),
                    Reveal(
                      index: 3,
                      child: AppCard(
                        padding: const EdgeInsets.fromLTRB(16, 14, 12, 14),
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Row(children: [
                            Icon(Icons.bolt_rounded, size: 18, color: t.teal),
                            const SizedBox(width: 6),
                            Text('Demo hesaplar', style: TextStyle(fontWeight: FontWeight.w700, color: t.muted, fontSize: 13)),
                          ]),
                          const SizedBox(height: 10),
                          Wrap(spacing: 8, runSpacing: 8, children: [
                            _DemoChip('Yönetici', Icons.shield_rounded, () => _fill('admin@gop.edu.tr', 'Admin123!')),
                            _DemoChip('Birim sorumlusu', Icons.groups_rounded, () => _fill('mehmet.kaya@gop.edu.tr', 'Demo1234')),
                            _DemoChip('Personel', Icons.person_rounded, () => _fill('ayse.yilmaz@gop.edu.tr', 'Demo1234')),
                          ]),
                        ]),
                      ),
                    ),
                  ],
                  const SizedBox(height: 14),
                  Reveal(index: 4, child: TextButton.icon(onPressed: () => showServerSheet(context, ref), icon: Icon(Icons.dns_outlined, size: 17, color: t.muted), label: Text('Sunucu: ${_host(ref.read(sessionProvider).baseUrl)}', style: TextStyle(color: t.muted, fontSize: 12.5)))),
                ]),
              ),
            ),
          ),
        ),
      ]),
    ));
  }
}

double _shakeX(double v) => v == 0 ? 0 : math.sin(v * math.pi * 6) * (1 - v) * 10;

String _host(String url) => Uri.tryParse(url)?.host.isNotEmpty == true ? Uri.parse(url).host : url;

class _Hero extends StatelessWidget {
  @override
  Widget build(BuildContext context) => Column(children: [
        const SizedBox(height: 8),
        TweenAnimationBuilder<double>(
          tween: Tween(begin: 0, end: 1),
          duration: const Duration(milliseconds: 1100),
          curve: Curves.easeOutBack,
          builder: (_, v, child) => Transform.rotate(angle: (1 - v) * -1.2, child: Transform.scale(scale: .3 + .7 * v, child: Opacity(opacity: v.clamp(0, 1), child: child))),
          child: Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(24), boxShadow: const [BoxShadow(color: Color(0x66000000), blurRadius: 30, offset: Offset(0, 14), spreadRadius: -8)]),
            child: const BrandSymbol(size: 64),
          ),
        ),
        const SizedBox(height: 18),
        const Text('IT Demirbaş ve Zimmet', style: TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.w800, letterSpacing: -.3)),
        const SizedBox(height: 4),
        const Text('Tokat Gaziosmanpaşa Üniversitesi', style: TextStyle(color: Color(0xFFAAB1BA), fontSize: 13.5)),
      ]);
}

class _DemoChip extends StatelessWidget {
  const _DemoChip(this.label, this.icon, this.onTap);
  final String label;
  final IconData icon;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) {
    final t = context.t;
    return Pressable(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
        decoration: BoxDecoration(color: t.accentSoft, borderRadius: BorderRadius.circular(12)),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          Icon(icon, size: 16, color: t.dark ? t.teal : t.accent),
          const SizedBox(width: 6),
          Text(label, style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: t.dark ? t.teal : t.accent)),
        ]),
      ),
    );
  }
}

/// Başlık arka planı: web'deki "çini kafes" fikrinin hafif, sade bir yorumu.
class _TilePainter extends CustomPainter {
  _TilePainter(this.dark);
  final bool dark;
  @override
  void paint(Canvas c, Size s) {
    final p = Paint()
      ..color = const Color(0xFF0098C0).withValues(alpha: .10)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.2;
    const step = 46.0;
    for (var y = -step; y < s.height + step; y += step) {
      for (var x = -step; x < s.width + step; x += step) {
        final o = ((y / step).round().isOdd) ? step / 2 : 0.0;
        final cx = x + o, cy = y;
        final path = Path()
          ..moveTo(cx, cy - 14)
          ..lineTo(cx + 14, cy)
          ..lineTo(cx, cy + 14)
          ..lineTo(cx - 14, cy)
          ..close();
        c.drawPath(path, p);
      }
    }
    final fade = Paint()
      ..shader = LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Colors.transparent, dark ? const Color(0xFF14161A) : const Color(0xFFF4F5F7)], stops: const [.55, 1]).createShader(Offset.zero & s);
    c.drawRect(Offset.zero & s, fade);
  }

  @override
  bool shouldRepaint(covariant _TilePainter old) => old.dark != dark;
}

/// Sunucu adresi ayarı (telefon localhost'a ulaşamaz; canlı veya yerel ağ adresi girilir).
Future<void> showServerSheet(BuildContext context, WidgetRef ref) {
  final session = ref.read(sessionProvider);
  final ctrl = TextEditingController(text: session.baseUrl);
  return showSheet(
    context,
    (ctx) => Padding(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 20),
      child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        const Text('Sunucu adresi', style: TextStyle(fontSize: 19, fontWeight: FontWeight.w800)),
        const SizedBox(height: 6),
        Text('API adresi. Yerel Docker için bilgisayarınızın ağ adresini kullanın (örn. http://192.168.1.20:3000/api).', style: TextStyle(color: ctx.t.muted, height: 1.4)),
        const SizedBox(height: 16),
        Field(controller: ctrl, label: 'API adresi', icon: Icons.link_rounded, keyboard: TextInputType.url),
        const SizedBox(height: 16),
        AppButton(
          label: 'Kaydet',
          icon: Icons.check_rounded,
          onPressed: () async {
            final v = ctrl.text.trim();
            if (!RegExp(r'^https?://').hasMatch(v)) {
              showToast(ctx, 'Adres http:// veya https:// ile başlamalı', kind: ToastKind.error);
              return;
            }
            await session.setBaseUrl(v);
            if (ctx.mounted) {
              Navigator.pop(ctx);
              showToast(context, 'Sunucu adresi kaydedildi');
            }
          },
        ),
        const SizedBox(height: 8),
        AppButton(
          label: 'Varsayılana dön',
          kind: BtnKind.ghost,
          onPressed: () async {
            await session.resetBaseUrl();
            if (ctx.mounted) Navigator.pop(ctx);
          },
        ),
      ]),
    ),
  );
}
