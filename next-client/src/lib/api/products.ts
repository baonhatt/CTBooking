import { siteConfig } from '@/config/site';

const API = process.env.NEXT_PUBLIC_API_URL ?? '';

export async function getActiveTickets(branchId?: number, options?: { signal?: AbortSignal }) {
  let url = `${API}/api/tickets-active`;
  if (branchId !== undefined && branchId !== null) {
    url += `?branch_id=${branchId}`;
  }
  // Vô hiệu hóa cache: luôn lấy danh sách vé mới nhất (tickets-active hỗ trợ branch_id)
  const res = await fetch(url, {
    cache: 'no-store',
    headers: {
      ...(typeof window === 'undefined' && {
        'User-Agent': `Mozilla/5.0 (compatible; CinesphereBot/1.0; +${siteConfig.domain})`
      })
    }
  });
  if (!res.ok) {
    return { items: [], total: 0 };
  }
  return await res.json();
}

// The toy list fetcher was removed with the public toy routes (TẠM ẨN ĐỒ CHƠI 20261110): see app/page.tsx.
