import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, MailWarning, RefreshCw, Send, Ticket } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { PageHeader } from '@/components/admin/common/PageHeader';
import { AdminDialog, AdminDialogFooter } from '@/components/admin/common/AdminDialog';
import { AdminPagination } from '@/components/admin/common/AdminPagination';
import { EmptyState, TableSkeleton } from '@/components/admin/common/EmptyState';
import { StatusBadge } from '@/components/admin/common/StatusBadge';
import { notify } from '@/components/admin/common/notify';
import { ADMIN_BTN_OUTLINE, ADMIN_CARD, ADMIN_TABLE_HEAD, ADMIN_TH } from '@/components/admin/common/adminTokens';
import { useStaffPermission } from '@/hooks/useStaffPermission';
import {
  actOnActionItemApi,
  getActionItemsApi,
  getActionItemsCountApi,
  type EmailIssue,
  type OrderIssue
} from '@/lib/api/admin';
import UnmatchedTransfersContent, { UNMATCHED_TRANSFERS_CHANGED_EVENT } from './UnmatchedTransfersContent';

/*
  "Đơn cần xử lý": everything staff must handle by hand, on one page with one red alert in the sidebar.
  In this file, in order: constants and helpers, the page (tabs), the orders panel, the emails panel, the note dialog.
  Tabs: unmatched transfers (UnmatchedTransfersContent), orders the system did not confirm, emails that failed.
*/

// ============================================================
// CONSTANTS AND HELPERS
// ============================================================

const PAGE_SIZE = 20;

type TabKey = 'transfers' | 'orders' | 'emails';

const EMAIL_TYPE_LABELS: Record<string, string> = {
  booking_confirmation: 'Mail vé',
  otp: 'Mã OTP',
  reset_password: 'Đặt lại mật khẩu',
  welcome: 'Chào mừng',
  staff_credentials: 'Tài khoản nhân viên',
  staff_otp: 'OTP nhân viên'
};

const format_money = (amount: number | null) => (amount === null ? '—' : `${Number(amount).toLocaleString('vi-VN')} ₫`);

function format_time(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value.includes('T') ? value : value.replace(' ', 'T'));
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('vi-VN');
}

const notify_changed = () => window.dispatchEvent(new Event(UNMATCHED_TRANSFERS_CHANGED_EVENT));

// ============================================================
// PAGE
// ============================================================

export default function ActionItemsContent() {
  const [tab, set_tab] = useState<TabKey>('transfers');
  const [counts, set_counts] = useState({ unmatched: 0, orders: 0, emails: 0 });
  const [reload_key, set_reload_key] = useState(0);

  const load_counts = useCallback(async () => {
    try {
      const oData = await getActionItemsCountApi();
      set_counts({ unmatched: oData.unmatched, orders: oData.orders, emails: oData.emails });
    } catch {
      // The tab numbers are a help; the lists still load
    }
  }, []);

  useEffect(() => {
    void load_counts();
    window.addEventListener(UNMATCHED_TRANSFERS_CHANGED_EVENT, load_counts);
    return () => window.removeEventListener(UNMATCHED_TRANSFERS_CHANGED_EVENT, load_counts);
  }, [load_counts]);

  const tabs: Array<{ key: TabKey; label: string; count: number }> = [
    { key: 'transfers', label: 'Chuyển khoản chưa khớp', count: counts.unmatched },
    { key: 'orders', label: 'Đơn chưa xác nhận', count: counts.orders },
    { key: 'emails', label: 'Mail gửi lỗi', count: counts.emails }
  ];

  return (
    <div>
      <PageHeader
        title="Đơn cần xử lý"
        description="Những việc hệ thống không tự làm được: tiền về không khớp đơn, đơn chưa được xác nhận tự động, mail gửi lỗi."
        actions={
          <button
            type="button"
            className={ADMIN_BTN_OUTLINE}
            onClick={() => {
              set_reload_key((key) => key + 1);
              void load_counts();
            }}
          >
            <RefreshCw className="mr-2 inline h-4 w-4" />
            Tải lại
          </button>
        }
      />

      <div className="mb-5 flex flex-wrap gap-2 border-b border-slate-200">
        {tabs.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => set_tab(item.key)}
            className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
              tab === item.key ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {item.label}
            {item.count > 0 && (
              <span className="rounded-full bg-red-500 px-2 py-0.5 text-[11px] font-bold text-white">{item.count}</span>
            )}
          </button>
        ))}
      </div>

      {tab === 'transfers' && <UnmatchedTransfersContent key={`transfers-${reload_key}`} />}
      {tab === 'orders' && <OrdersPanel key={`orders-${reload_key}`} />}
      {tab === 'emails' && <EmailsPanel key={`emails-${reload_key}`} />}
    </div>
  );
}

// ============================================================
// SHARED: open / done filter and the list loader
// ============================================================

function StatusFilter({ value, onChange }: { value: 'open' | 'done'; onChange: (value: 'open' | 'done') => void }) {
  return (
    <div className="mb-4 flex gap-2">
      {(['open', 'done'] as const).map((key) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={`h-10 rounded-xl px-4 text-sm font-semibold transition-colors ${
            value === key ? 'bg-blue-600 text-white' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
          }`}
        >
          {key === 'open' ? 'Chưa xử lý' : 'Đã xử lý'}
        </button>
      ))}
    </div>
  );
}

function useIssueList<T>(kind: 'orders' | 'emails') {
  const [status, set_status] = useState<'open' | 'done'>('open');
  const [page, set_page] = useState(1);
  const [items, set_items] = useState<T[]>([]);
  const [total, set_total] = useState(0);
  const [loading, set_loading] = useState(true);

  const load = useCallback(async () => {
    set_loading(true);
    try {
      const oData = await getActionItemsApi<T>(kind, status, page, PAGE_SIZE);
      set_items(oData.items || []);
      set_total(oData.total || 0);
    } catch (error) {
      notify.error(error, 'Không tải được danh sách');
    } finally {
      set_loading(false);
    }
  }, [kind, status, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const change_status = (value: 'open' | 'done') => {
    set_status(value);
    set_page(1);
  };

  return { status, change_status, page, set_page, items, total, loading, load };
}

function ResolvedCell({ resolved }: { resolved: OrderIssue['resolved'] }) {
  if (!resolved) return null;
  return (
    <div className="space-y-1 text-xs text-slate-600">
      <StatusBadge tone="success">Đã xử lý</StatusBadge>
      {resolved.note && <p className="text-slate-500">{resolved.note}</p>}
      <p className="text-slate-400">
        {resolved.by || 'Hệ thống'} · {format_time(resolved.at)}
      </p>
    </div>
  );
}

// ============================================================
// ORDERS THE SYSTEM DID NOT CONFIRM
// ============================================================

function OrdersPanel() {
  const can_act = useStaffPermission('ticket_check', 'validate');
  const list = useIssueList<OrderIssue>('orders');
  const [note_target, set_note_target] = useState<OrderIssue | null>(null);
  const [busy_id, set_busy_id] = useState<number | null>(null);

  const after_change = () => {
    notify_changed();
    void list.load();
  };

  const confirm_ticket = async (issue: OrderIssue) => {
    set_busy_id(issue.id);
    try {
      const oData = await actOnActionItemApi('orders', issue.id, 'confirm');
      notify.success('Đã xác nhận vé', oData.message);
      if (oData.voucher_slot_unavailable) notify.warning('Mã giảm giá của đơn đã hết lượt', 'Đơn vẫn được xác nhận vì tiền đã nhận.');
      after_change();
    } catch (error) {
      notify.error(error);
    } finally {
      set_busy_id(null);
    }
  };

  return (
    <div>
      <p className="mb-4 text-sm text-slate-500">
        Tiền đã về cho đơn nhưng hệ thống không tự xác nhận: về sau 10 phút thanh toán, đơn đã bị hủy / hết hạn, chuyển thiếu, hoặc
        đơn đã thanh toán mà tiền về thêm. Xác nhận vé nếu hợp lệ, hoặc đánh dấu đã xử lý kèm ghi chú (ví dụ đã hoàn tiền cho khách).
      </p>
      <StatusFilter value={list.status} onChange={list.change_status} />

      <div className={`${ADMIN_CARD} overflow-x-auto`}>
        {list.loading ? (
          <TableSkeleton rows={4} />
        ) : list.items.length === 0 ? (
          <EmptyState
            title={list.status === 'open' ? 'Không có đơn nào cần xử lý' : 'Chưa có dữ liệu'}
            description={list.status === 'open' ? 'Mọi khoản tiền về đều đã được xác nhận tự động.' : undefined}
          />
        ) : (
          <table className="w-full min-w-[860px] text-sm">
            <thead className={ADMIN_TABLE_HEAD}>
              <tr>
                <th className={`${ADMIN_TH} px-4 py-3 text-left`}>Thời gian</th>
                <th className={`${ADMIN_TH} px-4 py-3 text-left`}>Lý do</th>
                <th className={`${ADMIN_TH} px-4 py-3 text-left`}>Đơn / khách</th>
                <th className={`${ADMIN_TH} px-4 py-3 text-right`}>Nhận / cần</th>
                <th className={`${ADMIN_TH} px-4 py-3 text-left`}>{list.status === 'open' ? 'Xử lý' : 'Kết quả'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {list.items.map((issue) => (
                <tr key={issue.id} className="align-top">
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">{format_time(issue.created_at)}</td>
                  <td className="max-w-[260px] px-4 py-3">
                    <StatusBadge tone={issue.reason === 'sepay_duplicate' ? 'info' : 'warning'}>{issue.reason_label}</StatusBadge>
                    <p className="mt-1 text-xs text-slate-500">{issue.details}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-700">
                    <p className="font-mono font-semibold">{issue.pay_txt_code}</p>
                    <p>{issue.customer_name}</p>
                    <p className="text-slate-500">
                      {issue.customer_phone} · {issue.customer_email}
                    </p>
                    {issue.bank_ref && <p className="text-slate-400">Mã GD: {issue.bank_ref}</p>}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-xs">
                    <p className="font-bold text-slate-800">{format_money(issue.amount_received)}</p>
                    <p className="text-slate-500">cần {format_money(issue.amount_needed)}</p>
                  </td>
                  <td className="px-4 py-3">
                    {issue.resolved ? (
                      <ResolvedCell resolved={issue.resolved} />
                    ) : can_act ? (
                      <div className="flex flex-wrap gap-2">
                        {issue.payment_status.toLowerCase() !== 'paid' && (
                          <button
                            type="button"
                            disabled={busy_id === issue.id}
                            onClick={() => void confirm_ticket(issue)}
                            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                          >
                            <Ticket className="h-4 w-4" /> Xác nhận vé
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => set_note_target(issue)}
                          className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 px-3 text-xs font-medium text-slate-600 hover:bg-slate-50"
                        >
                          <CheckCircle2 className="h-4 w-4" /> Đã xử lý
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">Cần quyền xác nhận thanh toán</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <AdminPagination
        className="mt-4"
        page={list.page}
        totalPages={Math.max(1, Math.ceil(list.total / PAGE_SIZE))}
        onPageChange={list.set_page}
        totalLabel={`${list.total} đơn`}
      />

      <NoteDialog
        open={!!note_target}
        title="Đánh dấu đã xử lý"
        subtitle={note_target ? `${note_target.pay_txt_code} · ${note_target.reason_label}` : ''}
        placeholder="VD: Đã hoàn tiền 200.000 ₫ cho khách ngày … / Đã gọi khách, khách chuyển bù"
        onClose={() => set_note_target(null)}
        onSubmit={async (note) => {
          if (!note_target) return;
          await actOnActionItemApi('orders', note_target.id, 'resolve', note);
          notify.success('Đã đánh dấu đã xử lý');
          set_note_target(null);
          after_change();
        }}
      />
    </div>
  );
}

// ============================================================
// EMAILS THAT FAILED
// ============================================================

function EmailsPanel() {
  const can_act = useStaffPermission('ticket_check', 'validate');
  const list = useIssueList<EmailIssue>('emails');
  const [note_target, set_note_target] = useState<EmailIssue | null>(null);
  const [busy_id, set_busy_id] = useState<number | null>(null);

  const after_change = () => {
    notify_changed();
    void list.load();
  };

  const resend = async (issue: EmailIssue) => {
    set_busy_id(issue.id);
    try {
      await actOnActionItemApi('emails', issue.id, 'resend');
      notify.success('Đã gửi lại mail vé', issue.recipient);
      after_change();
    } catch (error) {
      notify.error(error);
    } finally {
      set_busy_id(null);
    }
  };

  return (
    <div>
      <p className="mb-4 text-sm text-slate-500">
        Mail hệ thống gửi không thành công. Mail vé gửi lại được; mail OTP hay đặt lại mật khẩu thì khách chỉ cần yêu cầu lại, bạn
        đánh dấu đã xử lý.
      </p>
      <StatusFilter value={list.status} onChange={list.change_status} />

      <div className={`${ADMIN_CARD} overflow-x-auto`}>
        {list.loading ? (
          <TableSkeleton rows={4} />
        ) : list.items.length === 0 ? (
          <EmptyState
            icon={<MailWarning className="h-6 w-6" />}
            title={list.status === 'open' ? 'Không có mail gửi lỗi' : 'Chưa có dữ liệu'}
            description={list.status === 'open' ? 'Mọi mail gần đây đều đã gửi thành công.' : undefined}
          />
        ) : (
          <table className="w-full min-w-[760px] text-sm">
            <thead className={ADMIN_TABLE_HEAD}>
              <tr>
                <th className={`${ADMIN_TH} px-4 py-3 text-left`}>Thời gian</th>
                <th className={`${ADMIN_TH} px-4 py-3 text-left`}>Loại mail</th>
                <th className={`${ADMIN_TH} px-4 py-3 text-left`}>Người nhận</th>
                <th className={`${ADMIN_TH} px-4 py-3 text-left`}>Lỗi</th>
                <th className={`${ADMIN_TH} px-4 py-3 text-left`}>{list.status === 'open' ? 'Xử lý' : 'Kết quả'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {list.items.map((issue) => (
                <tr key={issue.id} className="align-top">
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">{format_time(issue.created_at)}</td>
                  <td className="px-4 py-3">
                    <StatusBadge tone="neutral">{EMAIL_TYPE_LABELS[issue.email_type] || issue.email_type}</StatusBadge>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-700">{issue.recipient}</td>
                  <td className="max-w-[280px] break-words px-4 py-3 text-xs text-red-600">{issue.error_message || '—'}</td>
                  <td className="px-4 py-3">
                    {issue.resolved ? (
                      <ResolvedCell resolved={issue.resolved} />
                    ) : can_act ? (
                      <div className="flex flex-wrap gap-2">
                        {issue.can_resend && (
                          <button
                            type="button"
                            disabled={busy_id === issue.id}
                            onClick={() => void resend(issue)}
                            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                          >
                            <Send className="h-4 w-4" /> Gửi lại mail vé
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => set_note_target(issue)}
                          className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 px-3 text-xs font-medium text-slate-600 hover:bg-slate-50"
                        >
                          <CheckCircle2 className="h-4 w-4" /> Đã xử lý
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">Cần quyền xác nhận thanh toán</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <AdminPagination
        className="mt-4"
        page={list.page}
        totalPages={Math.max(1, Math.ceil(list.total / PAGE_SIZE))}
        onPageChange={list.set_page}
        totalLabel={`${list.total} mail`}
      />

      <NoteDialog
        open={!!note_target}
        title="Đánh dấu đã xử lý"
        subtitle={note_target ? `${EMAIL_TYPE_LABELS[note_target.email_type] || note_target.email_type} · ${note_target.recipient}` : ''}
        placeholder="VD: Khách đã nhận mã qua điện thoại / Email khách sai, đã gọi xác nhận"
        onClose={() => set_note_target(null)}
        onSubmit={async (note) => {
          if (!note_target) return;
          await actOnActionItemApi('emails', note_target.id, 'resolve', note);
          notify.success('Đã đánh dấu đã xử lý');
          set_note_target(null);
          after_change();
        }}
      />
    </div>
  );
}

// ============================================================
// NOTE DIALOG
// ============================================================

function NoteDialog(props: {
  open: boolean;
  title: string;
  subtitle: string;
  placeholder: string;
  onClose: () => void;
  onSubmit: (note: string) => Promise<void>;
}) {
  const { open, title, subtitle, placeholder, onClose, onSubmit } = props;
  const [note, set_note] = useState('');
  const [busy, set_busy] = useState(false);

  useEffect(() => {
    if (open) set_note('');
  }, [open]);

  const submit = async () => {
    set_busy(true);
    try {
      await onSubmit(note.trim());
    } catch (error) {
      notify.error(error);
    } finally {
      set_busy(false);
    }
  };

  return (
    <AdminDialog
      open={open}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      size="sm"
      mode="form"
      dirty={note.trim() !== ''}
      busy={busy}
      footer={
        <AdminDialogFooter onCancel={onClose} onSubmit={submit} submitText="Lưu" busy={busy} submitDisabled={note.trim().length < 3} />
      }
    >
      <div className="space-y-2 text-sm">
        <label htmlFor="fmi_action_item_note" className="block font-semibold text-slate-700">
          Ghi chú cách đã xử lý
        </label>
        <Textarea
          id="fmi_action_item_note"
          value={note}
          onChange={(event) => set_note(event.target.value)}
          placeholder={placeholder}
          rows={3}
          maxLength={300}
        />
      </div>
    </AdminDialog>
  );
}
