import { type MouseEvent, type PointerEvent, type ReactNode, useEffect, useRef } from "react";

interface ModalProps {
  labelledBy: string;
  className: string;
  onClose: () => void;
  children: ReactNode;
}

export function Modal({ labelledBy, className, onClose, children }: ModalProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const startedOnBackdrop = useRef(false);

  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);

  function isBackdrop(event: MouseEvent<HTMLDialogElement> | PointerEvent<HTMLDialogElement>) {
    if (event.target !== event.currentTarget) return false;
    const rect = event.currentTarget.getBoundingClientRect();
    return (
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom
    );
  }

  return (
    <dialog
      ref={dialog}
      aria-labelledby={labelledBy}
      className={`m-auto max-h-[calc(100dvh-2rem)] max-w-[calc(100vw-2rem)] overflow-y-auto rounded-xl border border-zinc-800 bg-[#09090b] text-zinc-100 shadow-2xl backdrop:bg-black/60 ${className}`}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") event.stopPropagation();
      }}
      onPointerDown={(event) => {
        startedOnBackdrop.current = isBackdrop(event);
      }}
      onPointerCancel={() => {
        startedOnBackdrop.current = false;
      }}
      onClick={(event) => {
        const dismiss = startedOnBackdrop.current && isBackdrop(event);
        startedOnBackdrop.current = false;
        if (dismiss) onClose();
      }}
    >
      {children}
    </dialog>
  );
}
