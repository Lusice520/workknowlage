import { useEffect, useRef, useState } from 'react';

interface SidebarInlineEditInputProps {
  defaultValue: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

const inlineEditInputStyle = {
  fontSize: '12px',
  lineHeight: '1.2',
};

export function SidebarInlineEditInput({
  defaultValue,
  onConfirm,
  onCancel,
}: SidebarInlineEditInputProps): JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    const el = inputRef.current;
    if (el) {
      el.focus();
      el.select();
    }
  }, []);

  const handleConfirm = (): void => {
    const trimmed = value.trim();
    if (trimmed && trimmed !== defaultValue) {
      onConfirm(trimmed);
      return;
    }

    onCancel();
  };

  return (
    <input
      ref={inputRef}
      type="text"
      value={value}
      onChange={(event) => setValue(event.target.value)}
      onBlur={handleConfirm}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          handleConfirm();
        }
        if (event.key === 'Escape') {
          onCancel();
        }
      }}
      className="flex-1 min-w-0 rounded-[6px] border border-blue-300/90 bg-white px-1.5 py-px font-normal text-slate-800 outline-none ring-1 ring-blue-100 transition-all"
      style={inlineEditInputStyle}
      onClick={(event) => event.stopPropagation()}
    />
  );
}
