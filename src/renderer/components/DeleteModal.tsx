import React, { useId, useLayoutEffect, useRef } from 'react';

interface DeleteModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting?: boolean;
  error?: string | null;
  title?: string;
  description?: string;
  confirmLabel?: string;
}

const DeleteModalComponent: React.FC<DeleteModalProps> = ({
  isOpen,
  onConfirm,
  onCancel,
  isDeleting = false,
  error,
  title = 'Move note to Trash?',
  description = 'You can restore this note from Trash in the Notes Manager, or permanently delete it there.',
  confirmLabel = 'Move to Trash',
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

    const handleBackdropClick = (event: MouseEvent) => {
      if (isDeleting || event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      if (
        event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom
      ) {
        onCancel();
      }
    };
    dialog.addEventListener('click', handleBackdropClick);

    return () => {
      dialog.removeEventListener('click', handleBackdropClick);
      if (dialog.open) dialog.close();
    };
  }, [isOpen, isDeleting, onCancel]);

  return (
    <dialog
      ref={dialogRef}
      className="modal-dialog app-no-drag"
      role="alertdialog"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={(event) => {
        event.preventDefault();
        if (!isDeleting) onCancel();
      }}
    >
      <div className="modal-title" id={titleId}>
        {title}
      </div>
      <div className="modal-body" id={descriptionId}>
        {description}
      </div>
      {error && (
        <div className="modal-body modal-error" role="alert">
          {error}
        </div>
      )}
      <div className="modal-actions">
        <button
          type="button"
          className="modal-btn danger"
          aria-disabled={isDeleting}
          onClick={() => {
            if (!isDeleting) onConfirm();
          }}
        >
          {isDeleting ? 'Working…' : confirmLabel}
        </button>
        <button
          type="button"
          ref={cancelRef}
          className="modal-btn"
          aria-disabled={isDeleting}
          onClick={() => {
            if (!isDeleting) onCancel();
          }}
        >
          Cancel
        </button>
      </div>
    </dialog>
  );
};

export const DeleteModal = React.memo(DeleteModalComponent);
