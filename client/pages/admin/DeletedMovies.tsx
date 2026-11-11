import React, { useEffect, useState } from 'react';
import AdminLayout from '@/admin/layouts/AdminLayout';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/admin/common/PageHeader';
import { ConfirmDialog } from '@/components/admin/common/ConfirmDialog';
import { RowActionButton, RowActions } from '@/components/admin/common/RowActionButton';
import { AdminPagination } from '@/components/admin/common/AdminPagination';
import { EmptyState, TableSkeleton } from '@/components/admin/common/EmptyState';
import { notify } from '@/components/admin/common/notify';
import { ADMIN_BTN_PRIMARY, ADMIN_BTN_OUTLINE, ADMIN_CARD, ADMIN_TABLE_HEAD, ADMIN_TH, ADMIN_INPUT } from '@/components/admin/common/adminTokens';
import { useNavigate } from 'react-router-dom';
import { formatVnDate, formatVnDateTime } from '@/lib/format';
import { useStaffStore } from '@/store/staffStore';
import { RefreshCw, Image as ImageIcon, ArrowLeft, Star } from 'lucide-react';
import { buildUrl } from '@/lib/api/http';
import { useHasStaffPermission } from '@/hooks/useStaffPermission';

interface Movie {
  id: number;
  title: string;
  genres: string[];
  duration_min?: number;
  rating?: number;
  release_date?: string;
  cover_image?: string;
  deleted_at: string;
  branch_id?: number;
  branch_name?: string;
  deleted_by_staff_name?: string;
}

export default function DeletedMoviesPage() {
  const navigate = useNavigate();
  const staffStore = useStaffStore();
  const hasPermission = useHasStaffPermission();
  const [activeTab, setActiveTab] = useState('deleted-movies');
  const [movies, setMovies] = useState<Movie[]>([]);
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [total, setTotal] = useState(0);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [localSearchQuery, setLocalSearchQuery] = useState('');

  const handleSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSearchQuery(localSearchQuery);
    setPage(1);
  };
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [movieToRestore, setMovieToRestore] = useState<number | null>(null);
  const [sortField, setSortField] = useState<'title' | 'deleted_at'>('deleted_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const fetchDeletedMovies = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('staffToken');
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        search: searchQuery,
        // Sorting is done by the server so it covers every page, not just the 10 rows on screen
        sort: sortField === 'deleted_at' ? 'deleted_at' : 'name',
        dir: sortDir
      });
      const response = await fetch(buildUrl(`/api/admin/deleted/movies?${params}`), {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error('request failed');
      const data = await response.json();
      const sortedItems = data.items || [];
      setMovies(sortedItems);
      setTotal(data.total || 0);
    } catch (error) {
      notify.error('Không thể tải danh sách phim đã xóa');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDeletedMovies();
  }, [page, searchQuery, sortField, sortDir]);

  const handleRestore = (id: number) => {
    setMovieToRestore(id);
    setRestoreDialogOpen(true);
  };

  const handleConfirmRestore = async () => {
    if (!movieToRestore) return;
    setIsRestoring(true);
    try {
      const token = localStorage.getItem('staffToken');
      const response = await fetch(buildUrl(`/api/admin/movies/${movieToRestore}/restore`), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (response.ok) {
        notify.restored('phim');
        setRestoreDialogOpen(false);
        fetchDeletedMovies();
      } else {
        notify.error(data.message || 'Không thể khôi phục phim');
      }
    } catch (error) {
      notify.error(error);
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <AdminLayout
      active={activeTab as any}
      setActive={setActiveTab as any}
      adminEmailState={staffStore.staff?.email || 'admin@email.com'}
      handleLogout={() => {
        staffStore.clearStaff();
        localStorage.removeItem('staffToken');
        navigate('/login');
      }}
    >
      <div className="space-y-6">
        <PageHeader
          title="Phim đã xóa"
          leading={
            <Button variant="ghost" size="icon" onClick={() => navigate('/movies')} className="rounded-full" title="Quay lại">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          }
          actions={
            <Button onClick={fetchDeletedMovies} variant="outline" className={ADMIN_BTN_OUTLINE}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Làm mới
            </Button>
          }
        />

        <form onSubmit={handleSearch} className="mb-4 flex max-w-md gap-2">
          <Input
            placeholder="Tìm kiếm theo tên phim..."
            value={localSearchQuery}
            onChange={(e) => setLocalSearchQuery(e.target.value)}
            className={`flex-1 ${ADMIN_INPUT}`}
          />
          <Button type="submit" className={ADMIN_BTN_PRIMARY}>
            Tìm kiếm
          </Button>
        </form>

        <div className={`${ADMIN_CARD} overflow-hidden`}>
          {isLoading ? (
            <TableSkeleton />
          ) : (
            <Table>
              <TableHeader className={ADMIN_TABLE_HEAD}>
                <TableRow>
                  <TableHead className={ADMIN_TH}>Poster</TableHead>
                  <TableHead
                    className={`cursor-pointer hover:bg-slate-100 ${ADMIN_TH}`}
                    onClick={() => {
                      setSortField('title');
                      setSortDir(sortField === 'title' && sortDir === 'asc' ? 'desc' : 'asc');
                    }}
                  >
                    Tên phim {sortField === 'title' && (sortDir === 'asc' ? '↑' : '↓')}
                  </TableHead>
                  <TableHead className={ADMIN_TH}>Thể loại</TableHead>
                  <TableHead className={ADMIN_TH}>Thời lượng</TableHead>
                  <TableHead className={ADMIN_TH}>Đánh giá</TableHead>
                  <TableHead className={ADMIN_TH}>Ngày phát hành</TableHead>
                  <TableHead className={ADMIN_TH}>Xóa bởi</TableHead>
                  <TableHead
                    className={`cursor-pointer hover:bg-slate-100 ${ADMIN_TH}`}
                    onClick={() => {
                      setSortField('deleted_at');
                      setSortDir(sortField === 'deleted_at' && sortDir === 'asc' ? 'desc' : 'asc');
                    }}
                  >
                    Ngày xóa {sortField === 'deleted_at' && (sortDir === 'asc' ? '↑' : '↓')}
                  </TableHead>
                  <TableHead className={`text-right ${ADMIN_TH}`}>Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movies.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>
                      {m.cover_image ? (
                        <img src={m.cover_image} alt={m.title} className="w-12 h-16 object-cover rounded" />
                      ) : (
                        <div className="w-12 h-16 bg-gray-200 rounded flex items-center justify-center">
                          <ImageIcon className="w-6 h-6 text-gray-400" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-medium max-w-[280px] truncate" title={m.title}>
                      {m.title}
                    </TableCell>
                    <TableCell>
                      {m.genres && m.genres.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {m.genres.slice(0, 2).map((g, i) => (
                            <Badge key={i} variant="secondary" className="text-xs">
                              {g}
                            </Badge>
                          ))}
                          {m.genres.length > 2 && (
                            <Badge variant="secondary" className="text-xs">
                              +{m.genres.length - 2}
                            </Badge>
                          )}
                        </div>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell>{m.duration_min ? `${m.duration_min} phút` : '-'}</TableCell>
                    <TableCell>{m.rating !== null && m.rating !== undefined ? <Badge variant="outline" className="gap-1"><Star className="h-3 w-3 fill-amber-400 text-amber-500" />{m.rating}</Badge> : '-'}</TableCell>
                    <TableCell>{formatVnDate(m.release_date)}</TableCell>
                    <TableCell className="text-gray-600">{m.deleted_by_staff_name || '-'}</TableCell>
                    <TableCell>{formatVnDateTime(m.deleted_at)}</TableCell>
                    <TableCell className="text-right">
                      {hasPermission('movies', 'restore') && (
                        <RowActions>
                          <RowActionButton action="restore" onClick={() => handleRestore(m.id)} />
                        </RowActions>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {movies.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="p-0">
                      <EmptyState title={searchQuery ? 'Không tìm thấy phim đã xóa' : 'Chưa có phim nào bị xóa'} />
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </div>

        <AdminPagination page={page} totalPages={totalPages} onPageChange={setPage} totalLabel={`${total} phim`} />
      </div>

      <ConfirmDialog
        open={restoreDialogOpen}
        onOpenChange={setRestoreDialogOpen}
        variant="restore"
        title="Khôi phục phim"
        description="Bạn có chắc chắn muốn khôi phục phim này?"
        busy={isRestoring}
        onConfirm={handleConfirmRestore}
      />
    </AdminLayout>
  );
}
