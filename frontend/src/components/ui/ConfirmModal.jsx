export default function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  onCancel,
  onConfirm,
}) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/45 backdrop-blur-[1px]"
        onClick={onCancel}
        aria-label="Close modal"
      />
      <div className="relative w-full max-w-md sc-card p-6">
        <h3 className="text-lg sc-title">{title}</h3>
        {description && <p className="mt-2 text-sm sc-subtitle">{description}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="sc-btn sc-btn-secondary px-3 py-2 text-sm">
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`sc-btn px-3 py-2 text-sm ${destructive ? 'sc-btn-danger' : 'sc-btn-primary'}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
