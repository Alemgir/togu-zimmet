import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

/** Liste filtrelerini URL ile senkron tutar (paylaşılabilir/yenilemeye dayanıklı). */
export function useListParams(defaults: Record<string, string> = {}) {
  const [sp, setSp] = useSearchParams();
  const get = (k: string) => sp.get(k) ?? defaults[k] ?? '';
  const set = useCallback(
    (patch: Record<string, string | number | undefined>) => {
      setSp(
        (prev) => {
          const n = new URLSearchParams(prev);
          const resetsPage = Object.keys(patch).some((k) => k !== 'page');
          for (const [k, v] of Object.entries(patch)) {
            if (v === undefined || v === '' || String(v) === (defaults[k] ?? '')) n.delete(k);
            else n.set(k, String(v));
          }
          if (resetsPage && !('page' in patch)) n.delete('page');
          return n;
        },
        { replace: true },
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setSp],
  );
  const page = Math.max(1, Number(sp.get('page')) || 1);
  return { get, set, page, clear: () => setSp({}, { replace: true }), hasAny: [...sp.keys()].length > 0 };
}
