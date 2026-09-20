import { createContext, useContext, useState, useCallback, useRef } from "react";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((t) => t.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (message, variant = "default", options = {}) => {
      const id = ++idRef.current;
      const toast = { id, message, variant, action: options.action };
      setToasts((t) => [...t, toast]);
      setTimeout(() => dismiss(id), options.action ? 6000 : 4200);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="toast-stack" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.variant}`}>
            <span onClick={() => dismiss(t.id)} style={{ cursor: "pointer" }}>{t.message}</span>
            {t.action && (
              <button
                className="btn btn-sm"
                style={{ marginLeft: 10, background: "transparent", borderColor: "rgba(255,255,255,0.4)", color: "#fff" }}
                onClick={() => {
                  t.action.onClick();
                  dismiss(t.id);
                }}
              >
                {t.action.label}
              </button>
            )}
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
