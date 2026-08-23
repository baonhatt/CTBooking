import * as React from 'react';

import { cn } from '@/lib/utils';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> { }

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => {
        return (
                <textarea
                        className={cn(
                                'flex min-h-[100px] w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 resize-y',
                                className
                        )}
                        ref={ref}
                        {...props}
                />
        );
});
Textarea.displayName = 'Textarea';

export { Textarea };
