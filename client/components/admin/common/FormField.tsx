import React from 'react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface FormFieldProps {
  label: string;
  htmlFor?: string;
  required?: boolean;
  // Error text under the field (red); helper is grey and hidden while an error shows
  error?: string;
  helper?: string;
  className?: string;
  children: React.ReactNode;
}

// Label + red required star + control + error/helper text, identical in every modal
export function FormField({ label, htmlFor, required = false, error, helper, className, children }: FormFieldProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={htmlFor} className="text-sm font-medium text-slate-700">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </Label>
      {children}
      {error ? (
        <p className="text-xs font-medium text-red-600">{error}</p>
      ) : (
        helper && <p className="text-xs text-slate-500">{helper}</p>
      )}
    </div>
  );
}

// Section box used inside modals to group fields (title + optional icon)
export function FormSection({
  title,
  icon,
  children,
  className,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('rounded-xl border border-slate-200 bg-white p-4 shadow-sm', className)}>
      <h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
        {icon}
        {title}
      </h3>
      {children}
    </section>
  );
}
