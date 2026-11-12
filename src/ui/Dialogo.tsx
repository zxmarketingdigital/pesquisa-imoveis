import { useEffect, useRef, type ReactNode } from 'react';

export function Dialogo({ titulo, aoFechar, ocupado = false, children }: { titulo: string; aoFechar: () => void; ocupado?: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const anterior = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialogo = ref.current;
    dialogo?.showModal();
    return () => { dialogo?.close(); if (anterior?.isConnected) anterior.focus({preventScroll:true}); };
  },[]);
  return <dialog ref={ref} aria-label={titulo} onCancel={e => { e.preventDefault(); if (!ocupado) aoFechar(); }}><div className="dialog-heading"><h2>{titulo}</h2><button type="button" className="quiet" disabled={ocupado} onClick={aoFechar} aria-label="Fechar formulário">Fechar</button></div>{children}</dialog>;
}
