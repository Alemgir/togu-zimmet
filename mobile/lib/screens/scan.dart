import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../core/api.dart';
import '../state/providers.dart';
import '../widgets/ui.dart';

class ScanScreen extends ConsumerStatefulWidget {
  const ScanScreen({super.key});
  @override
  ConsumerState<ScanScreen> createState() => _ScanScreenState();
}

class _ScanScreenState extends ConsumerState<ScanScreen> with SingleTickerProviderStateMixin {
  final _ctrl = MobileScannerController(detectionSpeed: DetectionSpeed.noDuplicates, formats: const [BarcodeFormat.qrCode]);
  late final AnimationController _line = AnimationController(vsync: this, duration: const Duration(milliseconds: 1800))..repeat(reverse: true);
  bool _busy = false, _torch = false, _found = false;

  @override
  void dispose() {
    _line.dispose();
    _ctrl.dispose();
    super.dispose();
  }

  Future<void> _resolve(String raw) async {
    if (_busy) return;
    final token = extractToken(raw);
    if (token == null) {
      showToast(context, 'Bu bir cihaz etiketi QR kodu değil', kind: ToastKind.error);
      return;
    }
    setState(() {
      _busy = true;
      _found = true;
    });
    HapticFeedback.heavyImpact();
    try {
      final d = await ref.read(apiProvider).deviceByQr(token);
      if (mounted) context.pushReplacement('/device/${d.id}');
    } on ApiException catch (e) {
      if (mounted) {
        showToast(context, e.message, kind: ToastKind.error);
        setState(() {
          _busy = false;
          _found = false;
        });
      }
    }
  }

  Future<void> _manual() async {
    final c = TextEditingController();
    await showSheet(
      context,
      (ctx) => Padding(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 20),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          const Text('Kodu elle gir', style: TextStyle(fontSize: 19, fontWeight: FontWeight.w800)),
          const SizedBox(height: 6),
          Text('QR bağlantısını (…/scan/…) veya cihaz kodunu yapıştırın.', style: TextStyle(color: ctx.t_muted, height: 1.4)),
          const SizedBox(height: 16),
          Field(controller: c, label: 'QR bağlantısı veya kod', icon: Icons.qr_code_2_rounded, autofocus: true),
          const SizedBox(height: 14),
          AppButton(
            label: 'Cihazı bul',
            icon: Icons.search_rounded,
            onPressed: () {
              final v = c.text;
              Navigator.pop(ctx);
              _resolve(v);
            },
          ),
        ]),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.of(context).size;
    final box = (size.width * .7).clamp(220.0, 320.0);
    return Scaffold(
      backgroundColor: Colors.black,
      body: Stack(fit: StackFit.expand, children: [
        MobileScanner(
          controller: _ctrl,
          onDetect: (cap) {
            final v = cap.barcodes.map((b) => b.rawValue).whereType<String>().firstOrNull;
            if (v != null) _resolve(v);
          },
          errorBuilder: (ctx, err) => _CameraError(err: err, onManual: _manual),
        ),
        // Karartma + çerçeve
        IgnorePointer(child: CustomPaint(painter: _MaskPainter(box, _found))),
        Center(
          child: SizedBox(
            width: box,
            height: box,
            child: AnimatedBuilder(
              animation: _line,
              builder: (_, __) => Stack(children: [
                if (!_found)
                  Positioned(
                    top: 8 + (box - 24) * Curves.easeInOut.transform(_line.value),
                    left: 14,
                    right: 14,
                    child: Container(height: 2.5, decoration: BoxDecoration(borderRadius: BorderRadius.circular(9), color: const Color(0xFF1FB0D3), boxShadow: const [BoxShadow(color: Color(0xFF1FB0D3), blurRadius: 14, spreadRadius: 1)])),
                  ),
              ]),
            ),
          ),
        ),
        SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Row(children: [
              _Glass(Icons.close_rounded, () => context.pop()),
              const Spacer(),
              _Glass(_torch ? Icons.flash_on_rounded : Icons.flash_off_rounded, () async {
                await _ctrl.toggleTorch();
                setState(() => _torch = !_torch);
              }, active: _torch),
            ]),
          ),
        ),
        Positioned(
          left: 24,
          right: 24,
          bottom: MediaQuery.of(context).padding.bottom + 26,
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              decoration: BoxDecoration(color: Colors.black.withValues(alpha: .55), borderRadius: BorderRadius.circular(99)),
              child: _busy
                  ? const Row(mainAxisSize: MainAxisSize.min, children: [LogoSpinner(size: 22), SizedBox(width: 10), Text('Cihaz aranıyor…', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600))])
                  : const Text('QR kodu çerçevenin içine getirin', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
            ),
            const SizedBox(height: 14),
            AppButton(label: 'Kodu elle gir', icon: Icons.keyboard_alt_outlined, kind: BtnKind.secondary, expand: false, onPressed: _manual),
          ]),
        ),
      ]),
    );
  }
}

extension on BuildContext {
  Color get t_muted => Theme.of(this).colorScheme.onSurface.withValues(alpha: .6);
}

class _Glass extends StatelessWidget {
  const _Glass(this.icon, this.onTap, {this.active = false});
  final IconData icon;
  final VoidCallback onTap;
  final bool active;
  @override
  Widget build(BuildContext context) => Pressable(
        onTap: onTap,
        child: Container(width: 46, height: 46, decoration: BoxDecoration(color: active ? const Color(0xFF1FB0D3) : Colors.black.withValues(alpha: .5), shape: BoxShape.circle), child: Icon(icon, color: Colors.white)),
      );
}

class _CameraError extends StatelessWidget {
  const _CameraError({required this.err, required this.onManual});
  final MobileScannerException err;
  final VoidCallback onManual;
  @override
  Widget build(BuildContext context) {
    final denied = err.errorCode == MobileScannerErrorCode.permissionDenied;
    return Container(
      color: const Color(0xFF14161A),
      alignment: Alignment.center,
      padding: const EdgeInsets.all(32),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Container(width: 76, height: 76, decoration: const BoxDecoration(color: Color(0x291FB0D3), shape: BoxShape.circle), child: Icon(denied ? Icons.no_photography_rounded : Icons.videocam_off_rounded, color: const Color(0xFF1FB0D3), size: 34)),
        const SizedBox(height: 18),
        Text(denied ? 'Kamera izni gerekli' : 'Kamera kullanılamıyor', style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w800)),
        const SizedBox(height: 8),
        Text(denied ? 'QR okutmak için ayarlardan kamera iznini açın.' : 'Bu cihazda kamera yok (simülatör olabilir). Kodu elle girebilirsiniz.', textAlign: TextAlign.center, style: const TextStyle(color: Color(0xFF9AA2AC), height: 1.4)),
        const SizedBox(height: 20),
        AppButton(label: 'Kodu elle gir', icon: Icons.keyboard_alt_outlined, expand: false, onPressed: onManual),
      ]),
    );
  }
}

class _MaskPainter extends CustomPainter {
  _MaskPainter(this.box, this.found);
  final double box;
  final bool found;
  @override
  void paint(Canvas c, Size s) {
    final rect = RRect.fromRectAndRadius(Rect.fromCenter(center: s.center(Offset.zero), width: box, height: box), const Radius.circular(26));
    c.saveLayer(Offset.zero & s, Paint());
    c.drawRect(Offset.zero & s, Paint()..color = Colors.black.withValues(alpha: .55));
    c.drawRRect(rect, Paint()..blendMode = BlendMode.clear);
    c.restore();
    final col = found ? const Color(0xFF5FD3A0) : Colors.white;
    final p = Paint()
      ..color = col
      ..style = PaintingStyle.stroke
      ..strokeWidth = 4
      ..strokeCap = StrokeCap.round;
    const L = 34.0;
    final r = rect.outerRect;
    for (final (cx, cy, dx, dy) in [(r.left, r.top, 1, 1), (r.right, r.top, -1, 1), (r.left, r.bottom, 1, -1), (r.right, r.bottom, -1, -1)]) {
      final path = Path()
        ..moveTo(cx, cy + dy * L)
        ..lineTo(cx, cy + dy * 14)
        ..quadraticBezierTo(cx, cy, cx + dx * 14, cy)
        ..lineTo(cx + dx * L, cy);
      c.drawPath(path, p);
    }
  }

  @override
  bool shouldRepaint(covariant _MaskPainter old) => old.found != found || old.box != box;
}
