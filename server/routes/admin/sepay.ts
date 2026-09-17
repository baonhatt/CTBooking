export async function checkSepayTransactionImpl(
  code: string,
  expectedAmount: number,
  sepayToken: string
) {
  if (!code || String(code).trim() === '' || String(code).toLowerCase() === 'null' || String(code).toLowerCase() === 'undefined') {
    return {
      success: false,
      message: 'Mã giao dịch không hợp lệ (trống hoặc null) nên không thể kiểm tra'
    };
  }

  if (!sepayToken) {
    throw new Error('Thiếu cấu hình SEPAY_API_TOKEN trên hệ thống');
  }

  const url = `https://my.sepay.vn/userapi/transactions/list?keyword=${encodeURIComponent(code)}`;
  
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${sepayToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!res.ok) {
      throw new Error(`Lỗi kết nối tới SePay: ${res.status} ${res.statusText}`);
    }

    const data: any = await res.json();
    
    if (data.status !== 200) {
      throw new Error(data.message || 'Lỗi truy vấn SePay');
    }

    const transactions = data.transactions || [];
    
    if (transactions.length === 0) {
      return {
        success: false,
        message: 'Không tìm thấy giao dịch nào khớp với mã này trên hệ thống SePay'
      };
    }

    // Check if any transaction matches or exceeds the expected amount
    let foundMismatch = false;
    let highestAmount = 0;

    for (const tx of transactions) {
      // ĐẢM BẢO CHẮC CHẮN NỘI DUNG GIAO DỊCH PHẢI CHỨA CÚ PHÁP
      const contentStr = String(tx.transaction_content || '').toUpperCase();
      const checkStr = String(code).toUpperCase().trim();
      
      if (!contentStr.includes(checkStr)) {
        continue;
      }

      const amountIn = Number(tx.amount_in || 0);
      if (amountIn >= expectedAmount) {
        return {
          success: true,
          message: 'Giao dịch hợp lệ',
          transaction: tx
        };
      } else {
        foundMismatch = true;
        if (amountIn > highestAmount) {
          highestAmount = amountIn;
        }
      }
    }

    if (foundMismatch) {
      return {
        success: false,
        message: `Tìm thấy giao dịch chứa mã này nhưng số tiền không khớp. Thực nhận: ${highestAmount.toLocaleString('vi-VN')}đ, Yêu cầu: ${expectedAmount.toLocaleString('vi-VN')}đ.`
      };
    }

    return {
      success: false,
      message: 'Không tìm thấy bất kỳ lịch sử chuyển khoản nào chứa mã này'
    };

  } catch (err: any) {
    throw new Error(err.message || 'Lỗi gọi API SePay');
  }
}
