import AdminLayout from "@/components/admin/AdminLayout"
import UsersContent from "@/components/admin/content/UsersContent"
import React, { useEffect, useMemo, useState } from "react"

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([])
  const [totalUsers, setTotalUsers] = useState(0)
  const [usersPage, setUsersPage] = useState(1)
  const pageSize = 10
  const [userQuery, setUserQuery] = useState("")

  useEffect(() => { setUsers([]); setTotalUsers(0) }, [usersPage, pageSize, userQuery])

  const usersTotalPages = useMemo(() => Math.max(1, Math.ceil(totalUsers / pageSize)), [totalUsers])

  const handleOpenEdit = (_type: "user", _data: any) => {}

  return (
    <AdminLayout active="users" setActive={() => {}} adminEmailState={localStorage.getItem("adminEmail") || "admin@email.com"} handleLogout={() => {}}>
      <UsersContent data={users} totalPages={usersTotalPages} currentPage={usersPage} setPage={setUsersPage} userQuery={userQuery} setUserQuery={setUserQuery} onEdit={handleOpenEdit} usersLength={totalUsers} />
    </AdminLayout>
  )
}
