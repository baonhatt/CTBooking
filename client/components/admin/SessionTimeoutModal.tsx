import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useStaffStore } from '@/store/staffStore';
import { request } from '@/lib/api/http';
import { handleAutoLogout } from '@/lib/auth-utils';
import { toast } from 'sonner';
import { Clock, RefreshCw, LogOut, AlertTriangle } from 'lucide-react';

const WARNING_THRESHOLD_SECONDS = 300; // 5 minutes

export const SessionTimeoutModal: React.FC = () => {
  const isAuthenticated = useStaffStore((state) => state.isAuthenticated);
  const sessionExpiresAt = useStaffStore((state) => state.sessionExpiresAt);
  const setSessionExpiresAt = useStaffStore((state) => state.setSessionExpiresAt);
  const staff = useStaffStore((state) => state.staff);

  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isExtending, setIsExtending] = useState(false);
  const autoLogoutTriggered = useRef(false);

  // Compute and update remaining seconds
  const updateTimer = useCallback(() => {
    if (!isAuthenticated || !sessionExpiresAt) {
      setRemainingSeconds(null);
      setIsOpen(false);
      return;
    }

    const expiryTime = new Date(sessionExpiresAt).getTime();
    const now = Date.now();
    const diff = Math.floor((expiryTime - now) / 1000);

    if (diff <= 0) {
      setRemainingSeconds(0);
      if (!autoLogoutTriggered.current) {
        autoLogoutTriggered.current = true;
        setIsOpen(false);
        handleAutoLogout();
      }
      return;
    }

    setRemainingSeconds(diff);

    // Show warning dialog when 5 minutes or less remain
    if (diff <= WARNING_THRESHOLD_SECONDS && diff > 0) {
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  }, [isAuthenticated, sessionExpiresAt]);

  useEffect(() => {
    if (!isAuthenticated) return;

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [isAuthenticated, sessionExpiresAt, updateTimer]);

  // Handle Extend Session
  const handleExtendSession = async () => {
    try {
      setIsExtending(true);
      const res = await request<{ status: string; expiresAt: string; message?: string }>(
        '/api/admin/auth/extend-session',
        { method: 'POST' }
      );

      if (res && res.status === 'success' && res.expiresAt) {
        setSessionExpiresAt(res.expiresAt);
        setIsOpen(false);
        autoLogoutTriggered.current = false;
        toast.success('Đã gia hạn phiên làm việc', {
          description: 'Phiên làm việc của bạn đã được cộng thêm 24 giờ.'
        });
      } else {
        toast.error('Không thể gia hạn phiên làm việc', {
          description: res.message || 'Vui lòng thử lại hoặc đăng nhập lại.'
        });
      }
    } catch (err: any) {
      toast.error('Lỗi gia hạn phiên', {
        description: err?.message || 'Không thể kết nối đến máy chủ.'
      });
    } finally {
      setIsExtending(false);
    }
  };

  const handleManualLogout = () => {
    setIsOpen(false);
    handleAutoLogout();
  };

  if (!isOpen || remainingSeconds === null) return null;

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  const isUrgent = remainingSeconds <= 60;

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent
        className="sm:max-w-md bg-slate-950 border border-slate-800 text-white shadow-2xl p-6 rounded-2xl overflow-hidden [&>button]:hidden"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        {/* Glow decoration */}
        <div
          className={`absolute -top-24 -left-24 w-48 h-48 ${
            isUrgent ? 'bg-rose-500/20' : 'bg-amber-500/20'
          } rounded-full blur-3xl pointer-events-none transition-colors duration-500`}
        />

        <DialogHeader className="flex flex-col items-center text-center space-y-3">
          <div
            className={`p-3.5 rounded-2xl ${
              isUrgent ? 'bg-rose-500/15 text-rose-400 ring-1 ring-rose-500/30' : 'bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/30'
            } transition-colors duration-300`}
          >
            {isUrgent ? <AlertTriangle className="h-8 w-8 animate-pulse" /> : <Clock className="h-8 w-8" />}
          </div>

          <DialogTitle className="text-xl font-bold tracking-tight text-white">
            Phiên làm việc sắp hết hạn
          </DialogTitle>

          <DialogDescription className="text-slate-400 text-sm max-w-xs mx-auto text-center">
            Chào <span className="font-semibold text-slate-200">{staff?.fullname || 'bạn'}</span>, phiên đăng nhập của bạn sắp hết hạn để bảo mật hệ thống.
          </DialogDescription>
        </DialogHeader>

        {/* Live Countdown Display */}
        <div className="my-3 flex flex-col items-center justify-center p-4 rounded-xl bg-slate-900/80 border border-slate-800/80">
          <span className="text-xs uppercase tracking-widest font-semibold text-slate-500 mb-1">
            Thời gian còn lại
          </span>
          <div
            className={`text-4xl font-mono font-black tracking-wider ${
              isUrgent ? 'text-rose-400 animate-pulse' : 'text-amber-400'
            }`}
          >
            {formattedTime}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Bấm gia hạn để tiếp tục làm việc mà không bị gián đoạn
          </p>
        </div>

        {/* Actions */}
        <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 mt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={handleManualLogout}
            className="w-full sm:w-auto text-slate-400 hover:text-rose-400 hover:bg-rose-950/20 border border-slate-800 rounded-xl py-2.5 h-11 transition-colors"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Đăng xuất
          </Button>

          <Button
            type="button"
            onClick={handleExtendSession}
            disabled={isExtending}
            className="w-full sm:flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-2.5 h-11 rounded-xl shadow-lg shadow-blue-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <RefreshCw className={`h-4 w-4 ${isExtending ? 'animate-spin' : ''}`} />
            {isExtending ? 'Đang gia hạn...' : 'Gia hạn phiên (+24h)'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
