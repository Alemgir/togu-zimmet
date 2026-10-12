import 'package:flutter_test/flutter_test.dart';
import 'package:togu_zimmet/core/api.dart';
import 'package:togu_zimmet/core/format.dart';

void main() {
  group('extractToken', () {
    test('tam bağlantıdan token çıkarır', () {
      expect(extractToken('http://localhost:8080/scan/cmgabc123XYZdef'), 'cmgabc123XYZdef');
      expect(extractToken('https://zimmet.gop.edu.tr/scan/cmgabc123XYZdef/'), 'cmgabc123XYZdef');
      expect(extractToken('https://x.io/scan/cmgabc123XYZdef?utm=1'), 'cmgabc123XYZdef');
    });
    test('çıplak token kabul edilir, çöp reddedilir', () {
      expect(extractToken('  cmgabc123XYZdef  '), 'cmgabc123XYZdef');
      expect(extractToken(''), isNull);
      expect(extractToken('kısa'), isNull);
      expect(extractToken('https://example.com/baska/sayfa'), isNull);
    });
  });

  test('trUpper Türkçe harfleri doğru büyütür', () {
    expect(trUpper('Üzerimdeki cihazlar'), 'ÜZERİMDEKİ CİHAZLAR');
    expect(trUpper('ıslak'), 'ISLAK');
  });

  test('initials', () {
    expect(initials('Ayşe Yılmaz'), 'AY');
    expect(initials('Deniz'), 'D');
  });
}
