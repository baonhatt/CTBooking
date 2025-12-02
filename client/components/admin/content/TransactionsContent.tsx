import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import React from "react";
import { Pagination, PaginationContent, PaginationItem, PaginationPrevious, PaginationNext, PaginationLink } from "@/components/ui/pagination";

interface TransactionData {
  id: string;
  user: string;
  amount: number;
  method: string;
  status: string;
  createdAt: Date;
}

interface TransactionsContentProps {
  data: TransactionData[];
  totalPages: number;
  currentPage: number;
  setPage: (page: number) => void;
  txQuery: string;
  setTxQuery: (query: string) => void;
  metrics: any;
  transactions: TransactionData[];
  transactionsLength: number;
}

const TransactionsContent: React.FC<TransactionsContentProps> = ({ data, totalPages, currentPage, setPage, txQuery, setTxQuery, metrics, transactions, transactionsLength }) => {

  const getStatusVariant = (status: string) => {
    switch (status.toLowerCase()) {
      case "completed":
        return "default";
      case "pending":
        return "secondary";
      case "failed":
        return "destructive";
      default:
        return "outline";
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="rounded-xl">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Tổng giao dịch</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{transactions.length}</div>
            <p className="text-xs text-gray-500">Tổng số lượng giao dịch</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Tổng Doanh thu</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.revenueTotal?.toLocaleString('en-US') || 0}</div>
            <p className="text-xs text-gray-500">Tất cả giao dịch thành công</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Doanh thu TB</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(metrics?.revenueTotal / (transactions.length || 1))?.toLocaleString('en-US', { maximumFractionDigits: 0 }) || 0}
            </div>
            <p className="text-xs text-gray-500">Trung bình một giao dịch</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-between items-center">
        <Input
          placeholder={`Tìm kiếm ${transactions.length} giao dịch...`}
          value={txQuery}
          onChange={(e) => setTxQuery(e.target.value)}
          className="max-w-sm"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Người dùng</TableHead>
                <TableHead>Số tiền</TableHead>
                <TableHead>Phương thức</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Thời gian</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((tx) => (
                <TableRow key={tx.id}>
                  <TableCell className="font-medium">{tx.id.slice(0, 8)}...</TableCell>
                  <TableCell>{tx.user}</TableCell>
                  <TableCell className="font-semibold">{tx.amount.toLocaleString('en-US')}</TableCell>
                  <TableCell>{tx.method}</TableCell>
                  <TableCell>
                    <Badge variant={getStatusVariant(tx.status)}>
                      {tx.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{tx.createdAt.toLocaleString("vi-VN")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination className="mt-4">
            <PaginationContent>
              <PaginationItem>
                {/* Nút Trước (Previous) */}
                <PaginationPrevious
                  href="#"
                  onClick={(e) => { e.preventDefault(); setPage(Math.max(1, currentPage - 1)); }}
                  aria-disabled={currentPage === 1}
                  className={currentPage === 1 ? 'pointer-events-none opacity-50' : ''}
                />
              </PaginationItem>

              {/* Các số trang */}
              {Array.from({ length: totalPages }).map((_, i) => (
                <PaginationItem key={i}>
                  <PaginationLink
                    href="#"
                    isActive={currentPage === i + 1}
                    onClick={(e) => { e.preventDefault(); setPage(i + 1); }}
                  >
                    {i + 1}
                  </PaginationLink>
                </PaginationItem>
              ))}

              <PaginationItem>
                {/* Nút Sau (Next) */}
                <PaginationNext
                  href="#"
                  onClick={(e) => { e.preventDefault(); setPage(Math.min(totalPages, currentPage + 1)); }}
                  aria-disabled={currentPage === totalPages}
                  className={currentPage === totalPages ? 'pointer-events-none opacity-50' : ''}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </CardContent>
      </Card>
    </div>
  );
};

export default TransactionsContent;