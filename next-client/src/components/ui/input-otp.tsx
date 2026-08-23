import * as React from 'react';
import { OTPInput, OTPInputContext } from 'input-otp';
import { Dot } from 'lucide-react';

import { cn } from '@/lib/utils';

const InputOTP = React.forwardRef<React.ElementRef<typeof OTPInput>, React.ComponentPropsWithoutRef<typeof OTPInput>>(
<<<<<<< HEAD
        ({ className, containerClassName, ...props }, ref) => (
                <OTPInput
                        ref={ref}
                        containerClassName={cn('flex items-center gap-2 has-[:disabled]:opacity-50', containerClassName)}
                        className={cn('disabled:cursor-not-allowed', className)}
                        {...props}
                />
        )
=======
  ({ className, containerClassName, ...props }, ref) => (
    <OTPInput
      ref={ref}
      containerClassName={cn('flex items-center gap-2 has-[:disabled]:opacity-50', containerClassName)}
      className={cn('disabled:cursor-not-allowed', className)}
      {...props}
    />
  )
>>>>>>> preview
);
InputOTP.displayName = 'InputOTP';

const InputOTPGroup = React.forwardRef<React.ElementRef<'div'>, React.ComponentPropsWithoutRef<'div'>>(
<<<<<<< HEAD
        ({ className, ...props }, ref) => <div ref={ref} className={cn('flex items-center', className)} {...props} />
=======
  ({ className, ...props }, ref) => <div ref={ref} className={cn('flex items-center', className)} {...props} />
>>>>>>> preview
);
InputOTPGroup.displayName = 'InputOTPGroup';

const InputOTPSlot = React.forwardRef<
<<<<<<< HEAD
        React.ElementRef<'div'>,
        React.ComponentPropsWithoutRef<'div'> & { index: number }
>(({ index, className, ...props }, ref) => {
        // @ts-ignore - React Context type incompatibility with input-otp library
        const inputOTPContext = React.useContext(OTPInputContext);
        // @ts-ignore - Property 'slots' does not exist on type
        const slotData = inputOTPContext && inputOTPContext.slots ? inputOTPContext.slots[index] : null;
        const { char = '', hasFakeCaret = false, isActive = false } = slotData || {};

        return (
                <div
                        ref={ref}
                        className={cn(
                                'relative flex h-10 w-10 items-center justify-center border-y border-r border-input text-sm transition-all first:rounded-l-md first:border-l last:rounded-r-md',
                                isActive && 'z-10 ring-2 ring-ring ring-offset-background',
                                className
                        )}
                        {...props}
                >
                        {char}
                        {hasFakeCaret && (
                                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                                        <div className="h-4 w-px animate-caret-blink bg-foreground duration-1000" />
                                </div>
                        )}
                </div>
        );
=======
  React.ElementRef<'div'>,
  React.ComponentPropsWithoutRef<'div'> & { index: number }
>(({ index, className, ...props }, ref) => {
  // @ts-ignore - React Context type incompatibility with input-otp library
  const inputOTPContext = React.useContext(OTPInputContext);
  // @ts-ignore - Property 'slots' does not exist on type
  const slotData = inputOTPContext && inputOTPContext.slots ? inputOTPContext.slots[index] : null;
  const { char = '', hasFakeCaret = false, isActive = false } = slotData || {};

  return (
    <div
      ref={ref}
      className={cn(
        'relative flex h-10 w-10 items-center justify-center border-y border-r border-input text-sm transition-all first:rounded-l-md first:border-l last:rounded-r-md',
        isActive && 'z-10 ring-2 ring-ring ring-offset-background',
        className
      )}
      {...props}
    >
      {char}
      {hasFakeCaret && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-4 w-px animate-caret-blink bg-foreground duration-1000" />
        </div>
      )}
    </div>
  );
>>>>>>> preview
});
InputOTPSlot.displayName = 'InputOTPSlot';

const InputOTPSeparator = React.forwardRef<React.ElementRef<'div'>, React.ComponentPropsWithoutRef<'div'>>(
<<<<<<< HEAD
        ({ ...props }, ref) => (
                <div ref={ref} role="separator" {...props}>
                        <Dot />
                </div>
        )
=======
  ({ ...props }, ref) => (
    <div ref={ref} role="separator" {...props}>
      <Dot />
    </div>
  )
>>>>>>> preview
);
InputOTPSeparator.displayName = 'InputOTPSeparator';

export { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator };
