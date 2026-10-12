import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_svg/flutter_svg.dart';

import '../core/format.dart';
import '../core/logo_data.dart';
import '../core/models.dart';
import '../core/theme.dart';

// ───────────────────────── Marka ─────────────────────────
class BrandSymbol extends StatelessWidget {
  const BrandSymbol({super.key, this.size = 32});
  final double size;
  @override
  Widget build(BuildContext context) => SvgPicture.string(logoSymbolSvg, width: size, height: size);
}

class BrandFull extends StatelessWidget {
  const BrandFull({super.key, this.height = 28, this.onDark = false});
  final double height;
  final bool onDark;
  @override
  Widget build(BuildContext context) => SvgPicture.string(onDark ? logoFullOnDarkSvg : logoFullSvg, height: height);
}

/// Logo ile dönen yükleme göstergesi (web'deki ButtonLogoSpinner ile aynı fikir).
class LogoSpinner extends StatefulWidget {
  const LogoSpinner({super.key, this.size = 22, this.plate = true});
  final double size;
  final bool plate;
  @override
  State<LogoSpinner> createState() => _LogoSpinnerState();
}

class _LogoSpinnerState extends State<LogoSpinner> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 1100))..repeat();
  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final sym = RotationTransition(turns: CurvedAnimation(parent: _c, curve: Curves.easeInOutCubic), child: BrandSymbol(size: widget.size * .72));
    if (!widget.plate) return sym;
    return Container(
      width: widget.size,
      height: widget.size,
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(widget.size * .3)),
      alignment: Alignment.center,
      child: sym,
    );
  }
}

// ───────────────────────── Etkileşim ─────────────────────────
/// Basılınca hafifçe küçülen, dokunsal geri bildirim veren sarmalayıcı.
class Pressable extends StatefulWidget {
  const Pressable({super.key, required this.child, this.onTap, this.onLongPress, this.scale = .97, this.haptic = true});
  final Widget child;
  final VoidCallback? onTap, onLongPress;
  final double scale;
  final bool haptic;
  @override
  State<Pressable> createState() => _PressableState();
}

class _PressableState extends State<Pressable> {
  bool _down = false;
  @override
  Widget build(BuildContext context) {
    final enabled = widget.onTap != null || widget.onLongPress != null;
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTapDown: enabled ? (_) => setState(() => _down = true) : null,
      onTapCancel: enabled ? () => setState(() => _down = false) : null,
      onTapUp: enabled ? (_) => setState(() => _down = false) : null,
      onTap: widget.onTap == null
          ? null
          : () {
              if (widget.haptic) HapticFeedback.selectionClick();
              widget.onTap!();
            },
      onLongPress: widget.onLongPress,
      child: AnimatedScale(scale: _down ? widget.scale : 1, duration: const Duration(milliseconds: 120), curve: Curves.easeOut, child: widget.child),
    );
  }
}

/// Alttan kayarak ve solarak giren öğe; liste için `index` ile kademeli gecikme.
class Reveal extends StatelessWidget {
  const Reveal({super.key, required this.child, this.index = 0, this.dy = 14});
  final Widget child;
  final int index;
  final double dy;
  @override
  Widget build(BuildContext context) {
    if (MediaQuery.of(context).disableAnimations) return child;
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: 1),
      duration: Duration(milliseconds: 420 + math.min(index, 8) * 60),
      curve: Curves.easeOutCubic,
      builder: (_, v, c) => Opacity(opacity: v, child: Transform.translate(offset: Offset(0, (1 - v) * dy), child: c)),
      child: child,
    );
  }
}

class CountUp extends StatelessWidget {
  const CountUp(this.value, {super.key, this.style});
  final int value;
  final TextStyle? style;
  @override
  Widget build(BuildContext context) => TweenAnimationBuilder<double>(
        tween: Tween(begin: 0, end: value.toDouble()),
        duration: const Duration(milliseconds: 900),
        curve: Curves.easeOutCubic,
        builder: (_, v, __) => Text('${v.round()}', style: style),
      );
}

// ───────────────────────── Yüzeyler ─────────────────────────
class AppCard extends StatelessWidget {
  const AppCard({super.key, required this.child, this.padding = const EdgeInsets.all(16), this.onTap, this.color, this.border = true});
  final Widget child;
  final EdgeInsetsGeometry padding;
  final VoidCallback? onTap;
  final Color? color;
  final bool border;
  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final box = Container(
      decoration: BoxDecoration(
        color: color ?? t.surface,
        borderRadius: BorderRadius.circular(18),
        border: border ? Border.all(color: t.border) : null,
        boxShadow: softShadow(t, blur: 18, y: 4),
      ),
      padding: padding,
      child: child,
    );
    return onTap == null ? box : Pressable(onTap: onTap, child: box);
  }
}

class SectionTitle extends StatelessWidget {
  const SectionTitle(this.text, {super.key, this.trailing});
  final String text;
  final Widget? trailing;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(4, 22, 4, 10),
        child: Row(children: [
          Expanded(child: Text(trUpper(text), style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, letterSpacing: 1, color: context.t.muted))),
          if (trailing != null) trailing!,
        ]),
      );
}

// ───────────────────────── Rozet / ikon ─────────────────────────
class StatusChip extends StatelessWidget {
  const StatusChip(this.status, {super.key});
  final DeviceStatus status;
  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final c = switch (status) {
      DeviceStatus.inStock => t.info,
      DeviceStatus.assigned => t.success,
      DeviceStatus.faulty => t.danger,
      DeviceStatus.retired => t.muted,
    };
    return Chip2(label: statusLabel[status]!, color: c, dot: true);
  }
}

class Chip2 extends StatelessWidget {
  const Chip2({super.key, required this.label, required this.color, this.dot = false, this.icon});
  final String label;
  final Color color;
  final bool dot;
  final IconData? icon;
  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
        decoration: BoxDecoration(color: color.withValues(alpha: .13), borderRadius: BorderRadius.circular(99)),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          if (dot) Container(width: 6, height: 6, margin: const EdgeInsets.only(right: 6), decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
          if (icon != null) Padding(padding: const EdgeInsets.only(right: 4), child: Icon(icon, size: 13, color: color)),
          Text(label, style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: color)),
        ]),
      );
}

class DeviceIconBox extends StatelessWidget {
  const DeviceIconBox(this.type, {super.key, this.size = 46});
  final String type;
  final double size;
  @override
  Widget build(BuildContext context) {
    final c = typeColor(type);
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(size * .3),
        gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [c, Color.lerp(c, Colors.black, .28)!]),
        boxShadow: [BoxShadow(color: c.withValues(alpha: .35), blurRadius: 12, offset: const Offset(0, 5), spreadRadius: -4)],
      ),
      child: Icon(typeIcon(type), color: Colors.white, size: size * .5),
    );
  }
}

class Avatar extends StatelessWidget {
  const Avatar(this.name, {super.key, this.size = 40});
  final String name;
  final double size;
  @override
  Widget build(BuildContext context) {
    var h = 0;
    for (final c in name.runes) {
      h = (h * 31 + c) % 360;
    }
    final dark = context.t.dark;
    final col = HSLColor.fromAHSL(1, h.toDouble(), .45, dark ? .5 : .38).toColor();
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(color: col, shape: BoxShape.circle),
      child: Text(initials(name), style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: size * .36)),
    );
  }
}

// ───────────────────────── Düğme ─────────────────────────
enum BtnKind { primary, secondary, danger, ghost }

class AppButton extends StatelessWidget {
  const AppButton({super.key, required this.label, this.onPressed, this.icon, this.kind = BtnKind.primary, this.loading = false, this.expand = true});
  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final BtnKind kind;
  final bool loading;
  final bool expand;
  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final (bg, fg, brd) = switch (kind) {
      BtnKind.primary => (t.accent, t.accentFg, null),
      BtnKind.danger => (t.danger.withValues(alpha: t.dark ? .16 : .1), t.danger, t.danger.withValues(alpha: .35)),
      BtnKind.secondary => (t.surface, t.fg, t.border),
      BtnKind.ghost => (Colors.transparent, t.muted, null),
    };
    final disabled = onPressed == null || loading;
    return Pressable(
      onTap: disabled ? null : onPressed,
      scale: .96,
      child: AnimatedOpacity(
        opacity: onPressed == null && !loading ? .5 : 1,
        duration: const Duration(milliseconds: 150),
        child: Container(
          height: 52,
          width: expand ? double.infinity : null,
          padding: const EdgeInsets.symmetric(horizontal: 20),
          decoration: BoxDecoration(
            color: bg,
            borderRadius: BorderRadius.circular(15),
            border: brd == null ? null : Border.all(color: brd),
            boxShadow: kind == BtnKind.primary ? softShadow(t, blur: 18, y: 8) : null,
          ),
          child: Row(mainAxisSize: expand ? MainAxisSize.max : MainAxisSize.min, mainAxisAlignment: MainAxisAlignment.center, children: [
            if (loading)
              const LogoSpinner(size: 24)
            else if (icon != null) ...[Icon(icon, size: 19, color: fg), const SizedBox(width: 9)],
            if (!loading) Text(label, style: TextStyle(color: fg, fontWeight: FontWeight.w700, fontSize: 15.5)),
          ]),
        ),
      ),
    );
  }
}

// ───────────────────────── Yükleniyor / boş / hata ─────────────────────────
class Shimmer extends StatefulWidget {
  const Shimmer({super.key, this.height = 70, this.radius = 18});
  final double height, radius;
  @override
  State<Shimmer> createState() => _ShimmerState();
}

class _ShimmerState extends State<Shimmer> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 1300))..repeat();
  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    return AnimatedBuilder(
      animation: _c,
      builder: (_, __) => Container(
        height: widget.height,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(widget.radius),
          gradient: LinearGradient(
            begin: Alignment(-1.5 + _c.value * 3, 0),
            end: Alignment(-0.5 + _c.value * 3, 0),
            colors: [t.surface2, t.border.withValues(alpha: .7), t.surface2],
          ),
        ),
      ),
    );
  }
}

class SkeletonList extends StatelessWidget {
  const SkeletonList({super.key, this.count = 4, this.height = 84});
  final int count;
  final double height;
  @override
  Widget build(BuildContext context) => Column(children: [for (var i = 0; i < count; i++) Padding(padding: const EdgeInsets.only(bottom: 12), child: Shimmer(height: height))]);
}

class EmptyState extends StatelessWidget {
  const EmptyState({super.key, required this.icon, required this.title, this.message, this.action});
  final IconData icon;
  final String title;
  final String? message;
  final Widget? action;
  @override
  Widget build(BuildContext context) {
    final t = context.t;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 48, horizontal: 24),
      child: Column(children: [
        Container(
          width: 72,
          height: 72,
          decoration: BoxDecoration(color: t.accentSoft, shape: BoxShape.circle),
          child: Icon(icon, size: 32, color: t.teal),
        ),
        const SizedBox(height: 18),
        Text(title, textAlign: TextAlign.center, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
        if (message != null) ...[const SizedBox(height: 6), Text(message!, textAlign: TextAlign.center, style: TextStyle(color: t.muted, height: 1.4))],
        if (action != null) ...[const SizedBox(height: 18), action!],
      ]),
    );
  }
}

class ErrorState extends StatelessWidget {
  const ErrorState({super.key, required this.error, required this.onRetry});
  final Object error;
  final VoidCallback onRetry;
  @override
  Widget build(BuildContext context) => EmptyState(
        icon: Icons.cloud_off_rounded,
        title: 'Yüklenemedi',
        message: error.toString(),
        action: AppButton(label: 'Tekrar dene', icon: Icons.refresh_rounded, kind: BtnKind.secondary, expand: false, onPressed: onRetry),
      );
}

// ───────────────────────── Toast ─────────────────────────
enum ToastKind { success, error, info }

OverlayEntry? _toast;
Timer? _toastTimer;

void showToast(BuildContext context, String message, {ToastKind kind = ToastKind.success}) {
  final overlay = Overlay.of(context, rootOverlay: true);
  final tokens = context.t;
  _toast?.remove();
  _toastTimer?.cancel();
  HapticFeedback.lightImpact();
  final entry = OverlayEntry(builder: (ctx) => _ToastView(message: message, kind: kind, t: tokens));
  _toast = entry;
  overlay.insert(entry);
  _toastTimer = Timer(const Duration(milliseconds: 3200), () {
    if (_toast == entry) {
      entry.remove();
      _toast = null;
    }
  });
}

class _ToastView extends StatelessWidget {
  const _ToastView({required this.message, required this.kind, required this.t});
  final String message;
  final ToastKind kind;
  final Tokens t;
  @override
  Widget build(BuildContext context) {
    final c = switch (kind) { ToastKind.success => const Color(0xFF5FD3A0), ToastKind.error => const Color(0xFFFF8AA5), ToastKind.info => const Color(0xFF4CC6E6) };
    final icon = switch (kind) { ToastKind.success => Icons.check_circle_rounded, ToastKind.error => Icons.error_rounded, ToastKind.info => Icons.info_rounded };
    return Positioned(
      top: MediaQuery.of(context).padding.top + 10,
      left: 16,
      right: 16,
      child: Material(
        color: Colors.transparent,
        child: TweenAnimationBuilder<double>(
          tween: Tween(begin: 0, end: 1),
          duration: const Duration(milliseconds: 380),
          curve: Curves.easeOutBack,
          builder: (_, v, child) => Opacity(opacity: v.clamp(0, 1), child: Transform.translate(offset: Offset(0, (1 - v) * -30), child: child)),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            decoration: BoxDecoration(
              color: t.dark ? t.surface2 : t.sb,
              borderRadius: BorderRadius.circular(16),
              border: Border(left: BorderSide(color: c, width: 4)),
              boxShadow: softShadow(t, blur: 30, y: 12),
            ),
            child: Row(children: [
              Icon(icon, color: c, size: 22),
              const SizedBox(width: 12),
              Expanded(child: Text(message, style: TextStyle(color: t.dark ? t.fg : Colors.white, fontWeight: FontWeight.w600, fontSize: 14, height: 1.3))),
            ]),
          ),
        ),
      ),
    );
  }
}

// ───────────────────────── Alt sayfa (sheet) ─────────────────────────
Future<T?> showSheet<T>(BuildContext context, WidgetBuilder builder) => showModalBottomSheet<T>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Colors.transparent,
      barrierColor: Colors.black.withValues(alpha: .5),
      builder: (ctx) => Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.of(ctx).viewInsets.bottom),
        child: Container(
          decoration: BoxDecoration(color: ctx.t.surface, borderRadius: const BorderRadius.vertical(top: Radius.circular(26))),
          child: SafeArea(
            top: false,
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              Container(width: 40, height: 4, margin: const EdgeInsets.only(top: 10, bottom: 6), decoration: BoxDecoration(color: ctx.t.border, borderRadius: BorderRadius.circular(9))),
              Flexible(child: builder(ctx)),
            ]),
          ),
        ),
      ),
    );

class Field extends StatelessWidget {
  const Field({super.key, required this.controller, required this.label, this.icon, this.obscure = false, this.maxLines = 1, this.keyboard, this.onChanged, this.autofocus = false, this.suffix, this.textInputAction, this.onSubmitted});
  final TextEditingController controller;
  final String label;
  final IconData? icon;
  final bool obscure, autofocus;
  final int maxLines;
  final TextInputType? keyboard;
  final ValueChanged<String>? onChanged, onSubmitted;
  final Widget? suffix;
  final TextInputAction? textInputAction;
  @override
  Widget build(BuildContext context) {
    final t = context.t;
    OutlineInputBorder b(Color c, [double w = 1]) => OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide(color: c, width: w));
    return TextField(
      controller: controller,
      obscureText: obscure,
      maxLines: maxLines,
      keyboardType: keyboard,
      autofocus: autofocus,
      onChanged: onChanged,
      onSubmitted: onSubmitted,
      textInputAction: textInputAction,
      autocorrect: false,
      style: const TextStyle(fontSize: 15.5),
      cursorColor: t.teal,
      decoration: InputDecoration(
        labelText: label,
        labelStyle: TextStyle(color: t.muted),
        floatingLabelStyle: TextStyle(color: t.teal, fontWeight: FontWeight.w600),
        prefixIcon: icon == null ? null : Icon(icon, size: 20, color: t.muted),
        suffixIcon: suffix,
        filled: true,
        fillColor: t.surface2.withValues(alpha: t.dark ? .6 : .55),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
        enabledBorder: b(t.border),
        focusedBorder: b(t.teal, 1.6),
        border: b(t.border),
      ),
    );
  }
}
