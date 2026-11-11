'use client';
import { useState } from 'react';
import { Eye, EyeOff, type LucideIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface AuthFieldProps {
  id: string;
  label: string;
  type?: 'text' | 'email' | 'password' | 'tel';
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  name?: string;
  error?: string;
  // Shown under the field while there is no error (for example the password rule)
  hint?: string;
  autoComplete?: string;
  inputMode?: 'text' | 'email' | 'tel' | 'numeric';
  maxLength?: number;
  placeholder?: string;
  disabled?: boolean;
  // A small icon at the left of the input
  icon?: LucideIcon;
}

/**
 * One labelled field of the login, register and password dialogs: a 44px input, a label tied to it (a tap on the
 * label focuses the field), the right autofill hints, an error or hint line, and for passwords a 44px show/hide button.
 */
export function AuthField({
  id,
  label,
  type = 'text',
  value,
  onChange,
  onBlur,
  name,
  error,
  hint,
  autoComplete,
  inputMode,
  maxLength,
  placeholder,
  disabled,
  icon: Icon
}: AuthFieldProps) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';
  const messageId = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-gray-200">
        {label}
      </label>
      <div className="relative">
        {Icon && <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />}
        <Input
          id={id}
          name={name || id}
          type={isPassword && showPassword ? 'text' : type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          autoComplete={autoComplete}
          inputMode={inputMode}
          maxLength={maxLength}
          placeholder={placeholder}
          disabled={disabled}
          autoCapitalize={type === 'email' || isPassword ? 'none' : undefined}
          spellCheck={type === 'email' || isPassword ? false : undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={messageId}
          className={cn(
            'h-11 bg-white/[0.07] border-white/20 text-white placeholder:text-gray-400 focus-visible:ring-cyan-400 focus-visible:ring-offset-1 rounded-lg',
            Icon && 'pl-10',
            isPassword && 'pr-12',
            error && 'border-yellow-500 focus-visible:ring-yellow-500'
          )}
        />
        {isPassword && (
          <button
            type="button"
            className="absolute right-0 top-0 h-11 w-11 flex items-center justify-center text-gray-400 hover:text-white"
            onClick={() => setShowPassword((current) => !current)}
            aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiển thị mật khẩu'}
            aria-pressed={showPassword}
          >
            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        )}
      </div>
      {error ? (
        <div id={`${id}-error`} role="alert" className="mt-1 rounded-md bg-yellow-500/10 px-3 py-2 text-xs text-yellow-300">
          {error}
        </div>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1 text-xs text-gray-400">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export default AuthField;
