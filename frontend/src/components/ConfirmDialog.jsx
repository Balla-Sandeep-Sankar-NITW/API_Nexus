import Modal from "./Modal";

export default function ConfirmDialog({ title, message, confirmLabel = "Confirm", danger, onConfirm, onCancel }) {
  return (
    <Modal
      title={title}
      onClose={onCancel}
      width="400px"
      footer={
        <>
          <button className="btn" onClick={onCancel}>
            Cancel
          </button>
          <button className={danger ? "btn btn-danger" : "btn btn-primary"} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </>
      }
    >
      <p style={{ margin: 0, fontSize: 13, color: "var(--ink-700)" }}>{message}</p>
    </Modal>
  );
}
