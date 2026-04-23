import { useState, useRef, useEffect } from 'react';
import { Pencil, Check, X } from 'lucide-react';

interface EditableTitleProps {
  value: string;
  onSave: (value: string) => Promise<void>;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  readOnly?: boolean;
}

const sizeClasses = {
  sm: 'text-base font-semibold',
  md: 'text-xl font-semibold',
  lg: 'text-2xl font-bold',
};

export function EditableTitle({
  value,
  onSave,
  size = 'md',
  className = '',
  readOnly = false,
}: EditableTitleProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = async () => {
    if (inputValue.trim() && inputValue !== value) {
      setIsSaving(true);
      try {
        await onSave(inputValue.trim());
      } finally {
        setIsSaving(false);
      }
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setInputValue(value);
    setIsEditing(false);
  };

  if (!isEditing) {
    return (
      <div className={`group flex items-center gap-2 ${className}`}>
        <span className={`${sizeClasses[size]} text-text-primary`}>
          {value}
        </span>
        {!readOnly && (
          <button
            onClick={() => setIsEditing(true)}
            className="opacity-0 transition-opacity group-hover:opacity-100"
          >
            <Pencil size={18} className="text-text-secondary" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        className={`${sizeClasses[size]} rounded-md border border-border bg-card px-3 py-1 text-text-primary focus:border-primary focus:outline-none`}
      />
      <button
        onClick={handleSave}
        disabled={isSaving}
        className="inline-flex items-center justify-center rounded p-1 transition-colors hover:bg-card disabled:opacity-50"
      >
        <Check size={18} className="text-success" />
      </button>
      <button
        onClick={handleCancel}
        disabled={isSaving}
        className="inline-flex items-center justify-center rounded p-1 transition-colors hover:bg-card disabled:opacity-50"
      >
        <X size={18} className="text-error" />
      </button>
    </div>
  );
}
