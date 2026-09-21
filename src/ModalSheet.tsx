import { useEffect, useRef, type ReactNode } from 'react';

/** Native modality keeps keyboard focus in the editor and makes the page inert. */
export function ModalSheet({ label, onClose, children }: {
  label: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    element?.showModal();
    return () => {
      element?.close();
      if (opener?.isConnected) opener.focus();
    };
  }, []);
  return (
    <dialog ref={dialog} className="tower-sheet" aria-label={label}
      onCancel={event => { event.preventDefault(); onClose(); }}>
      <button type="button" className="sheet-dismiss" onClick={onClose}>Close</button>
      {children}
    </dialog>
  );
}
