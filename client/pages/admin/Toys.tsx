import React, { useEffect, useMemo, useState } from 'react';
import { getToys, deleteToyApi } from '@/lib/api';
import AdminLayout from '@/admin/layouts/AdminLayout';
import ToysContent from '@/components/admin/content/ToysContent';
import { ToyEditModal } from '@/components/admin/dialogs/ToyEditModal';
import { useStaffStore } from '@/store/staffStore';
import { useNavigate } from 'react-router-dom';

export default function ToysPage() {
  const navigate = useNavigate();
  const staff = useStaffStore((state) => state.staff);
  const clearStaff = useStaffStore((state) => state.clearStaff);
  const [activeTab, setActiveTab] = useState('toys');
  const [toys, setToys] = useState<any[]>([]);
  const [totalToys, setTotalToys] = useState(0);
  const [toysPage, setToysPage] = useState(1);
  const pageSize = 10;
  const [searchQuery, setSearchQuery] = useState('');
  const [showActiveOnly, setShowActiveOnly] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editData, setEditData] = useState<any>({});
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      const { items, total } = await getToys({
        page: toysPage,
        pageSize,
        q: searchQuery,
        status: showActiveOnly ? 'active' : 'all'
      });
      setToys(
        items.map((t: any) => ({
          id: t.id,
          name: t.name,
          category: t.category,
          price: Number(t.price),
          stock: t.stock,
          status: t.status,
          image_url: t.image_url
        }))
      );
      setTotalToys(total);
      setIsLoading(false);
    })();
  }, [toysPage, pageSize, searchQuery, showActiveOnly]);

  const toysTotalPages = useMemo(() => Math.max(1, Math.ceil(totalToys / pageSize)), [totalToys]);

  const handleOpenEdit = (_type: 'toy', data: any) => {
    setEditData(data);
    setIsEditOpen(true);
  };
  const handleOpenCreate = () => {
    setEditData({
      id: 0,
      name: '',
      category: '',
      price: 0,
      stock: 0,
      status: 'active',
      image_url: ''
    });
    setIsEditOpen(true);
  };

  const handleRefresh = async () => {
    setIsLoading(true);
    const { items, total } = await getToys({
      page: toysPage,
      pageSize,
      q: searchQuery,
      status: showActiveOnly ? 'active' : 'all'
    });
    setToys(
      items.map((t: any) => ({
        id: t.id,
        name: t.name,
        category: t.category,
        price: Number(t.price),
        stock: t.stock,
        status: t.status,
        image_url: t.image_url
      }))
    );
    setTotalToys(total);
    setIsLoading(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('staffToken');
    clearStaff();
    navigate('/login');
  };

  return (
    <AdminLayout
      active={activeTab as any}
      setActive={setActiveTab as any}
      adminEmailState={staff?.email || 'admin@email.com'}
      handleLogout={handleLogout}
    >
      <ToysContent
        data={toys}
        totalPages={toysTotalPages}
        currentPage={toysPage}
        setPage={setToysPage}
        onEdit={handleOpenEdit}
        onCreate={handleOpenCreate}
        toysLength={totalToys}
        deleteToyApi={deleteToyApi as any}
        setToys={setToys}
        onRefresh={handleRefresh}
        searchQuery={searchQuery}
        onSearchChange={(query) => {
          setSearchQuery(query);
          setToysPage(1);
        }}
        isLoading={isLoading}
        showActiveOnly={showActiveOnly}
        setShowActiveOnly={setShowActiveOnly}
      />
      <ToyEditModal
        isEditOpen={isEditOpen}
        setIsEditOpen={setIsEditOpen}
        editData={editData}
        setEditData={setEditData}
        setToys={setToys}
        onRefresh={handleRefresh}
      />
    </AdminLayout>
  );
}
