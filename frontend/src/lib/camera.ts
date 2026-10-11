/** html5-qrcode tarayıcısının asgari arayüzü */
export interface Scanner {
  stop: () => Promise<void>;
  clear: () => void;
}

/**
 * Kamerayı güvenle kapatır. html5-qrcode, tarayıcı hiç başlamadıysa (izin reddi, kamera yok)
 * stop() çağrısında EŞZAMANLI hata fırlatır ("Cannot stop, scanner is not running or paused");
 * bu hata temizlik sırasında sayfayı çökertmesin.
 */
export function safeStop(scanner: Scanner | null | undefined): void {
  if (!scanner) return;
  const clear = () => {
    try {
      scanner.clear();
    } catch {
      /* zaten temiz */
    }
  };
  try {
    Promise.resolve(scanner.stop()).then(clear, clear);
  } catch {
    clear();
  }
}
