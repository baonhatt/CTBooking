import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
  } from "@/components/ui/alert-dialog";
  
  interface ErrorModalProps {
    open: boolean;
    title: string;
    message: string;
    onOpenChange: (open: boolean) => void;
  }
  
  export function ErrorModal({ open, title, message, onOpenChange }: ErrorModalProps) {
    return (
      <AlertDialog open={open} onOpenChange={onOpenChange}>
        <AlertDialogContent className="bg-gradient-to-br from-[#0b1226] via-[#0e1b3d] to-[#050915] border border-red-500/30 text-white shadow-[0_0_50px_rgba(239,68,68,0.3)]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-400">{title}</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-300">
              {message}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction className="bg-gradient-to-r from-cyan-400 via-blue-600 to-fuchsia-500 hover:from-fuchsia-500 hover:via-cyan-400 hover:to-blue-600 text-white font-semibold">
              Đóng
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }