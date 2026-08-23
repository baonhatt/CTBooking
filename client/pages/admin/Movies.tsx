import React, { useEffect, useMemo, useState } from 'react';
<<<<<<< HEAD
import { getMoviesAdmin, updateMovieStatus } from '@/lib/api';
import AdminLayout from '@/admin/layouts/AdminLayout';
import MoviesContent from '@/components/admin/content/MoviesContent';
import AdminEditModal from '@/components/admin/AdminEditModal';
import { toast } from 'sonner';

export default function MoviesPage() {
=======
import { getMoviesAdmin, updateMovieStatus, getAdminBranchOptions, deleteMovieApi } from '@/lib/api';
import AdminLayout from '@/admin/layouts/AdminLayout';
import MoviesContent from '@/components/admin/content/MoviesContent';
import { useStaffPermission } from '@/hooks/useStaffPermission';
import AdminEditModal from '@/components/admin/AdminEditModal';
import { toast } from 'sonner';
import { useStaffStore } from '@/store/staffStore';
import { useNavigate } from 'react-router-dom';
import {
        AlertDialog,
        AlertDialogAction,
        AlertDialogCancel,
        AlertDialogContent,
        AlertDialogDescription,
        AlertDialogFooter,
        AlertDialogHeader,
        AlertDialogTitle
} from '@/components/ui/alert-dialog';

export default function MoviesPage() {
        const navigate = useNavigate();
        const staff = useStaffStore((state) => state.staff);
        const clearStaff = useStaffStore((state) => state.clearStaff);
        const [activeTab, setActiveTab] = useState('movies');

>>>>>>> preview
        const getInitialFilters = () => {
                try {
                        const raw = localStorage.getItem('admin_movies_filters');
                        if (raw) return JSON.parse(raw);
                } catch { }
                return {};
        };

        const initialFilters = getInitialFilters();

        const [moviesLocal, setMoviesLocal] = useState<any[]>([]);
        const [movieStatus, setMovieStatus] = useState<Record<string, 'active' | 'inactive'>>({});
        const [totalMovies, setTotalMovies] = useState(0);
        const [moviesPage, setMoviesPage] = useState(1);
        const [searchQuery, setSearchQuery] = useState<string>(initialFilters.searchQuery ?? '');
        const [sortKey, setSortKey] = useState<'updated_at' | 'release_date' | 'title' | 'rating'>(
                initialFilters.sortKey ?? 'updated_at'
        );
        const [sortDir, setSortDir] = useState<'asc' | 'desc'>(initialFilters.sortDir ?? 'desc');
<<<<<<< HEAD
=======
        const [selectedBranchId, setSelectedBranchId] = useState<number | 'all' | null>(() => {
                if (initialFilters.branchId !== undefined) return initialFilters.branchId;
                if (staff?.isSuperAdmin) return 'all';
                return null;
        });
        const canViewBranches = useStaffPermission('branches', 'view');
        const [branches, setBranches] = useState<any[]>([]);
>>>>>>> preview
        const pageSize = 10;
        const [isEditOpen, setIsEditOpen] = useState(false);
        const [editType, setEditType] = useState<'movie' | null>(null);
        const [editData, setEditData] = useState<any>({});
        const [isLoading, setIsLoading] = useState(false);
        const [showActiveOnly, setShowActiveOnly] = useState<boolean>(initialFilters.showActiveOnly ?? false);

        const [isDetailsOpen, setIsDetailsOpen] = useState(false);
        const [selectedMovieId, setSelectedMovieId] = useState<number | null>(null);
<<<<<<< HEAD
=======
        const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
        const [movieToDelete, setMovieToDelete] = useState<number | null>(null);

        // Load branches only when branch viewing is allowed
        useEffect(() => {
                if (!canViewBranches) {
                        setBranches([]);
                        return;
                }

                (async () => {
                        try {
                                const { items } = await getAdminBranchOptions({ includeInactive: true });
                                setBranches(items);

                                // If not superadmin and no branch selected, default to first branch
                                if (!staff?.isSuperAdmin && selectedBranchId === null && items.length > 0) {
                                        setSelectedBranchId(items[0].id);
                                }
                        } catch (error) {
                                console.error('Error loading branches:', error);
                        }
                })();
        }, [staff, canViewBranches, selectedBranchId]);
>>>>>>> preview

        useEffect(() => {
                (async () => {
                        setIsLoading(true);
                        const { items, total } = await getMoviesAdmin({
                                page: moviesPage,
                                pageSize,
                                q: searchQuery,
                                sort: sortKey,
                                dir: sortDir,
<<<<<<< HEAD
                                status: showActiveOnly ? 'active' : 'all'
=======
                                status: showActiveOnly ? 'active' : 'all',
                                branch_id: selectedBranchId
>>>>>>> preview
                        });
                        const mapped = items.map((m: any) => ({
                                id: String(m.id),
                                title: m.title,
                                year: new Date(m.release_date || Date.now()).getFullYear(),
                                duration: m?.duration_min ? `${Number(m.duration_min)}` : '',
                                genres: Array.isArray(m.genres) ? m.genres : [],
                                posterUrl: m.cover_image || '',
                                release_date: m.release_date ? new Date(m.release_date).toISOString() : null,
                                updated_at: m.updated_at ? new Date(m.updated_at).toISOString() : null,
                                rating: m.rating ?? null,
                                price: Number(m.price || 0),
<<<<<<< HEAD
                                is_active: m.is_active
=======
                                is_active: m.is_active,
                                branch_id: m.branch_id,
                                branch_ids: Array.isArray(m.branch_ids) ? m.branch_ids : m.branch_ids ?? null
>>>>>>> preview
                        }));
                        setMoviesLocal(mapped);
                        setTotalMovies(total);
                        setMovieStatus((prev) => ({
                                ...prev,
                                ...Object.fromEntries(items.map((m: any) => [String(m.id), m.is_active ? 'active' : 'inactive']))
                        }));
                        setIsLoading(false);
                })();
                try {
<<<<<<< HEAD
                        const state = { searchQuery, sortKey, sortDir, showActiveOnly };
                        localStorage.setItem('admin_movies_filters', JSON.stringify(state));
                } catch { }
        }, [moviesPage, pageSize, searchQuery, sortKey, sortDir, showActiveOnly]);
=======
                        const state = { searchQuery, sortKey, sortDir, showActiveOnly, branchId: selectedBranchId };
                        localStorage.setItem('admin_movies_filters', JSON.stringify(state));
                } catch { }
        }, [moviesPage, pageSize, searchQuery, sortKey, sortDir, showActiveOnly, selectedBranchId]);
>>>>>>> preview

        const moviesTotalPages = useMemo(() => Math.max(1, Math.ceil(totalMovies / pageSize)), [totalMovies]);
        const filteredMovies = useMemo(
                () => (showActiveOnly ? moviesLocal.filter((m) => (movieStatus[m.id] || 'active') === 'active') : moviesLocal),
                [showActiveOnly, moviesLocal, movieStatus]
        );
        const displayTotal = useMemo(
                () => (showActiveOnly ? filteredMovies.length : totalMovies),
                [showActiveOnly, filteredMovies, totalMovies]
        );

        function toLocalDateTimeString(date: Date) {
                const pad = (n: number) => n.toString().padStart(2, '0');
                const yyyy = date.getFullYear();
                const mm = pad(date.getMonth() + 1);
                const dd = pad(date.getDate());
                const hh = pad(date.getHours());
                const min = pad(date.getMinutes());
                return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
        }
        function formatLocalDateTime(date: Date) {
                const pad = (n: number) => n.toString().padStart(2, '0');
                const year = date.getFullYear();
                const month = pad(date.getMonth() + 1);
                const day = pad(date.getDate());
                const hours = pad(date.getHours());
                const minutes = pad(date.getMinutes());
                return (
                        <>
                                {year}-{month}-{day}{' '}
                                <strong style={{ color: 'red' }}>
                                        {' '}
                                        / {hours}:{minutes}
                                </strong>
                        </>
                );
        }

        const handleOpenEdit = (_type: 'movie', data: any) => {
                setEditType('movie');
                setEditData(data);
                setIsDetailsOpen(false); // Đóng modal chi tiết nếu đang mở
                setIsEditOpen(true);
        };
        const handleOpenCreate = () => {
                setEditType('movie');
                setEditData({
                        id: '',
                        title: '',
                        genres: [],
                        duration: '',
                        posterUrl: '',
                        status: 'active',
                        price: 0
                });
                setIsEditOpen(true);
        };

        const handleViewDetails = (id: number) => {
                setSelectedMovieId(id);
                setIsEditOpen(false);
                setIsDetailsOpen(true);
        };

        const handleRefresh = async () => {
                setIsLoading(true);
                const { items, total } = await getMoviesAdmin({
                        page: moviesPage,
                        pageSize,
                        q: searchQuery,
                        sort: sortKey,
                        dir: sortDir,
<<<<<<< HEAD
                        status: showActiveOnly ? 'active' : 'all'
=======
                        status: showActiveOnly ? 'active' : 'all',
                        branch_id: selectedBranchId
>>>>>>> preview
                });
                const mapped = items.map((m: any) => ({
                        id: String(m.id),
                        title: m.title,
                        year: new Date(m.release_date || Date.now()).getFullYear(),
                        duration: m?.duration_min ? `${Number(m.duration_min)}` : '',
                        genres: Array.isArray(m.genres) ? m.genres : [],
                        posterUrl: m.cover_image || '',
                        release_date: m.release_date ? new Date(m.release_date).toISOString() : null,
                        rating: m.rating ?? null,
                        price: Number(m.price || 0),
                        is_active: m.is_active,
<<<<<<< HEAD
=======
                        branch_id: m.branch_id,
                        branch_ids: Array.isArray(m.branch_ids) ? m.branch_ids : m.branch_ids ?? null,
>>>>>>> preview
                        updated_at: m.updated_at ? new Date(m.updated_at).toISOString() : null
                }));
                setMoviesLocal(mapped);
                setTotalMovies(total);
                setMovieStatus((prev) => ({
                        ...prev,
                        ...Object.fromEntries(items.map((m: any) => [String(m.id), m.is_active ? 'active' : 'inactive']))
                }));
                setIsLoading(false);
        };
        // Thêm hàm này vào file cha (MoviesPage.tsx)
        // In client/pages/admin/Movies.tsx

        const handleToggleStatus = async (id: string | number, currentStatus: boolean) => {
                try {
                        const newStatus = !currentStatus;
                        const response = await updateMovieStatus(Number(id), newStatus);
                        setMovieStatus((prev) => ({
                                ...prev,
                                [String(id)]: newStatus ? 'active' : 'inactive'
                        }));

                        toast.success(response.status == 'success' ? 'Thành công' : 'Thất bại', {
                                description: response.message
                        });
                } catch (e: any) {
                        toast.error('Lỗi', {
                                description: e?.message || 'Có lỗi xảy ra'
                        });
                } finally {
                }
        };
<<<<<<< HEAD
        return (
                <AdminLayout
                        active={'movies' as any}
                        setActive={(() => { }) as any}
                        adminEmailState={localStorage.getItem('adminEmail') || 'admin@email.com'}
                        handleLogout={() => {
                                localStorage.removeItem('adminToken');
                                localStorage.removeItem('adminEmail');
                                window.dispatchEvent(new Event('admin-auth-changed'));
                                window.location.href = '/';
                        }}
=======
        const handleDelete = (id: number) => {
                setMovieToDelete(id);
                setDeleteDialogOpen(true);
        };
        const handleConfirmDelete = async () => {
                if (!movieToDelete) return;
                try {
                        await deleteMovieApi(movieToDelete);
                        toast.success('Thành công', {
                                description: 'Phim đã được xóa'
                        });
                        setDeleteDialogOpen(false);
                        handleRefresh();
                } catch (e: any) {
                        toast.error('Lỗi', {
                                description: e?.message || 'Có lỗi xảy ra'
                        });
                }
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
>>>>>>> preview
                >
                        <MoviesContent
                                data={filteredMovies}
                                totalPages={moviesTotalPages}
                                currentPage={moviesPage}
                                setPage={setMoviesPage}
                                movieStatus={movieStatus}
                                onToggleStatus={handleToggleStatus}
                                onEdit={handleOpenEdit}
                                onCreate={handleOpenCreate}
                                moviesLength={displayTotal}
                                onRefresh={handleRefresh}
                                searchQuery={searchQuery}
                                onSearchChange={(query) => {
                                        setSearchQuery(query);
                                        setMoviesPage(1);
                                }}
                                sortKey={sortKey}
                                sortDir={sortDir}
                                setSortKey={setSortKey}
                                setSortDir={setSortDir}
                                isLoading={isLoading}
                                showActiveOnly={showActiveOnly}
                                setShowActiveOnly={setShowActiveOnly}
                                isDetailsOpen={isDetailsOpen}
                                setIsDetailsOpen={setIsDetailsOpen}
                                selectedMovieId={selectedMovieId}
                                setSelectedMovieId={setSelectedMovieId}
<<<<<<< HEAD
=======
                                branches={branches}
                                selectedBranchId={selectedBranchId}
                                setSelectedBranchId={setSelectedBranchId}
                                onDelete={handleDelete}
>>>>>>> preview
                        />
                        <AdminEditModal
                                isEditOpen={isEditOpen}
                                setIsEditOpen={setIsEditOpen}
                                editType={editType as any}
                                editData={editData}
                                setEditData={setEditData}
                                setUsers={() => { }}
                                moviesLocal={moviesLocal}
                                toLocalDateTimeString={toLocalDateTimeString}
                                pageSize={pageSize}
                                currentPage={moviesPage}
                                setMoviesLocal={setMoviesLocal}
                                setMovieStatus={setMovieStatus}
                                setToys={() => { }}
                                onViewDetails={handleViewDetails}
                                onRefresh={handleRefresh}
<<<<<<< HEAD
                        />
=======
                                branches={branches}
                        />
                        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                                <AlertDialogContent>
                                        <AlertDialogHeader>
                                                <AlertDialogTitle>Xác nhận xóa phim</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                        Bạn có chắc chắn muốn xóa phim này? Hành động này không thể hoàn tác.
                                                </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                                <AlertDialogCancel>Hủy</AlertDialogCancel>
                                                <AlertDialogAction onClick={handleConfirmDelete}>Xóa</AlertDialogAction>
                                        </AlertDialogFooter>
                                </AlertDialogContent>
                        </AlertDialog>
>>>>>>> preview
                </AdminLayout>
        );
}
