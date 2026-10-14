import { useCallback } from 'react';
import { useSearchParams } from 'react-router';

/** O dossiê aberto vive na URL (?lead=id): funciona em qualquer tela e pode ser compartilhado. */
export function useLeadDrawer() {
  const [params, setParams] = useSearchParams();
  const leadId = params.get('lead');
  const open = useCallback(
    (id: string) =>
      setParams((p) => {
        p.set('lead', id);
        return p;
      }),
    [setParams],
  );
  const close = useCallback(
    () =>
      setParams((p) => {
        p.delete('lead');
        return p;
      }),
    [setParams],
  );
  return { leadId, open, close };
}
