import React from 'react';
import { CheckCircle2 } from 'lucide-react';

interface InteractiveCheckboxProps {
  label: string;
  checked: boolean;
  onChange?: (checked: boolean) => void;
  activeColor?: string;
  className?: string;
}

export const InteractiveCheckbox: React.FC<InteractiveCheckboxProps> = ({
  label,
  checked,
  onChange,
  activeColor = '#c07a3a',
  className = '',
}) => {
  const handleClick = () => {
    onChange?.(!checked);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      onChange?.(!checked);
    }
  };

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={`interactive-checkbox-chip ${checked ? 'checked' : ''} ${className}`}
      style={
        checked
          ? ({
              '--checkbox-active-color': activeColor,
            } as React.CSSProperties)
          : undefined
      }
    >
      <span className="checkbox-chip-label">{label}</span>
      <span className={`checkbox-chip-indicator ${checked ? 'is-checked' : ''}`}>
        {checked ? (
          <CheckCircle2 size={15} className="checkbox-chip-check-icon" />
        ) : (
          <span className="checkbox-chip-circle-outline" />
        )}
      </span>
    </button>
  );
};
