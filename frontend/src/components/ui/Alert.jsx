import Icon from "./Icon";

// Inline error. role="alert" so screen readers announce it when it appears.
export default function Alert({ children }) {
  return (
    <div className="alert alert-error" role="alert">
      <Icon name="alert-circle" size={16} />
      <div>{children}</div>
    </div>
  );
}
