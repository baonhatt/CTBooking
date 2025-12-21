export interface HeaderProps {
    onBookClick?: () => void;
    disableNav?: boolean;
    tooltipPrefix?: string;
    extraMenuOptions?: Array<{ label: string; action: () => void }>;
    forceDark?: boolean;
  }
  
  export interface NavItem {
    label: string;
    target: string;
  }
  
  export interface ErrorModalState {
    open: boolean;
    title: string;
    message: string;
  }
  
  export interface AuthDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
  }