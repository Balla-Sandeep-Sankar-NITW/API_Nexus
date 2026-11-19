import { useId, useState } from "react";

// Rough, honest strength estimate: length matters most, variety helps.
export function passwordStrength(pw) {
  if (!pw) return { score: 0, label: "" };
  let score = 0;
  if (pw.length >= 8) score += 1;
  if (pw.length >= 12) score += 1;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score += 1;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score += 1;
  if (pw.length < 8) score = Math.min(score, 1);
  const label = ["Too short", "Weak", "Okay", "Good", "Strong"][score];
  return { score, label };
}

// Password input with a show/hide toggle and an optional strength meter.
export default function PasswordField({
  id, label, value, onChange, autoComplete = "current-password", autoFocus, required = true,
  showStrength = false, hint, error,
}) {
  const auto = useId();
  const inputId = id || auto;
  const [shown, setShown] = useState(false);
  const { score, label: strengthLabel } = passwordStrength(value);

  return (
    <div className="field">
      <label htmlFor={inputId}>{label}</label>
      <div className="password-wrap">
        <input
          id={inputId}
          type={shown ? "text" : "password"}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={`${inputId}-help`}
          required={required}
          autoFocus={autoFocus}
        />
        <button type="button" className="password-toggle" onClick={() => setShown((v) => !v)} aria-pressed={shown}>
          {shown ? "Hide" : "Show"}
        </button>
      </div>
      {showStrength && value && (
        <div className="strength" data-score={score} aria-live="polite">
          <div className="strength-bar" aria-hidden="true"><span style={{ width: `${(score / 4) * 100}%` }} /></div>
          <span className="strength-label">{strengthLabel}</span>
        </div>
      )}
      {error ? (
        <div id={`${inputId}-help`} className="field-error" role="alert">{error}</div>
      ) : hint ? (
        <div id={`${inputId}-help`} className="field-hint">{hint}</div>
      ) : null}
    </div>
  );
}
