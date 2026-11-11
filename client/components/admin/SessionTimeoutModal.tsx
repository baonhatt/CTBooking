import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useStaffStore } from '@/store/staffStore';
import { request } from '@/lib/api/http';
import { handleAutoLogout, performLogout } from '@/lib/auth-utils';
import { notify } from '@/components/admin/common/notify';
import { ADMIN_BTN_OUTLINE, ADMIN_BTN_PRIMARY } from '@/components/admin/common/adminTokens';
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
        notify.success('Đã gia hạn phiên làm việc', 'Phiên làm việc của bạn đã được cộng thêm 24 giờ.');
      } else {
        notify.error(res.message || 'Vui lòng thử lại hoặc đăng nhập lại.');
      }
    } catch (err: any) {
      notify.error(err, 'Không thể kết nối đến máy chủ.');
    } finally {
      setIsExtending(false);
    }
  };

  const handleManualLogout = () => {
    setIsOpen(false);
    void performLogout();
  };

  if (!isOpen || remainingSeconds === null) return null;

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  const isUrgent = remainingSeconds <= 60;

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent
        className="sm:max-w-md bg-white border border-slate-200 shadow-2xl p-6 rounded-2xl font-sans [&>button]:hidden"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader className="flex flex-col items-center text-center space-y-3">
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-xl transition-colors duration-300 ${
              isUrgent ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'
            }`}
          >
            {isUrgent ? <AlertTriangle className="h-6 w-6 animate-pulse" /> : <Clock className="h-6 w-6" />}
          </div>

          <DialogTitle className="text-lg font-bold text-slate-900">Phiên làm việc sắp hết hạn</DialogTitle>

          <DialogDescription className="text-slate-600 text-sm max-w-xs mx-auto text-center">
            Chào <span className="font-semibold text-slate-800">{staff?.fullname || 'bạn'}</span>, phiên đăng nhập của bạn sắp hết hạn để bảo mật hệ thống.
          </DialogDescription>
        </DialogHeader>

        {/* Live Countdown Display */}
        <div className="my-3 flex flex-col items-center justify-center p-4 rounded-xl bg-slate-50 border border-slate-200">
          <span className="text-xs uppercase tracking-wide font-bold text-slate-500 mb-1">Thời gian còn lại</span>
          <div
            className={`text-4xl font-mono font-bold tracking-wider ${
              isUrgent ? 'text-red-600 animate-pulse' : 'text-amber-600'
            }`}
          >
            {formattedTime}
          </div>
          <p className="text-xs text-slate-500 mt-1">Bấm gia hạn để tiếp tục làm việc mà không bị gián đoạn</p>
        </div>

        {/* Actions */}
        <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 mt-2">
          <Button type="button" variant="outline" onClick={handleManualLogout} className={`${ADMIN_BTN_OUTLINE} w-full sm:w-auto`}>
            <LogOut className="h-4 w-4 mr-2" />
            Đăng xuất
          </Button>

          <Button
            type="button"
            onClick={handleExtendSession}
            disabled={isExtending}
            className={`${ADMIN_BTN_PRIMARY} w-full sm:flex-1 flex items-center justify-center gap-2`}
          >
            <RefreshCw className={`h-4 w-4 ${isExtending ? 'animate-spin' : ''}`} />
            {isExtending ? 'Đang gia hạn...' : 'Gia hạn phiên (+24h)'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
