interface NameInputProps {
  value: string;
  onChange: (value: string) => void;
  /** Called with the final text on Enter or blur. */
  onCommit: (value: string) => void;
  onCancel: () => void;
  className?: string;
  label?: string;
}

/** Inline rename field used by the Columns and Blocks views: Enter or blur commits, Escape cancels. */
export default function NameInput({ value, onChange, onCommit, onCancel, className, label = "Name" }: NameInputProps) {
  return (
    <input
      className={`inline-name ${className ?? ""}`}
      aria-label={label}
      autoFocus
      spellCheck={false}
      value={value}
      onFocus={(e) => e.target.select()}
      onChange={(e) => onChange(e.target.value)}
      onBlur={() => onCommit(value)}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") {
          e.preventDefault();
          onCommit(value);
        }
        if (e.key === "Escape") {
          e.preventDefault();
          onCancel();
        }
      }}
    />
  );
}
