import React, { useEffect, useMemo, useState } from "react";
import { getAdminRevenue, getTransactions } from "@/lib/api";
import AdminLayout from "@/components/admin/AdminLayout";
import TransactionsContent from "@/components/admin/content/TransactionsContent";

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [totalTransactions, setTotalTransactions] = useState(0);
  const [txPage, setTxPage] = useState(1);
  const pageSize = 10;
  const [txQuery, setTxQuery] = useState("");
  const [revenueTotal, setRevenueTotal] = useState(0);
  const [revenueCount, setRevenueCount] = useState(0);
  const [txStatus, setTxStatus] = useState<"paid" | "all">("paid");
  const [isLoading, setIsLoading] = useState(false);

  // Load transactions khi page hoặc query thay đổi
  useEffect(() => {
    (async () => {
      try {
        setIsLoading(true);
        const { items, total } = await getTransactions({
          page: txPage,
          pageSize,
          email: txQuery,
          status: txStatus,
        });
        setTransactions(
          items.map((t: any) => ({
            id: String(t.id),
            email: t.email,
            userName: t.userName,
            movieTitle: t.movieTitle,
            ticketCount: t.ticketCount,
            totalPrice: t.totalPrice,
            paymentMethod: t.paymentMethod,
            paymentStatus: t.paymentStatus,
            createdAt: new Date(t.createdAt),
          })),
        );
        setTotalTransactions(total);
      } catch (error) {
        console.error("Lỗi load giao dịch:", error);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [txPage, pageSize, txQuery, txStatus]);

  useEffect(() => {
    (async () => {
      try {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);
        const { total, count } = await getAdminRevenue({
          from: todayStart.toISOString(),
          to: todayEnd.toISOString(),
          status: "paid",
        });
        setRevenueTotal(total);
        setRevenueCount(count);
      } catch (error) {
        console.error("Lỗi load doanh thu:", error);
      }
    })();
  }, []);

  const txTotalPages = useMemo(
    () => Math.max(1, Math.ceil(totalTransactions / pageSize)),
    [totalTransactions],
  );
  const metrics = useMemo(
    () => ({
      totalUsers: 0,
      totalMovies: 0,
      revenueTotal,
      revenueCount,
      avgRevenuePerUser: 0,
      totalShowtimes: 0,
      totalToys: 0,
      totalTransactions,
    }),
    [revenueTotal, revenueCount, totalTransactions],
  );

  const handleRefresh = async () => {
    try {
      setIsLoading(true);
      const { items, total } = await getTransactions({
        page: txPage,
        pageSize,
        email: txQuery,
      });
      setTransactions(
        items.map((t: any) => ({
          id: String(t.id),
          email: t.email,
          userName: t.userName,
          movieTitle: t.movieTitle,
          ticketCount: t.ticketCount,
          totalPrice: t.totalPrice,
          paymentMethod: t.paymentMethod,
          paymentStatus: t.paymentStatus,
          createdAt: new Date(t.createdAt),
        })),
      );
      setTotalTransactions(total);
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);
      const { total: revTotal, count: revCount } = await getAdminRevenue({
        from: todayStart.toISOString(),
        to: todayEnd.toISOString(),
        status: "all",
      });
      setRevenueTotal(revTotal);
      setRevenueCount(revCount);
    } catch (error) {
      console.error("Lỗi refresh giao dịch:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AdminLayout
      active="transactions"
      setActive={() => { }}
      adminEmailState={localStorage.getItem("adminEmail") || "admin@email.com"}
      handleLogout={() => { }}
    >
      <TransactionsContent
        data={transactions}
        totalPages={txTotalPages}
        currentPage={txPage}
        setPage={setTxPage}
        txQuery={txQuery}
        setTxQuery={setTxQuery}
        metrics={metrics}
        transactionsLength={transactions.length}
        onRefresh={handleRefresh}
        txStatus={txStatus}
        setTxStatus={setTxStatus}
        isLoading={isLoading}
      />
    </AdminLayout>
  );
}
