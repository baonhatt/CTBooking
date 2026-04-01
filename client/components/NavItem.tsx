import { cn } from '@/lib/utils';

interface NavItemProps {
  label: string;
  target: string;
  isActive: boolean;
  disabled: boolean;
  onClick: () => void;
}

export function NavItem({ label, target, isActive, disabled, onClick }: NavItemProps) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      className={cn(
        'relative group inline-flex h-10 items-center text-white font-bold uppercase text-[13px] tracking-[0.15em] transition-all duration-300',
        disabled ? 'opacity-50 cursor-not-allowed' : 'hover:text-cyan-300'
      )}
    >
      <span
        className={cn(
          'pb-0.5 inline-block leading-tight font-medium transition-colors duration-300',
          isActive
            ? 'text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-blue-400 to-purple-400 font-semibold'
            : 'text-white/90'
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          'absolute left-0 right-0 -bottom-0.5 h-[2px] bg-gradient-to-r from-cyan-400 via-blue-500 to-fuchsia-500 origin-left transition-transform duration-300 rounded-full',
          isActive ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'
        )}
      />
    </button>
  );
}
