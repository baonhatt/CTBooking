import React, { useEffect, useMemo, useState } from "react";
import { getTransactions } from "@/lib/api";
import AdminLayout from "@/admin/layouts/AdminLayout";
import TransactionsContent from "@/components/admin/content/TransactionsContent";

export default function TransactionsPage() {
        const getInitialFilters = () => {
                try {
                        const raw = localStorage.getItem("admin_transactions_filters");
                        if (raw) return JSON.parse(raw);
                } catch { }
                return {};
        };

        const initialFilters = getInitialFilters();

        const [transactions, setTransactions] = useState<any[]>([]);
        const [totalTransactions, setTotalTransactions] = useState(0);
        const [txPage, setTxPage] = useState(1);
        const pageSize = 10;
        const [txQuery, setTxQuery] = useState(initialFilters.txQuery ?? "");
        const [txStatus, setTxStatus] = useState<"paid" | "all">(initialFilters.txStatus ?? "paid");
        const [sortKey, setSortKey] = useState<"created_at" | "paid_at">(
                initialFilters.sortKey ?? "created_at",
        );
        const [sortDir, setSortDir] = useState<"asc" | "desc">(initialFilters.sortDir ?? "desc");
        const [paymentMethod, setPaymentMethod] = useState<string>(initialFilters.paymentMethod ?? "");
        const [fromDate, setFromDate] = useState<string>(initialFilters.fromDate ?? "");
        const [toDate, setToDate] = useState<string>(initialFilters.toDate ?? "");
        const [isLoading, setIsLoading] = useState(false);


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
                                        searchText: txQuery,
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
                                                ticket_package_name: t.ticket_package_name,
                                                ticketCount: t.ticketCount,
                                                totalPrice: t.totalPrice,
                                                paymentMethod: t.paymentMethod,
                                                paymentStatus: t.paymentStatus,
                                                is_used: t.is_used,
                                                expired: t.expired,
                                                createdAt: new Date(t.createdAt),
                                                paidAt: t.paidAt ? new Date(t.paidAt) : null,
                                                updatedAt: t.updatedAt ? new Date(t.updatedAt) : null,
                                        })),
                                );
                                setTotalTransactions(total);
                        } catch (error) {
                                console.error("Lỗi load giao dịch:", error);
                        } finally {
                                setIsLoading(false);
                        }
                })();
        }, [
                txPage,
                pageSize,
                txQuery,
                txStatus,
                sortKey,
                sortDir,
                paymentMethod,
                fromDate,
                toDate,
        ]);


        const txTotalPages = useMemo(
                () => Math.max(1, Math.ceil(totalTransactions / pageSize)),
                [totalTransactions],
        );

        const handleRefresh = async () => {
                try {
                        setIsLoading(true);
                        const { items, total } = await getTransactions({
                                page: txPage,
                                pageSize,
                                searchText: txQuery,
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
                                        transactionId: t.transactionId,
                                        ticket_package_name: t.ticket_package_name,
                                        ticketCount: t.ticketCount,
                                        totalPrice: t.totalPrice,
                                        paymentMethod: t.paymentMethod,
                                        paymentStatus: t.paymentStatus,
                                        createdAt: new Date(t.createdAt),
                                        paidAt: t.paidAt ? new Date(t.paidAt) : null,
                                        updatedAt: t.updatedAt ? new Date(t.updatedAt) : null,
                                        is_used: t.is_used,
                                })),
                        );
                        setTotalTransactions(total);
                } catch (error) {
                        console.error("Lỗi refresh giao dịch:", error);
                } finally {
                        setIsLoading(false);
                }
        };

        return (
                <AdminLayout
                        active={"transactions" as any}
                        setActive={(() => { }) as any}
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
