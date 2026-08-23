import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const alertVariants = cva(
<<<<<<< HEAD
  'relative w-full rounded-lg border p-4 [&>svg~*]:pl-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground',
  {
    variants: {
      variant: {
        default: 'bg-background text-foreground',
        destructive: 'border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive'
      }
    },
    defaultVariants: {
      variant: 'default'
    }
  }
=======
        'relative w-full rounded-lg border-l-4 p-3 px-4 text-sm font-medium [&>svg]:absolute [&>svg]:left-3 [&>svg]:top-3 [&>svg]:h-5 [&>svg]:w-5',
        {
                variants: {
                        variant: {
                                default: 'bg-gray-50 border-gray-200 text-gray-700 [&>svg]:text-gray-500',
                                error: 'bg-red-50 border-red-500 text-red-600 [&>svg]:text-red-500',
                                success: 'bg-green-50 border-green-500 text-green-700 [&>svg]:text-green-500',
                                info: 'bg-blue-50 border-blue-500 text-blue-700 [&>svg]:text-blue-500',
                                warning: 'bg-yellow-50 border-yellow-500 text-yellow-800 [&>svg]:text-yellow-500'
                        }
                },
                defaultVariants: {
                        variant: 'default'
                }
        }
>>>>>>> preview
);

const Alert = React.forwardRef<
        HTMLDivElement,
        React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>
>(({ className, variant, ...props }, ref) => (
<<<<<<< HEAD
  <div ref={ref} role="alert" className={cn(alertVariants({ variant }), className)} {...props} />
=======
        <div ref={ref} role="alert" className={cn(alertVariants({ variant }), className)} {...props} />
>>>>>>> preview
));
Alert.displayName = 'Alert';

const AlertTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
<<<<<<< HEAD
  ({ className, ...props }, ref) => (
    <h5 ref={ref} className={cn('mb-1 font-medium leading-none tracking-tight', className)} {...props} />
  )
=======
        ({ className, ...props }, ref) => (
                <h5 ref={ref} className={cn('mb-1 font-medium leading-none tracking-tight', className)} {...props} />
        )
>>>>>>> preview
);
AlertTitle.displayName = 'AlertTitle';

const AlertDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
<<<<<<< HEAD
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('text-sm [&_p]:leading-relaxed', className)} {...props} />
  )
=======
        ({ className, ...props }, ref) => (
                <div ref={ref} className={cn('text-sm [&_p]:leading-relaxed', className)} {...props} />
        )
>>>>>>> preview
);
AlertDescription.displayName = 'AlertDescription';

export { Alert, AlertTitle, AlertDescription };
