/**
 * Tiện ích xuất dữ liệu Excel (.xls) có màu sắc định dạng & CSV (UTF-8 BOM)
 */

export interface ExportColumn<T = any> {
    header: string;
    key?: keyof T | string;
    align?: 'left' | 'center' | 'right';
    isCurrency?: boolean;
    isDateTime?: boolean;
    formatter?: (row: T) => string | number | null | undefined;
}

/**
 * Định dạng ngày giờ chuẩn đồng bộ: dd/MM/yyyy HH:mm:ss (Ví dụ: 23/08/2026 09:37:49)
 */
export function formatExportDateTime(val: any): string {
    if (!val) return '---';
    const d = new Date(val);
    if (isNaN(d.getTime())) return '---';
    const pad = (n: number) => (n < 10 ? '0' + n : String(n));
    const hours = pad(d.getHours());
    const minutes = pad(d.getMinutes());
    const seconds = pad(d.getSeconds());
    const day = pad(d.getDate());
    const month = pad(d.getMonth() + 1);
    const year = d.getFullYear();
    return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
}

/**
 * Định dạng tiền tệ chuẩn tiếng Việt: 500.000 ₫
 */
export function formatExportCurrency(val: any): string {
    const num = Number(val);
    if (isNaN(num) || num === 0) return '0 ₫';
    return `${num.toLocaleString('vi-VN')} ₫`;
}

/**
 * Xuất file Excel (.xls) với template giao diện HTML:
 * Header màu xanh nhạt (#D9EAFD / #E0F2FE), chữ đậm, viền ô sắc nét, định dạng tiền tệ & ngày giờ đồng bộ.
 */
export function exportToStyledExcel<T = any>(
    filename: string,
    columns: ExportColumn<T>[],
    data: T[],
    sheetTitle: string = 'Danh sách giao dịch'
) {
    if (!data || data.length === 0) {
        throw new Error('Không có dữ liệu để xuất');
    }

    const headerCells = columns
        .map(
            (col) => `
            <th style="
                background-color: #D9EAFD; 
                color: #0F2F57; 
                font-weight: bold; 
                font-size: 13px; 
                padding: 10px 14px; 
                border: 1px solid #ADCBE8; 
                text-align: ${col.align || 'left'};
                white-space: nowrap;
            ">
                ${col.header}
            </th>
        `
        )
        .join('');

    const rowsHtml = data
        .map((row, idx) => {
            const bgColor = idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC';
            const cellHtml = columns
                .map((col) => {
                    let val: any;
                    if (col.formatter) {
                        val = col.formatter(row);
                    } else if (col.key && (row as any)[col.key] !== undefined) {
                        val = (row as any)[col.key];
                    } else {
                        val = '';
                    }

                    if (val === null || val === undefined) {
                        val = '';
                    }

                    const align = col.align || (col.isCurrency ? 'right' : col.isDateTime ? 'center' : 'left');
                    const strVal = String(val);

                    return `
                    <td style="
                        background-color: ${bgColor}; 
                        color: #1E293B; 
                        font-size: 12px; 
                        padding: 8px 12px; 
                        border: 1px solid #E2E8F0; 
                        text-align: ${align};
                        white-space: nowrap;
                        mso-number-format:'\\@';
                    ">
                        ${strVal}
                    </td>
                `;
                })
                .join('');

            return `<tr>${cellHtml}</tr>`;
        })
        .join('');

    const template = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" 
              xmlns:x="urn:schemas-microsoft-com:office:excel" 
              xmlns="http://www.w3.org/TR/REC-html40">
        <head>
            <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
            <!--[if gte mso 9]>
            <xml>
                <x:ExcelWorkbook>
                    <x:ExcelWorksheets>
                        <x:ExcelWorksheet>
                            <x:Name>${sheetTitle}</x:Name>
                            <x:WorksheetOptions>
                                <x:DisplayGridlines/>
                            </x:WorksheetOptions>
                        </x:ExcelWorksheet>
                    </x:ExcelWorksheets>
                </x:ExcelWorkbook>
            </xml>
            <![endif]-->
            <style>
                body { font-family: 'Segoe UI', Arial, sans-serif; }
                table { border-collapse: collapse; width: 100%; }
            </style>
        </head>
        <body>
            <div style="margin-bottom: 14px; font-size: 16px; font-weight: bold; color: #0F2F57;">
                ${sheetTitle} (Xuất lúc: ${formatExportDateTime(new Date())})
            </div>
            <table>
                <thead>
                    <tr>
                        ${headerCells}
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml}
                </tbody>
            </table>
        </body>
        </html>
    `;

    const blob = new Blob(['\uFEFF' + template], {
        type: 'application/vnd.ms-excel;charset=utf-8;'
    });

    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename.endsWith('.xls') ? filename : `${filename}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

/**
 * Xuất file CSV tiêu chuẩn UTF-8
 */
export function exportToCSV<T = any>(
    filename: string,
    columns: ExportColumn<T>[],
    data: T[]
) {
    if (!data || data.length === 0) {
        throw new Error('Không có dữ liệu để xuất');
    }

    const headers = columns.map((col) => `"${(col.header || '').replace(/"/g, '""')}"`).join(',');

    const rows = data.map((row) => {
        return columns
            .map((col) => {
                let val: any;
                if (col.formatter) {
                    val = col.formatter(row);
                } else if (col.key && (row as any)[col.key] !== undefined) {
                    val = (row as any)[col.key];
                } else {
                    val = '';
                }

                if (val === null || val === undefined) {
                    val = '';
                }

                const strVal = String(val).replace(/"/g, '""');
                return `"${strVal}"`;
            })
            .join(',');
    });

    const csvContent = '\uFEFF' + [headers, ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });

    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

/**
 * Định dạng xuất dữ liệu danh sách giao dịch
 */
export function exportTransactionsData(
    transactions: any[],
    branches: any[] = [],
    filenamePrefix: string = 'danh_sach_giao_dich',
    format: 'excel' | 'csv' = 'excel'
) {
    const columns: ExportColumn<any>[] = [
        {
            header: 'Mã GD (ID)',
            key: 'id',
            align: 'center'
        },
        {
            header: 'Thời gian tạo',
            formatter: (t) => formatExportDateTime(t.createdAt),
            align: 'center',
            isDateTime: true
        },
        {
            header: 'Thời gian thanh toán',
            formatter: (t) => (t.paidAt ? formatExportDateTime(t.paidAt) : '---'),
            align: 'center',
            isDateTime: true
        },
        {
            header: 'Khách hàng',
            formatter: (t) => t.userName || 'Khách vãng lai',
            align: 'left'
        },
        {
            header: 'Email',
            formatter: (t) => t.email || '',
            align: 'left'
        },
        {
            header: 'Chi nhánh',
            formatter: (t) => {
                if (!t.branch_id) return 'Tất cả chi nhánh';
                const found = branches.find((b) => b.id === t.branch_id);
                return found?.name || `Chi nhánh #${t.branch_id}`;
            },
            align: 'left'
        },
        {
            header: 'Dịch vụ',
            formatter: (t) => (t.booking_type === 'vr' ? 'Trải nghiệm VR' : 'Vé xem phim'),
            align: 'center'
        },
        {
            header: 'Tên gói / Vé',
            formatter: (t) => t.ticket_package_name || '',
            align: 'left'
        },
        {
            header: 'Số lượng vé/lượt',
            formatter: (t) => t.ticketCount || 1,
            align: 'center'
        },
        {
            header: 'Giá gốc (VNĐ)',
            formatter: (t) => formatExportCurrency(t.originalTotalPrice ?? t.original_price ?? t.totalPrice ?? 0),
            align: 'right',
            isCurrency: true
        },
        {
            header: 'Mã Voucher',
            formatter: (t) => t.voucher_code || '---',
            align: 'center'
        },
        {
            header: 'Tiền giảm voucher (VNĐ)',
            formatter: (t) => formatExportCurrency(t.voucher_discount_amount || 0),
            align: 'right',
            isCurrency: true
        },
        {
            header: 'Tổng thực thu (VNĐ)',
            formatter: (t) => formatExportCurrency(t.totalPrice || 0),
            align: 'right',
            isCurrency: true
        },
        {
            header: 'Phương thức thanh toán',
            formatter: (t) => (t.paymentMethod || '').toUpperCase(),
            align: 'center'
        },
        {
            header: 'Trạng thái thanh toán',
            formatter: (t) => {
                if (t.paymentStatus === 'paid') return 'Đã thanh toán';
                if (t.paymentStatus === 'pending') return 'Chờ thanh toán';
                if (t.paymentStatus === 'failed') return 'Đã hủy';
                return t.paymentStatus || '';
            },
            align: 'center'
        },
        {
            header: 'Trạng thái vé/dịch vụ',
            formatter: (t) => {
                if (t.paymentStatus === 'failed') return 'Đã hủy';
                if (t.paymentStatus === 'pending') return 'Chờ thanh toán';
                if (t.is_used) return 'Đã sử dụng';
                if (t.expired) return 'Đã quá hạn';
                return 'Đang đợi dùng';
            },
            align: 'center'
        },
        {
            header: 'Sale phụ trách',
            formatter: (t) => t.sale_name || 'Voucher chung',
            align: 'left'
        },
        {
            header: 'Email Sale',
            formatter: (t) => t.sale_email || '---',
            align: 'left'
        }
    ];

    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `${filenamePrefix}_${timestamp}`;

    if (format === 'csv') {
        exportToCSV(`${filename}.csv`, columns, transactions);
    } else {
        exportToStyledExcel(`${filename}.xls`, columns, transactions, 'Báo Cáo Giao Dịch');
    }
}
