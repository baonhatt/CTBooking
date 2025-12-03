import AdminLayout from "@/components/admin/AdminLayout";
import UsersContent from "@/components/admin/content/UsersContent";
import AdminEditModal from "@/components/admin/AdminEditModal";
import React, { useMemo, useState, useEffect } from "react";
import { getUsers } from "@/lib/api";

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [usersPage, setUsersPage] = useState(1);
  const [userQuery, setUserQuery] = useState("");
  const pageSize = 10;
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editData, setEditData] = useState<any>(null);

  useEffect(() => {
    (async () => {
      try {
        const { items, total } = await getUsers({
          page: usersPage,
          pageSize,
          q: userQuery,
        });
        setUsers(
          items.map((u: any) => ({
            id: String(u.id),
            fullname: u.fullname,
            email: u.email,
            phone: u.phone,
            is_active: u.is_active,
            total_bookings: u.total_bookings,
            created_at: new Date(u.created_at),
          })),
        );
        setTotalUsers(total);
      } catch (err) {
        console.error("Lỗi load users:", err);
      }
    })();
  }, [usersPage, userQuery, pageSize]);

  const usersTotalPages = useMemo(
    () => Math.max(1, Math.ceil(totalUsers / pageSize)),
    [totalUsers],
  );

  const handleOpenEdit = (_type: "user", data: any) => {
    setEditData(data);
    setIsEditOpen(true);
  };

  const handleRefresh = async () => {
    const { items, total } = await getUsers({
      page: usersPage,
      pageSize,
      q: userQuery,
    });
    setUsers(
      items.map((u: any) => ({
        id: String(u.id),
        fullname: u.fullname,
        email: u.email,
        phone: u.phone,
        is_active: u.is_active,
        total_bookings: u.total_bookings,
        created_at: new Date(u.created_at),
      })),
    );
    setTotalUsers(total);
  };

  return (
    <AdminLayout
      active="users"
      setActive={() => { }}
      adminEmailState={localStorage.getItem("adminEmail") || "admin@email.com"}
      handleLogout={() => { }}
    >
      <UsersContent
        data={users}
        totalPages={usersTotalPages}
        currentPage={usersPage}
        setPage={setUsersPage}
        userQuery={userQuery}
        setUserQuery={setUserQuery}
        onEdit={handleOpenEdit}
        usersLength={totalUsers}
        onRefresh={handleRefresh}
      />
      <AdminEditModal
        editType={editData ? "user" : null}
        editData={editData}
        setIsEditOpen={setIsEditOpen}
        isEditOpen={isEditOpen}
        setUsers={setUsers}
        setMoviesLocal={() => { }}
        setToys={() => { }}
        setShowtimes={() => { }}
      />
    </AdminLayout>
  );
}
