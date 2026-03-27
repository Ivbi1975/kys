import { useState, useEffect, useRef, useCallback, memo } from "react";
import { Input } from "@/components/ui/input";

interface LocalInputProps {
  value: string;
  onCommit: (value: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  className?: string;
  placeholder?: string;
  "aria-label"?: string;
  "data-group-cell"?: string;
}

export const LocalInput = memo(function LocalInput({
  value: externalValue,
  onCommit,
  onKeyDown,
  className,
  placeholder,
  ...rest
}: LocalInputProps) {
  const [localValue, setLocalValue] = useState(externalValue);
  const committedRef = useRef(false);

  useEffect(() => {
    setLocalValue(externalValue);
  }, [externalValue]);

  const commitValue = useCallback(() => {
    if (committedRef.current) return;
    committedRef.current = true;
    if (localValue !== externalValue) {
      onCommit(localValue);
    }
  }, [localValue, externalValue, onCommit]);

  const handleBlur = useCallback(() => {
    commitValue();
  }, [commitValue]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    committedRef.current = false;
    if (e.key === "Enter") {
      commitValue();
    }
    if (e.key === "Tab") {
      commitValue();
    }
    if (onKeyDown) {
      onKeyDown(e);
    }
  }, [commitValue, onKeyDown]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    committedRef.current = false;
    setLocalValue(e.target.value);
  }, []);

  return (
    <Input
      className={className}
      value={localValue}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      {...rest}
    />
  );
});
