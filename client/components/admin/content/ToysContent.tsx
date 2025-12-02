import React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table"
import { Button } from "@/components/ui/button"

interface ToyData { id: number; name: string; category?: string; price: number; stock: number; status: string; image_url?: string }
interface Props { data: ToyData[]; totalPages: number; currentPage: number; setPage: React.Dispatch<React.SetStateAction<number>>; onEdit: (type: "toy", data: any) => void; onCreate: () => void; toysLength: number; deleteToyApi: (id: number) => Promise<any>; setToys: React.Dispatch<React.SetStateAction<ToyData[]>> }

export default function ToysContent({ data, totalPages, currentPage, setPage, onEdit, onCreate, toysLength, deleteToyApi, setToys }: Props) {
  const handleDelete = async (id: number) => { try { await deleteToyApi(id); setToys(prev => prev.filter(s => s.id !== id)) } catch (e: any) { alert(e?.message || "Lỗi xóa đồ chơi") } }
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center"><h3 className="text-lg font-semibold">Tổng cộng: {toysLength} đồ chơi</h3><Button onClick={onCreate}>+ Thêm đồ chơi</Button></div>
      <Card><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead>ID</TableHead><TableHead>Tên</TableHead><TableHead>Danh mục</TableHead><TableHead>Giá</TableHead><TableHead>Tồn kho</TableHead><TableHead>Trạng thái</TableHead><TableHead className="text-right">Hành động</TableHead></TableRow></TableHeader><TableBody>{data.map((x) => (<TableRow key={x.id}><TableCell className="font-medium">{x.id}</TableCell><TableCell>{x.name}</TableCell><TableCell>{x.category || ""}</TableCell><TableCell>{x.price.toLocaleString('en-US')}</TableCell><TableCell>{x.stock}</TableCell><TableCell>{x.status}</TableCell><TableCell className="text-right space-x-2"><Button variant="outline" size="sm" onClick={() => onEdit("toy", x)}>Sửa</Button><Button variant="destructive" size="sm" onClick={() => handleDelete(x.id)}>Xóa</Button></TableCell></TableRow>))}</TableBody></Table></CardContent></Card>
      <div className="flex gap-2"><Button variant="outline" onClick={() => setPage(Math.max(1, currentPage - 1))} disabled={currentPage === 1}>Trước</Button><div className="px-2">Trang {currentPage}/{totalPages}</div><Button variant="outline" onClick={() => setPage(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages}>Sau</Button></div>
    </div>
  )
}

