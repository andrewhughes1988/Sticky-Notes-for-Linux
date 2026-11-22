import React, { useId, useLayoutEffect, useRef } from 'react';

interface DeleteModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting?: boolean;
  error?: string | null;
}

const DeleteModalComponent: React.FC<DeleteModalProps> = ({
  isOpen, onConfirm, onCancel, isDeleting = false, error,
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!isOpen || !dialog) return;

    dialog.showModal();
    cancelRef.current?.focus();
    return () => dialog.close();
  }, [isOpen]);

  return (
    <dialog
      ref={dialogRef}
      className="modal-dialog app-no-drag"
      role="alertdialog"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onClick={(event) => {
        if (isDeleting || event.target !== event.currentTarget) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right
          || event.clientY < rect.top || event.clientY > rect.bottom) onCancel();
      }}
      onCancel={(event) => {
        event.preventDefault();
        if (!isDeleting) onCancel();
      }}
    >
      <div className="modal-title" id={titleId}>Delete note?</div>
      <div className="modal-body" id={descriptionId}>
        This note will be permanently deleted.
      </div>
      {error && <div className="modal-body" role="alert">{error}</div>}
      <div className="modal-actions">
        <button type="button" className="modal-btn danger" aria-disabled={isDeleting} onClick={() => {
          if (!isDeleting) onConfirm();
        }}>
          {isDeleting ? 'Deleting…' : 'Delete'}
        </button>
        <button type="button" ref={cancelRef} className="modal-btn" aria-disabled={isDeleting} onClick={() => {
          if (!isDeleting) onCancel();
        }}>
          Cancel
        </button>
      </div>
    </dialog>
  );
};

export const DeleteModal = React.memo(DeleteModalComponent);
