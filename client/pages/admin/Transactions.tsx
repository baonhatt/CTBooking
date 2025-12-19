import React, { useEffect, useMemo, useState } from "react";
import { getAdminRevenue, getTransactions } from "@/lib/api";
import AdminLayout from "@/admin/layouts/AdminLayout";
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
  const [sortKey, setSortKey] = useState<"created_at" | "paid_at">("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [paymentMethod, setPaymentMethod] = useState<string>("");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("admin_transactions_filters");
      if (raw) {
        const s = JSON.parse(raw);
        if (typeof s.txQuery === "string") setTxQuery(s.txQuery);
        if (typeof s.txStatus === "string" && (s.txStatus === "paid" || s.txStatus === "all")) setTxStatus(s.txStatus);
        if (typeof s.sortKey === "string" && (s.sortKey === "created_at" || s.sortKey === "paid_at")) setSortKey(s.sortKey);
        if (typeof s.sortDir === "string" && (s.sortDir === "asc" || s.sortDir === "desc")) setSortDir(s.sortDir);
        if (typeof s.paymentMethod === "string") setPaymentMethod(s.paymentMethod);
        if (typeof s.fromDate === "string") setFromDate(s.fromDate);
        if (typeof s.toDate === "string") setToDate(s.toDate);
      }
    } catch { }
  }, []);

  useEffect(() => {
    try {
      const state = {
        txQuery,
        txStatus,
        sortKey,
        sortDir,
        paymentMethod,
        fromDate,
        toDate,
      };
      localStorage.setItem("admin_transactions_filters", JSON.stringify(state));
    } catch { }
  }, [txQuery, txStatus, sortKey, sortDir, paymentMethod, fromDate, toDate]);

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
          sort: sortKey,
          dir: sortDir,
          payment_method: paymentMethod || undefined,
          from: fromDate || undefined,
          to: toDate || undefined,
        });
        setTransactions(
          items.map((t: any) => ({
            id: String(t.id),
            userId: t.user_id,
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
  }, [txPage, pageSize, txQuery, txStatus, sortKey, sortDir, paymentMethod, fromDate, toDate]);

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
        status: txStatus,
        sort: sortKey,
        dir: sortDir,
        payment_method: paymentMethod || undefined,
        from: fromDate || undefined,
        to: toDate || undefined,
      });
      setTransactions(
        items.map((t: any) => ({
            id: String(t.id),
            userId: t.user_id,
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
      handleLogout={() => {
        localStorage.removeItem("adminToken");
        localStorage.removeItem("adminEmail");
        window.dispatchEvent(new Event("admin-auth-changed"));
        window.location.href = "/admin";
      }}
    >
      <TransactionsContent
        data={transactions}
        totalPages={txTotalPages}
        currentPage={txPage}
        setPage={setTxPage}
        txQuery={txQuery}
        setTxQuery={setTxQuery}
        metrics={metrics}
        transactionsLength={totalTransactions}
        onRefresh={handleRefresh}
        txStatus={txStatus}
        setTxStatus={setTxStatus}
        sortKey={sortKey}
        sortDir={sortDir}
        setSortKey={setSortKey}
        setSortDir={setSortDir}
        paymentMethod={paymentMethod}
        setPaymentMethod={setPaymentMethod}
        fromDate={fromDate}
        toDate={toDate}
        setFromDate={setFromDate}
        setToDate={setToDate}
        isLoading={isLoading}
      />
    </AdminLayout>
  );
}
