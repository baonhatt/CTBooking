import React, { useEffect, useMemo, useState } from "react"
import { getAdminRevenue } from "@/lib/api"
import AdminLayout from "@/components/admin/AdminLayout"
import TransactionsContent from "@/components/admin/content/TransactionsContent"

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<any[]>([])
  const [totalTransactions, setTotalTransactions] = useState(0)
  const [txPage, setTxPage] = useState(1)
  const pageSize = 10
  const [txQuery, setTxQuery] = useState("")
  const [revenueTotal, setRevenueTotal] = useState(0)
  const [revenueCount, setRevenueCount] = useState(0)

  useEffect(() => { setTransactions([]); setTotalTransactions(0) }, [txPage, pageSize, txQuery])
  useEffect(() => { (async () => { const { total, count } = await getAdminRevenue({}); setRevenueTotal(total); setRevenueCount(count) })() }, [])

  const txTotalPages = useMemo(() => Math.max(1, Math.ceil(totalTransactions / pageSize)), [totalTransactions])
  const metrics = useMemo(() => ({ totalUsers: 0, totalMovies: 0, revenueTotal, revenueCount, avgRevenuePerUser: 0, totalShowtimes: 0, totalToys: 0, totalTransactions }), [revenueTotal, revenueCount, totalTransactions])

  return (
    <AdminLayout active="transactions" setActive={() => {}} adminEmailState={localStorage.getItem("adminEmail") || "admin@email.com"} handleLogout={() => {}}>
      <TransactionsContent data={transactions} totalPages={txTotalPages} currentPage={txPage} setPage={setTxPage} txQuery={txQuery} setTxQuery={setTxQuery} metrics={metrics} transactions={transactions} transactionsLength={totalTransactions} />
    </AdminLayout>
  )
}
