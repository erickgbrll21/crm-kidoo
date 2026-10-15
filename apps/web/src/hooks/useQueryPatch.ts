'use client';

import { useCallback } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

const emptyParams = new URLSearchParams();

/** Atualiza a query string sem perder os outros parâmetros (ex.: ?lead=). */
export function useQueryPatch() {
  const params = useSearchParams() ?? emptyParams;
  const pathname = usePathname() ?? '/';
  const router = useRouter();
  const setParams = useCallback(
    (mutate: (p: URLSearchParams) => URLSearchParams) => {
      const next = new URLSearchParams(params.toString());
      mutate(next);
      const q = next.toString();
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );
  return [params, setParams] as const;
}
