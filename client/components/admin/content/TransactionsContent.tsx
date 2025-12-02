import React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table"

interface Tx { id: string; user: string; amount: number; method: string; status: string; createdAt: Date }
interface Metrics { totalUsers: number; totalMovies: number; revenueTotal: number; revenueCount: number; avgRevenuePerUser: number; totalShowtimes: number; totalToys: number; totalTransactions: number }
interface Props { data: Tx[]; totalPages: number; currentPage: number; setPage: (p: number) => void; txQuery: string; setTxQuery: (q: string) => void; metrics: Metrics; transactions: Tx[]; transactionsLength: number }

export default function TransactionsContent({ data, totalPages, currentPage, setPage, txQuery, setTxQuery, metrics, transactionsLength }: Props) {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center"><h3 className="text-lg font-semibold">Tổng cộng: {transactionsLength} giao dịch</h3><input className="border rounded px-2 py-1" value={txQuery} onChange={(e) => setTxQuery(e.target.value)} placeholder="Tìm giao dịch" /></div>
      <Card><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead>ID</TableHead><TableHead>User</TableHead><TableHead>Số tiền</TableHead><TableHead>Phương thức</TableHead><TableHead>Trạng thái</TableHead><TableHead>Thời gian</TableHead></TableRow></TableHeader><TableBody>{data.map((t) => (<TableRow key={t.id}><TableCell className="font-medium">{t.id}</TableCell><TableCell>{t.user}</TableCell><TableCell>{t.amount.toLocaleString('en-US')}</TableCell><TableCell>{t.method}</TableCell><TableCell>{t.status}</TableCell><TableCell>{t.createdAt.toLocaleString()}</TableCell></TableRow>))}</TableBody></Table></CardContent></Card>
      <div className="flex gap-2"><div>Doanh thu: {metrics.revenueTotal.toLocaleString('en-US')}</div><div>Tổng đơn: {metrics.revenueCount}</div></div>
      <div className="flex gap-2"><button className="border px-2 py-1" onClick={() => setPage(Math.max(1, currentPage - 1))} disabled={currentPage === 1}>Trước</button><div className="px-2">Trang {currentPage}/{totalPages}</div><button className="border px-2 py-1" onClick={() => setPage(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages}>Sau</button></div>
    </div>
  )
}

