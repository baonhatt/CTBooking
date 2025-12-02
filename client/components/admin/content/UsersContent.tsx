import { Card, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import React from "react";
import { Pagination, PaginationContent, PaginationItem, PaginationPrevious, PaginationNext, PaginationLink } from "@/components/ui/pagination";

interface UserData {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: "active" | "inactive";
  createdAt: Date;
}

interface UsersContentProps {
  data: UserData[];
  totalPages: number;
  currentPage: number;
  setPage: (page: number) => void;
  userQuery: string;
  setUserQuery: (query: string) => void;
  onEdit: (type: "user", data: UserData) => void;
  usersLength: number;
}

const UsersContent: React.FC<UsersContentProps> = ({ data, totalPages, currentPage, setPage, userQuery, setUserQuery, onEdit, usersLength }) => {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <Input
          placeholder={`Tìm kiếm ${usersLength} người dùng...`}
          value={userQuery}
          onChange={(e) => setUserQuery(e.target.value)}
          className="max-w-sm"
        />
        {/* Nút Thêm mới (nếu có) */}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Họ tên</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>SĐT</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Ngày tạo</TableHead>
                <TableHead className="text-right">Hành động</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{user.phone}</TableCell>
                  <TableCell>
                    <Badge variant={user.status === "active" ? "default" : "secondary"}>
                      {user.status === "active" ? "Hoạt động" : "Bị khóa"}
                    </Badge>
                  </TableCell>
                  <TableCell>{user.createdAt.toLocaleDateString("vi-VN")}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" onClick={() => onEdit("user", user)}>
                      Sửa
                    </Button>
                  </TableCell>
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

export default UsersContent;