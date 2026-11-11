import React from 'react';

interface PageHeaderProps {
  title: string;
  description?: React.ReactNode;
  // Optional back button / breadcrumb on the left of the title
  leading?: React.ReactNode;
  // Right side: usually the primary action
  actions?: React.ReactNode;
}

// Same title size, weight and spacing on every admin page
export function PageHeader({ title, description, leading, actions }: PageHeaderProps) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        {leading}
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-slate-800">{title}</h1>
          {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
