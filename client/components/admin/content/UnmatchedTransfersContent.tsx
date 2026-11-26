import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Link2, Search, XCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { AdminDialog, AdminDialogFooter } from '@/components/admin/common/AdminDialog';
import { AdminPagination } from '@/components/admin/common/AdminPagination';
import { EmptyState, TableSkeleton } from '@/components/admin/common/EmptyState';
import { StatusBadge } from '@/components/admin/common/StatusBadge';
import { notify } from '@/components/admin/common/notify';
import {
  ADMIN_CARD,
  ADMIN_INPUT,
  ADMIN_TABLE_HEAD,
  ADMIN_TH
} from '@/components/admin/common/adminTokens';
import { useStaffPermission } from '@/hooks/useStaffPermission';
import {
  assignUnmatchedTransferApi,
  getUnmatchedTransfersApi,
  ignoreUnmatchedTransferApi,
  type UnmatchedTransfer
} from '@/lib/api/admin';

/*
  "Chuyển khoản chưa khớp": money SePay reported that matched no order (customer wrote a wrong transfer text,
  or the money is not ticket money). Staff assign it to an order (the order becomes paid) or set it aside.
  In this file, in order: constants, helpers, the page, the assign dialog, the set-aside dialog.
*/

// ============================================================
// CONSTANTS
// ============================================================

const PAGE_SIZE = 20;

// Fired after an assign / set-aside so the red alert in the sidebar refreshes its count at once
export const UNMATCHED_TRANSFERS_CHANGED_EVENT = 'unmatched-transfers-changed';

const STATUS_TABS: Array<{ key: UnmatchedTransfer['status']; label: string }> = [
  { key: 'open', label: 'Chưa xử lý' },
  { key: 'matched', label: 'Đã gán vào đơn' },
  { key: 'ignored', label: 'Đã bỏ qua' }
];

// ============================================================
// HELPERS
// ============================================================

const format_money = (amount: number) => `${Number(amount || 0).toLocaleString('vi-VN')} ₫`;

function format_time(value: string | null) {
  if (!value) return '—';
  const date = new Date(value.includes('T') ? value : value.replace(' ', 'T'));
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('vi-VN');
}

// ============================================================
// PAGE
// ============================================================

// One tab of the "Đơn cần xử lý" page (ActionItemsContent), which has the page title and the reload button
export default function UnmatchedTransfersContent() {
  const can_resolve = useStaffPermission('ticket_check', 'validate');
  const [status, set_status] = useState<UnmatchedTransfer['status']>('open');
  const [search_text, set_search_text] = useState('');
  const [query, set_query] = useState('');
  const [page, set_page] = useState(1);
  const [items, set_items] = useState<UnmatchedTransfer[]>([]);
  const [total, set_total] = useState(0);
  const [loading, set_loading] = useState(true);
  const [assign_target, set_assign_target] = useState<UnmatchedTransfer | null>(null);
  const [ignore_target, set_ignore_target] = useState<UnmatchedTransfer | null>(null);

  const load = useCallback(async () => {
    set_loading(true);
    try {
      const oData = await getUnmatchedTransfersApi({ status, q: query, page, pageSize: PAGE_SIZE });
      set_items(oData.items || []);
      set_total(oData.total || 0);
    } catch (error) {
      notify.error(error, 'Không tải được danh sách chuyển khoản');
    } finally {
      set_loading(false);
    }
  }, [status, query, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const after_change = () => {
    window.dispatchEvent(new Event(UNMATCHED_TRANSFERS_CHANGED_EVENT));
    void load();
  };

  const total_pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <p className="mb-4 text-sm text-slate-500">
        Tiền đã vào tài khoản nhưng không khớp đơn nào (khách ghi sai nội dung, hoặc không phải tiền vé). Gán vào đúng đơn để
        xác nhận vé, hoặc bỏ qua kèm lý do.
      </p>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => {
              set_status(tab.key);
              set_page(1);
            }}
            className={`h-10 rounded-xl px-4 text-sm font-semibold transition-colors ${
              status === tab.key ? 'bg-blue-600 text-white' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
        <form
          className="relative ml-auto w-full sm:w-80"
          onSubmit={(event) => {
            event.preventDefault();
            set_query(search_text.trim());
            set_page(1);
          }}
        >
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            id="fmi_unmatched_search"
            value={search_text}
            onChange={(event) => set_search_text(event.target.value)}
            placeholder="Tìm nội dung CK, SĐT, mã GD hoặc số tiền"
            className={`${ADMIN_INPUT} pl-9`}
          />
        </form>
      </div>

      <div className={`${ADMIN_CARD} overflow-x-auto`}>
        {loading ? (
          <TableSkeleton rows={5} />
        ) : items.length === 0 ? (
          <EmptyState
            title={status === 'open' ? 'Không có chuyển khoản nào cần xử lý' : 'Chưa có dữ liệu'}
            description={status === 'open' ? 'Mọi khoản tiền vào đều đã khớp với đơn hàng.' : undefined}
          />
        ) : (
          <table className="w-full min-w-[760px] text-sm">
            <thead className={ADMIN_TABLE_HEAD}>
              <tr>
                <th className={`${ADMIN_TH} px-4 py-3 text-left`}>Thời gian</th>
                <th className={`${ADMIN_TH} px-4 py-3 text-right`}>Số tiền</th>
                <th className={`${ADMIN_TH} px-4 py-3 text-left`}>Nội dung chuyển khoản</th>
                <th className={`${ADMIN_TH} px-4 py-3 text-left`}>Mã giao dịch</th>
                <th className={`${ADMIN_TH} px-4 py-3 text-left`}>{status === 'open' ? 'Xử lý' : 'Kết quả'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item) => (
                <tr key={item.id} className="align-top">
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">{format_time(item.transfer_at || item.created_at)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-bold text-slate-800">{format_money(item.amount)}</td>
                  <td className="max-w-[320px] break-words px-4 py-3 font-mono text-xs text-slate-700">{item.content || '—'}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{item.bank_ref || item.sepay_id || '—'}</td>
                  <td className="px-4 py-3">
                    {item.status === 'open' ? (
                      can_resolve ? (
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-700"
                            onClick={() => set_assign_target(item)}
                          >
                            <Link2 className="h-4 w-4" /> Gán vào đơn
                          </button>
                          <button
                            type="button"
                            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 px-3 text-xs font-medium text-slate-600 hover:bg-slate-50"
                            onClick={() => set_ignore_target(item)}
                          >
                            <XCircle className="h-4 w-4" /> Bỏ qua
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">Cần quyền xác nhận thanh toán</span>
                      )
                    ) : (
                      <div className="space-y-1 text-xs text-slate-600">
                        {item.status === 'matched' ? (
                          <StatusBadge tone="success">Đã gán đơn #{item.booking_id}</StatusBadge>
                        ) : (
                          <>
                            <StatusBadge tone="neutral">Đã bỏ qua</StatusBadge>
                            <p className="text-slate-500">{item.note}</p>
                          </>
                        )}
                        <p className="text-slate-400">
                          {item.resolved_by_name || '—'} · {format_time(item.resolved_at)}
                        </p>
                      </div>
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
        page={page}
        totalPages={total_pages}
        onPageChange={set_page}
        totalLabel={`${total} giao dịch`}
      />

      <AssignDialog transfer={assign_target} onClose={() => set_assign_target(null)} onDone={after_change} />
      <IgnoreDialog transfer={ignore_target} onClose={() => set_ignore_target(null)} onDone={after_change} />
    </div>
  );
}

// ============================================================
// ASSIGN DIALOG
// ============================================================

function AssignDialog(props: { transfer: UnmatchedTransfer | null; onClose: () => void; onDone: () => void }) {
  const { transfer, onClose, onDone } = props;
  const [pay_code, set_pay_code] = useState('');
  const [busy, set_busy] = useState(false);

  useEffect(() => {
    set_pay_code('');
  }, [transfer?.id]);

  const submit = async () => {
    if (!transfer) return;
    set_busy(true);
    try {
      const oData = await assignUnmatchedTransferApi(transfer.id, pay_code.trim());
      notify.success('Đã gán và xác nhận thanh toán', oData.message);
      if (oData.voucher_slot_unavailable) {
        notify.warning('Mã giảm giá của đơn đã hết lượt', 'Đơn vẫn được xác nhận vì tiền đã nhận.');
      }
      onClose();
      onDone();
    } catch (error) {
      notify.error(error);
    } finally {
      set_busy(false);
    }
  };

  return (
    <AdminDialog
      open={!!transfer}
      onClose={onClose}
      title="Gán chuyển khoản vào đơn"
      subtitle={transfer ? `${format_money(transfer.amount)} · ${transfer.content || 'không có nội dung'}` : ''}
      size="sm"
      mode="form"
      dirty={pay_code.trim() !== ''}
      busy={busy}
      footer={
        <AdminDialogFooter
          onCancel={onClose}
          onSubmit={submit}
          submitText="Gán & xác nhận"
          busy={busy}
          submitDisabled={pay_code.trim() === ''}
        />
      }
    >
      <div className="space-y-3 text-sm">
        <label htmlFor="fmi_assign_pay_code" className="block font-semibold text-slate-700">
          Mã đơn (nội dung chuyển khoản của đơn, dạng CS…)
        </label>
        <Input
          id="fmi_assign_pay_code"
          value={pay_code}
          onChange={(event) => set_pay_code(event.target.value.toUpperCase())}
          placeholder="VD: CS176382012345"
          className={`${ADMIN_INPUT} font-mono`}
          autoFocus
        />
        <p className="flex gap-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Đơn sẽ được chuyển sang <b>đã thanh toán</b> và gửi mail vé cho khách. Số tiền chuyển phải bằng hoặc lớn hơn giá đơn.
          Tìm mã đơn ở trang Hóa đơn &amp; đơn hàng theo SĐT hoặc email khách.
        </p>
      </div>
    </AdminDialog>
  );
}

// ============================================================
// SET-ASIDE DIALOG
// ============================================================

function IgnoreDialog(props: { transfer: UnmatchedTransfer | null; onClose: () => void; onDone: () => void }) {
  const { transfer, onClose, onDone } = props;
  const [note, set_note] = useState('');
  const [busy, set_busy] = useState(false);

  useEffect(() => {
    set_note('');
  }, [transfer?.id]);

  const submit = async () => {
    if (!transfer) return;
    set_busy(true);
    try {
      await ignoreUnmatchedTransferApi(transfer.id, note.trim());
      notify.success('Đã bỏ qua giao dịch');
      onClose();
      onDone();
    } catch (error) {
      notify.error(error);
    } finally {
      set_busy(false);
    }
  };

  return (
    <AdminDialog
      open={!!transfer}
      onClose={onClose}
      title="Bỏ qua chuyển khoản"
      subtitle={transfer ? `${format_money(transfer.amount)} · ${transfer.content || 'không có nội dung'}` : ''}
      size="sm"
      mode="form"
      dirty={note.trim() !== ''}
      busy={busy}
      footer={
        <AdminDialogFooter
          onCancel={onClose}
          onSubmit={submit}
          submitText="Bỏ qua"
          busy={busy}
          submitDisabled={note.trim().length < 3}
          tone="danger"
        />
      }
    >
      <div className="space-y-2 text-sm">
        <label htmlFor="fmi_ignore_note" className="block font-semibold text-slate-700">
          Lý do
        </label>
        <Textarea
          id="fmi_ignore_note"
          value={note}
          onChange={(event) => set_note(event.target.value)}
          placeholder="VD: Không phải tiền vé / Đã hoàn tiền cho khách ngày …"
          rows={3}
          maxLength={300}
        />
      </div>
    </AdminDialog>
  );
}
