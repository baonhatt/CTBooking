import React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table"
import { Button } from "@/components/ui/button"

interface UserData { id: string; name: string; email: string; phone: string; status: "active" | "inactive"; createdAt: Date }
interface Props { data: UserData[]; totalPages: number; currentPage: number; setPage: (p: number) => void; userQuery: string; setUserQuery: (q: string) => void; onEdit: (type: "user", data: any) => void; usersLength: number }

export default function UsersContent({ data, totalPages, currentPage, setPage, userQuery, setUserQuery, onEdit, usersLength }: Props) {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center"><h3 className="text-lg font-semibold">Tổng cộng: {usersLength} người dùng</h3><input className="border rounded px-2 py-1" value={userQuery} onChange={(e) => setUserQuery(e.target.value)} placeholder="Tìm người dùng" /></div>
      <Card><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead>ID</TableHead><TableHead>Tên</TableHead><TableHead>Email</TableHead><TableHead>SĐT</TableHead><TableHead>Trạng thái</TableHead><TableHead>Ngày tạo</TableHead><TableHead className="text-right">Hành động</TableHead></TableRow></TableHeader><TableBody>{data.map((u) => (<TableRow key={u.id}><TableCell className="font-medium">{u.id}</TableCell><TableCell>{u.name}</TableCell><TableCell>{u.email}</TableCell><TableCell>{u.phone}</TableCell><TableCell>{u.status}</TableCell><TableCell>{u.createdAt.toLocaleString()}</TableCell><TableCell className="text-right"><Button variant="outline" size="sm" onClick={() => onEdit("user", u)}>Sửa</Button></TableCell></TableRow>))}</TableBody></Table></CardContent></Card>
      <div className="flex gap-2"><Button variant="outline" onClick={() => setPage(Math.max(1, currentPage - 1))} disabled={currentPage === 1}>Trước</Button><div className="px-2">Trang {currentPage}/{totalPages}</div><Button variant="outline" onClick={() => setPage(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages}>Sau</Button></div>
    </div>
  )
}

