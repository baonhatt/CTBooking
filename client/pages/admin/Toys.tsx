import React, { useEffect, useMemo, useState } from "react"
import { getToys, deleteToyApi } from "@/lib/api"
import AdminLayout from "@/components/admin/AdminLayout"
import ToysContent from "@/components/admin/content/ToysContent"
import AdminEditModal from "@/components/admin/AdminEditModal"

export default function ToysPage() {
  const [toys, setToys] = useState<any[]>([])
  const [totalToys, setTotalToys] = useState(0)
  const [toysPage, setToysPage] = useState(1)
  const pageSize = 10
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [editType, setEditType] = useState<"toy" | null>(null)
  const [editData, setEditData] = useState<any>({})

  useEffect(() => { (async () => { const { items, total } = await getToys({ page: toysPage, pageSize }); setToys(items.map((t: any) => ({ id: t.id, name: t.name, category: t.category, price: Number(t.price), stock: t.stock, status: t.status, image_url: t.image_url }))); setTotalToys(total) })() }, [toysPage, pageSize])

  const toysTotalPages = useMemo(() => Math.max(1, Math.ceil(totalToys / pageSize)), [totalToys])

  const handleOpenEdit = (_type: "toy", data: any) => { setEditType("toy"); setEditData(data); setIsEditOpen(true) }
  const handleOpenCreate = () => { setEditType("toy"); setEditData({ id: 0, name: "", category: "", price: 0, stock: 0, status: "active", image_url: "" }); setIsEditOpen(true) }

  return (
    <AdminLayout active="toys" setActive={() => {}} adminEmailState={localStorage.getItem("adminEmail") || "admin@email.com"} handleLogout={() => {}}>
      <ToysContent data={toys} totalPages={toysTotalPages} currentPage={toysPage} setPage={setToysPage} onEdit={handleOpenEdit} onCreate={handleOpenCreate} toysLength={totalToys} deleteToyApi={deleteToyApi as any} setToys={setToys} />
      <AdminEditModal
        isEditOpen={isEditOpen}
        setIsEditOpen={setIsEditOpen}
        editType={editType as any}
        editData={editData}
        setEditData={setEditData}
        setUsers={() => {}}
        moviesLocal={[]}
        toLocalDateTimeString={(d: Date) => d.toISOString().slice(0,16)}
        pageSize={pageSize}
        currentPage={toysPage}
        setMoviesLocal={() => {}}
        setMovieStatus={() => {}}
        setToys={setToys}
        setShowtimes={() => {}}
      />
    </AdminLayout>
  )
}
