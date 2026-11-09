import React, { useEffect, useRef } from 'react';
import { Trash2, AlertTriangle, Info, CheckCircle2, X } from 'lucide-react';

export default function ConfirmModal({ dialog, onClose }) {
  const confirmBtnRef = useRef(null);

  useEffect(() => {
    if (!dialog || !dialog.isOpen) return;

    // Foca automaticamente no botão de ação principal
    const timer = setTimeout(() => {
      if (confirmBtnRef.current) {
        confirmBtnRef.current.focus();
      }
    }, 50);

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (dialog.onCancel) dialog.onCancel();
        onClose();
      } else if (e.key === 'Enter' && !dialog.isConfirm) {
        e.preventDefault();
        if (dialog.onConfirm) dialog.onConfirm();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [dialog, onClose]);

  if (!dialog || !dialog.isOpen) return null;

  const {
    variant = 'danger',
    title,
    message,
    description,
    confirmText,
    cancelText = 'Cancelar',
    isConfirm = true,
    onConfirm,
    onCancel,
  } = dialog;

  const handleConfirm = () => {
    if (onConfirm) onConfirm();
    onClose();
  };

  const handleCancel = () => {
    if (onCancel) onCancel();
    onClose();
  };

  const renderIcon = () => {
    switch (variant) {
      case 'danger':
        return <Trash2 size={26} className="modal-icon-svg" />;
      case 'warning':
        return <AlertTriangle size={26} className="modal-icon-svg" />;
      case 'success':
        return <CheckCircle2 size={26} className="modal-icon-svg" />;
      case 'info':
      default:
        return <Info size={26} className="modal-icon-svg" />;
    }
  };

  return (
    <div className="custom-dialog-backdrop" onClick={handleCancel}>
      <div
        className={`custom-dialog-container variant-${variant}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <button
          type="button"
          className="custom-dialog-close-btn"
          onClick={handleCancel}
          aria-label="Fechar"
        >
          <X size={18} />
        </button>

        <div className="custom-dialog-content">
          <div className={`custom-dialog-icon-wrapper variant-${variant}`}>
            <div className="custom-dialog-icon-pulse"></div>
            {renderIcon()}
          </div>

          <div className="custom-dialog-texts">
            {title && <h3 className="custom-dialog-title">{title}</h3>}
            {message && <p className="custom-dialog-message">{message}</p>}
            {description && <p className="custom-dialog-description">{description}</p>}
          </div>
        </div>

        <div className="custom-dialog-actions">
          {isConfirm && (
            <button
              type="button"
              className="custom-dialog-btn btn-cancel"
              onClick={handleCancel}
            >
              {cancelText}
            </button>
          )}

          <button
            ref={confirmBtnRef}
            type="button"
            className={`custom-dialog-btn btn-confirm variant-${variant}`}
            onClick={handleConfirm}
          >
            {confirmText || (isConfirm ? 'Confirmar' : 'Entendido')}
          </button>
        </div>
      </div>
    </div>
  );
}

