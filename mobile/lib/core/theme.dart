import 'package:flutter/material.dart';

/// Web ile aynı tasarım belirteçleri (frontend/src/index.css) — TOGÜ kurumsal kimlik renkleri.
@immutable
class Tokens extends ThemeExtension<Tokens> {
  const Tokens({
    required this.bg,
    required this.surface,
    required this.surface2,
    required this.border,
    required this.fg,
    required this.muted,
    required this.subtle,
    required this.accent,
    required this.accentFg,
    required this.accentSoft,
    required this.teal,
    required this.success,
    required this.warning,
    required this.danger,
    required this.info,
    required this.sb,
    required this.shadow,
    required this.dark,
  });

  final Color bg, surface, surface2, border, fg, muted, subtle, accent, accentFg, accentSoft, teal, success, warning, danger, info, sb, shadow;
  final bool dark;

  static const light = Tokens(
    bg: Color(0xFFF4F5F7),
    surface: Color(0xFFFFFFFF),
    surface2: Color(0xFFECEEF1),
    border: Color(0xFFDFE2E7),
    fg: Color(0xFF1C1F24),
    muted: Color(0xFF5F6670),
    subtle: Color(0xFF59606A),
    accent: Color(0xFF462B55),
    accentFg: Color(0xFFFFFFFF),
    accentSoft: Color(0x1C462B55),
    teal: Color(0xFF0098C0),
    success: Color(0xFF17694A),
    warning: Color(0xFF855A08),
    danger: Color(0xFF910C32),
    info: Color(0xFF00677F),
    sb: Color(0xFF21252B),
    shadow: Color(0x2B1C1F24),
    dark: false,
  );

  static const darkTheme = Tokens(
    bg: Color(0xFF14161A),
    surface: Color(0xFF1B1E23),
    surface2: Color(0xFF23272D),
    border: Color(0xFF2E343C),
    fg: Color(0xFFECEEF1),
    muted: Color(0xFF9AA2AC),
    subtle: Color(0xFF8A929C),
    accent: Color(0xFF1FB0D3),
    accentFg: Color(0xFF06222B),
    accentSoft: Color(0x291FB0D3),
    teal: Color(0xFF1FB0D3),
    success: Color(0xFF5FD3A0),
    warning: Color(0xFFE8B64A),
    danger: Color(0xFFFF8AA5),
    info: Color(0xFF4CC6E6),
    sb: Color(0xFF0F1114),
    shadow: Color(0xB3000000),
    dark: true,
  );

  @override
  Tokens copyWith() => this;

  @override
  Tokens lerp(ThemeExtension<Tokens>? other, double t) => t < .5 ? this : (other as Tokens);
}

extension TokensX on BuildContext {
  Tokens get t => Theme.of(this).extension<Tokens>()!;
}

ThemeData buildTheme(Tokens t) {
  final base = ThemeData(
    useMaterial3: true,
    brightness: t.dark ? Brightness.dark : Brightness.light,
    scaffoldBackgroundColor: t.bg,
    colorScheme: ColorScheme.fromSeed(seedColor: t.accent, brightness: t.dark ? Brightness.dark : Brightness.light).copyWith(
      primary: t.accent,
      onPrimary: t.accentFg,
      surface: t.surface,
      onSurface: t.fg,
      error: t.danger,
    ),
    splashFactory: InkRipple.splashFactory,
    extensions: [t],
  );
  return base.copyWith(
    textTheme: base.textTheme.apply(bodyColor: t.fg, displayColor: t.fg),
    dividerColor: t.border,
    pageTransitionsTheme: const PageTransitionsTheme(builders: {
      TargetPlatform.android: CupertinoPageTransitionsBuilder(),
      TargetPlatform.iOS: CupertinoPageTransitionsBuilder(),
    }),
  );
}

List<BoxShadow> softShadow(Tokens t, {double blur = 24, double y = 8}) => [
      BoxShadow(color: t.shadow.withValues(alpha: t.dark ? .45 : .12), blurRadius: blur, offset: Offset(0, y), spreadRadius: -6),
      BoxShadow(color: t.shadow.withValues(alpha: .05), blurRadius: 3, offset: const Offset(0, 1)),
    ];
