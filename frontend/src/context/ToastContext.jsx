import { createContext, useContext, useState, useCallback, useRef } from "react";
import Icon from "../components/ui/Icon";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((t) => t.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (message, variant = "default") => {
      const id = ++idRef.current;
      setToasts((t) => [...t, { id, message, variant }]);
      // Errors stay a little longer so they can be read.
      setTimeout(() => dismiss(id), variant === "error" ? 7000 : 4200);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="toast-stack" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.variant}`} role={t.variant === "error" ? "alert" : "status"}>
            {t.variant === "success" && <Icon name="check-circle" />}
            {t.variant === "error" && <Icon name="alert-circle" />}
            <div className="toast-message">{t.message}</div>
            <button type="button" className="btn btn-icon" onClick={() => dismiss(t.id)} aria-label="Dismiss notification">
              <Icon name="x" size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
