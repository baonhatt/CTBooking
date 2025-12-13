import { ComponentProps } from "react";
import Header from "@/components/user/Header";
import Footer from "@/components/user/Footer";
import { cn } from "@/lib/utils";

type HeaderProps = ComponentProps<typeof Header>;

interface UserLayoutProps {
  children: React.ReactNode;
  headerProps?: Partial<HeaderProps>;
  hideFooter?: boolean;
  className?: string;
  contentClassName?: string;
}

export default function UserLayout({
  children,
  headerProps,
  hideFooter = false,
  className,
  contentClassName,
}: UserLayoutProps) {
  return (
    <div className={cn("min-h-screen bg-gradient-dark", className)}>
      <Header {...headerProps} />
      <div className={contentClassName}>{children}</div>
      {!hideFooter && <Footer />}
    </div>
  );
}

