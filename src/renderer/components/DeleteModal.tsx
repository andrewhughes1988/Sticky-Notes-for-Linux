import React from 'react';

interface DeleteModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const DeleteModal: React.FC<DeleteModalProps> = ({ isOpen, onConfirm, onCancel }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay app-no-drag" onClick={onCancel}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">Delete note?</div>
        <div className="modal-body">
          This note will be permanently deleted.
        </div>
        <div className="modal-actions">
          <button className="modal-btn danger" onClick={onConfirm}>
            Delete
          </button>
          <button className="modal-btn" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
