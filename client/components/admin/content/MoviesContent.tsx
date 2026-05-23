import React, { useMemo, useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Table as AntTable } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
  MoreHorizontal,
  Eye,
  Edit3,
  Clock,
  Star,
  Search,
  FilterX,
  RefreshCw,
  Plus,
  History,
  Trash2,
  FileText,
  Image,
  ShieldAlert,
  Globe,
  Calendar,
  X,
  MessageSquare,
  Ticket,
  AlertCircle,
  SortDesc,
  SortAsc
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';
import { getMovieById } from '@/lib/api';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from '@/components/ui/alert-dialog';
import { optimizeCloudinaryUrl } from '@/lib/utils';
import { useAdminPermissions } from '@/lib/useAdminPermissions';

interface MovieData {
  id: string | number;
  title: string;
  duration: string;
  genres: string[];
  posterUrl: string;
  release_date: string | null;
  rating: number | null;
  updated_at: string;
  cover_image?: string;
}

interface Props {
  data: MovieData[];
  totalPages: number;
  currentPage: number;
  setPage: (p: number) => void;
  pageSize?: number;
  movieStatus: Record<string, string>; // Changed from "active" | "inactive" to string
  onToggleStatus: (id: string | number, currentStatus: boolean) => void;
  onEdit: (type: 'movie', data: any) => void;
  onCreate: () => void;
  moviesLength: number;
  onRefresh: () => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  sortKey?: string;
  sortDir?: 'asc' | 'desc';
  setSortKey?: (k: any) => void;
  setSortDir?: (d: 'asc' | 'desc') => void;
  isLoading?: boolean;
  showActiveOnly?: boolean;
  setShowActiveOnly?: (v: boolean) => void;
  isDetailsOpen: boolean;
  setIsDetailsOpen: (v: boolean) => void;
  selectedMovieId: number | null;
  setSelectedMovieId: (id: number | null) => void;
}

export default function MoviesContent({
  data,
  totalPages,
  currentPage,
  setPage,
  pageSize,
  movieStatus,
  onToggleStatus,
  onEdit,
  onCreate,
  moviesLength,
  onRefresh,
  searchQuery = '',
  onSearchChange = () => {},
  sortKey = 'updated_at',
  setSortKey = () => {},
  sortDir = 'desc',
  setSortDir = () => {},
  isLoading = false,
  showActiveOnly = false,
  setShowActiveOnly = () => {},
  isDetailsOpen,
  setIsDetailsOpen,
  selectedMovieId,
  setSelectedMovieId
}: Props) {
  console.log(data);
  const { isViewer, isSuperAdmin, hasPermission } = useAdminPermissions();
  const [movieDetails, setMovieDetails] = useState<any>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  const resolvedPageSize = useMemo(() => {
    if (pageSize && Number.isFinite(pageSize)) return pageSize;
    return 10;
  }, [pageSize]);

  const totalForPagination = useMemo(() => Math.max(0, totalPages) * resolvedPageSize, [resolvedPageSize, totalPages]);

  const InfoRow = ({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) => (
    <div className="flex justify-between items-center">
      <span className="text-[11px] font-medium text-slate-500 flex items-center gap-1.5">
        {icon} {label}
      </span>
      <span className="text-[11px] font-bold text-slate-800">{value}</span>
    </div>
  );

  useEffect(() => {
    if (isDetailsOpen && selectedMovieId) {
      (async () => {
        try {
          setIsLoadingDetails(true);
          const details = await getMovieById(selectedMovieId);
          setMovieDetails(details);
          console.log(movieDetails);
        } catch (err) {
          console.error('Lỗi load chi tiết:', err);
        } finally {
          setIsLoadingDetails(false);
        }
      })();
    } else {
      setMovieDetails(null);
    }
  }, [isDetailsOpen, selectedMovieId]);

  const columns: ColumnsType<MovieData> = useMemo(
    () => [
      {
        title: 'ID',
        dataIndex: 'id',
        key: 'id',
        width: 80,
        align: 'center',
        render: (v) => <span className="text-center font-mono text-[11px] text-slate-400">{v}</span>
      },
      {
        title: 'Phim & Thể loại',
        key: 'title',
        width: 380,
        ellipsis: true,
        render: (_: any, movie: MovieData) => (
          <div className="flex items-center gap-4 py-2">
            <div className="relative shrink-0 transition-transform group-hover:scale-105">
              <img
                src={optimizeCloudinaryUrl(movie.posterUrl, 200) || 'https://placehold.co/400x600?text=No+Poster'}
                loading="lazy"
                className="w-12 h-16 object-cover rounded-lg shadow-sm border border-slate-100"
                alt=""
              />
              <div className="absolute -bottom-1 -right-1 bg-white shadow-sm border text-[8px] text-slate-600 px-1 rounded flex items-center gap-0.5 font-bold">
                <Clock size={8} /> {movie.duration}′
              </div>
            </div>
            <div className="flex flex-col gap-0.5 min-w-0">
              <h4 className="font-bold text-slate-900 leading-tight line-clamp-1">{movie.title}</h4>
              <p className="text-[11px] text-slate-500 line-clamp-1">{(movie.genres || []).join(' • ')}</p>
            </div>
          </div>
        )
      },
      {
        title: 'Đánh giá',
        dataIndex: 'rating',
        key: 'rating',
        align: 'center',
        width: 120,
        render: (v) => (
          <div className="inline-flex items-center gap-1 bg-yellow-50 px-2 py-0.5 rounded-md border border-yellow-100">
            <Star size={10} className="fill-yellow-500 text-yellow-500" />
            <span className="text-xs font-black text-yellow-700">{v || '0'}</span>
          </div>
        )
      },
      {
        title: 'Cập nhật',
        dataIndex: 'updated_at',
        key: 'updated_at',
        width: 190,
        render: (v) => (
          <div className="flex flex-col text-[11px]">
            <span className="text-slate-600 font-medium flex items-center gap-1">
              <History size={10} className="text-slate-400" />
              {v ? format(new Date(v), 'HH:mm') : '-'}
            </span>
            <span className="text-slate-400 italic cursor-help" title={v ? new Date(v).toLocaleString('vi-VN') : ''}>
              {v ? formatDistanceToNow(new Date(v), { addSuffix: true, locale: vi }) : ''}
            </span>
          </div>
        )
      },
      {
        title: 'Trạng thái',
        key: 'status',
        align: 'center',
        width: 220,
        render: (_: any, movie: MovieData) => {
          const isActive = movieStatus[movie.id] === 'active';
          const canToggle = !isViewer && (isSuperAdmin || hasPermission('movies.publish'));
          return (
            <div className="flex items-center justify-center gap-4 py-2">
              <div className="flex shrink-0 w-12 justify-center">
                {canToggle ? (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Switch
                        checked={isActive}
                        className="scale-100 transition-all border-2 border-transparent cursor-pointer"
                        style={{
                          opacity: 1,
                          backgroundColor: isActive ? '#10b981' : '#64748b',
                          boxShadow: 'none'
                        }}
                      />
                    </AlertDialogTrigger>

                    <AlertDialogContent className="rounded-2xl font-sans bg-white">
                      <AlertDialogHeader>
                        <AlertDialogTitle className="text-slate-900">Xác nhận thay đổi trạng thái</AlertDialogTitle>
                        <AlertDialogDescription className="text-slate-500 text-sm">
                          {isActive ? (
                            <span>
                              Bạn có muốn <strong>ẩn</strong> phim này không?
                              <br />
                              Hành động này sẽ khiến phim không xuất hiện trên giao diện người dùng.
                            </span>
                          ) : (
                            <span>
                              Bạn có muốn <strong>kích hoạt</strong> phim này không?
                              <br />
                              Phim sẽ bắt đầu hiển thị công khai trên website.
                            </span>
                          )}
                        </AlertDialogDescription>
                      </AlertDialogHeader>

                      <AlertDialogFooter className="mt-4">
                        <AlertDialogCancel className="rounded-xl border-slate-200">Hủy</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => onToggleStatus(movie.id, isActive)}
                          className={`rounded-xl text-white ${
                            isActive ? 'bg-red-500 hover:bg-red-600' : 'bg-emerald-600 hover:bg-emerald-700'
                          }`}
                        >
                          {isActive ? 'Đồng ý ẩn' : 'Đồng ý kích hoạt'}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                ) : (
                  <Switch
                    checked={isActive}
                    disabled
                    className="scale-100 transition-all border-2 border-transparent cursor-not-allowed opacity-60"
                    style={{
                      backgroundColor: isActive ? '#10b981' : '#64748b',
                      boxShadow: 'none'
                    }}
                  />
                )}
              </div>

              <div className="w-20 flex shrink-0">
                <Badge
                  className={`text-[9px] font-bold px-2 py-1 rounded-lg border-none whitespace-nowrap shadow-sm justify-center w-full transition-all duration-200
                  ${
                    isActive
                      ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200/80'
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}
                >
                  {isActive ? 'ĐANG CHIẾU' : 'ĐÃ ẨN'}
                </Badge>
              </div>
            </div>
          );
        }
      },
      {
        title: 'Thao tác',
        key: 'actions',
        align: 'right',
        width: 110,
        render: (_: any, movie: MovieData) => {
          const canEdit = !isViewer && (isSuperAdmin || hasPermission('movies.edit'));
          return (
            <div className="flex justify-end pr-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-8 w-8 p-0 rounded-full hover:bg-slate-100">
                    <MoreHorizontal className="h-4 w-4 text-slate-400" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 rounded-xl shadow-2xl border-slate-100">
                  <DropdownMenuItem
                    onClick={() => {
                      setSelectedMovieId(Number(movie.id));
                      setIsDetailsOpen(true);
                    }}
                    className="cursor-pointer"
                  >
                    <Eye className="mr-2 h-4 w-4 text-blue-500" /> Xem chi tiết
                  </DropdownMenuItem>
                  {canEdit && (
                    <DropdownMenuItem onClick={() => onEdit('movie', movie)} className="cursor-pointer">
                      <Edit3 className="mr-2 h-4 w-4 text-orange-500" /> Chỉnh sửa
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        }
      }
    ],
    [movieStatus, onEdit, onToggleStatus, setIsDetailsOpen, setSelectedMovieId, isViewer, isSuperAdmin, hasPermission]
  );

  return (
    <div className="space-y-6 font-sans">
      {/* TOOLBAR */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-white p-4 rounded-2xl border shadow-sm">
        <div className="flex flex-1 w-full gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Tìm tên phim..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-blue-500 rounded-xl transition-all outline-none text-sm"
            />
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={onRefresh}
            className="rounded-xl shadow-sm hover:rotate-180 transition-transform duration-500"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto font-sans">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-[10px] font-bold text-slate-500 uppercase">Chỉ hiện đang chiếu</span>
            <Switch
              checked={showActiveOnly}
              onCheckedChange={setShowActiveOnly}
              className="scale-75 data-[state=checked]:bg-emerald-500 data-[state=unchecked]:bg-slate-300 cursor-pointer"
            />
          </div>

          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as any)}
            className="bg-white border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none shadow-sm cursor-pointer"
          >
            <option value="updated_at">Mới cập nhật</option>
            <option value="rating">Đánh giá cao</option>
            <option value="release_date">Ngày phát hành</option>
          </select>
          {/* BỔ SUNG NÚT ĐẢO CHIỀU TẠI ĐÂY */}
          <Button
            variant="outline"
            size="icon"
            onClick={() => setSortDir?.(sortDir === 'asc' ? 'desc' : 'asc')}
            className="rounded-xl border-slate-200 hover:bg-slate-50 active:scale-95 transition-all shadow-sm"
            title={sortDir === 'asc' ? 'Tăng dần' : 'Giảm dần'}
          >
            {sortDir === 'desc' ? (
              <SortDesc className="w-4 h-4 text-slate-600" />
            ) : (
              <SortAsc className="w-4 h-4 text-slate-600" />
            )}
          </Button>
          {/* KẾT THÚC BỔ SUNG */}

          {!isViewer && (isSuperAdmin || hasPermission('movies.create')) && (
            <Button
              onClick={onCreate}
              className="bg-blue-600 hover:bg-blue-700 rounded-xl shadow-lg shadow-blue-200 gap-2 ml-auto text-white"
            >
              <Plus className="w-4 h-4" /> Thêm phim
            </Button>
          )}
        </div>
      </div>

      {/* TABLE */}
      <Card className="border-none shadow-xl shadow-slate-200/50 rounded-2xl overflow-hidden bg-white w-full min-w-0">
        <CardContent className="p-0 font-sans">
          <AntTable
            rowKey="id"
            columns={columns}
            dataSource={data}
            loading={isLoading}
            tableLayout="fixed"
            scroll={{ x: 1120 }}
            pagination={{
              current: currentPage,
              pageSize: resolvedPageSize,
              total: totalForPagination,
              showSizeChanger: false,
              onChange: (p) => setPage(p)
            }}
            locale={{
              emptyText: (
                <div className="py-12 text-center text-slate-400">
                  <div className="flex flex-col items-center justify-center text-slate-400 gap-2">
                    <FilterX size={48} className="opacity-20 mb-2" />
                    <p className="text-sm font-medium text-slate-500">Không tìm thấy bộ phim nào phù hợp</p>
                    <Button variant="link" onClick={onRefresh} className="text-blue-500 text-xs">
                      Xóa bộ lọc & Thử lại
                    </Button>
                  </div>
                </div>
              )
            }}
            className="[&_.ant-table]:rounded-none [&_.ant-table-thead>tr>th]:bg-slate-50/80"
          />
        </CardContent>
      </Card>

      {/* MODAL CHI TIẾT */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-w-5xl rounded-xl p-0 overflow-hidden border-none shadow-2xl bg-[#f8fafc] font-sans [&>button]:hidden">
          {isLoadingDetails ? (
            <div className="py-20 flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Đang tải dữ liệu...</p>
            </div>
          ) : movieDetails ? (
            <div className="flex flex-col">
              {/* HEADER: Dark & Professional */}
              <div className="bg-[#0f172a] px-6 py-4 flex items-center justify-between border-b border-slate-800">
                <div className="flex items-center gap-4">
                  <div className="bg-slate-800 p-1 rounded border border-slate-700 shadow-inner">
                    <img
                      src={optimizeCloudinaryUrl(movieDetails.cover_image, 400)}
                      className="w-10 h-14 object-cover rounded"
                      alt=""
                    />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-[10px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded border border-blue-500/30">
                        ID: {movieDetails.id}
                      </span>
                      <h2 className="text-base font-bold text-white tracking-tight leading-none uppercase">
                        {movieDetails.title}
                      </h2>
                      {!isViewer && (isSuperAdmin || hasPermission('movies.edit')) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            onEdit('movie', {
                              id: movieDetails.id,
                              title: movieDetails.title,
                              description: movieDetails.description,
                              genres: movieDetails.genres,
                              rating: movieDetails.rating,
                              duration: movieDetails.duration_min,
                              posterUrl: movieDetails.cover_image,
                              is_active: movieDetails.is_active,
                              release_date: movieDetails.release_date
                            })
                          }
                          className="h-7 w-7 text-slate-400 hover:text-orange-400 hover:bg-orange-500/10 rounded-full transition-colors ml-1"
                          title="Chỉnh sửa phim"
                        >
                          <Edit3 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    {/* THỂ LOẠI: Hiển thị rõ ràng dạng Tag */}
                    <div className="flex flex-wrap gap-1.5 mt-2.5">
                      {Array.isArray(movieDetails.genres) ? (
                        movieDetails.genres.map((genre: string) => (
                          <span
                            key={genre}
                            className="text-[9px] font-bold px-2 py-0.5 bg-slate-800 text-slate-400 rounded border border-slate-700 uppercase tracking-wider"
                          >
                            {genre}
                          </span>
                        ))
                      ) : (
                        <span className="text-[9px] text-slate-500 italic">Chưa có thể loại</span>
                      )}
                    </div>
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsDetailsOpen(false)}
                  className="h-8 w-8 text-slate-400 hover:text-white hover:bg-white/10 rounded-full transition-colors mr-2"
                >
                  <X size={20} />
                </Button>
              </div>

              {/* BODY SECTION */}
              <div className="p-6 space-y-6">
                {/* ROW 1: Quick Stats & Metadata */}
                <div className="grid grid-cols-12 gap-6">
                  {/* LEFT: Stats & Ticket */}
                  <div className="col-span-8 space-y-6">
                    {/* Dashboard Stats */}
                    <div className="grid grid-cols-4 gap-4">
                      {[
                        {
                          label: 'Đánh giá',
                          val: `${movieDetails.rating}/10`,
                          icon: <Star size={12} />,
                          color: 'text-blue-600'
                        },
                        {
                          label: 'Trạng thái',
                          val: movieDetails.is_active === true ? 'Đang chiếu' : 'Đã ẩn',
                          color: movieDetails.is_active === true ? 'text-emerald-600' : 'text-slate-400'
                        }
                      ].map((stat, i) => (
                        <div key={i} className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="text-slate-400">{stat.icon}</span>
                            <p className="text-[9px] text-slate-400 uppercase font-black">{stat.label}</p>
                          </div>
                          <p className={`text-lg font-bold ${stat.color || 'text-slate-700'}`}>{stat.val}</p>
                        </div>
                      ))}
                    </div>

                    {/* CẤU HÌNH VÉ (TICKET CONFIG) */}
                    <section className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                      <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
                        <h3 className="text-[11px] font-bold text-slate-600 uppercase flex items-center gap-2 tracking-tight">
                          <Ticket size={14} className="text-indigo-500" /> Phân loại gói vé áp dụng
                        </h3>
                        <Button variant="ghost" size="sm" className="h-6 text-[10px] text-blue-600 hover:bg-blue-50">
                          Cấu hình
                        </Button>
                      </div>
                      <div className="p-4 flex flex-wrap gap-3">
                        {Array.isArray(movieDetails.applicable_packages) &&
                        movieDetails.applicable_packages.length > 0 ? (
                          movieDetails.applicable_packages.map((pkg: any, index: number) => {
                            const isVip =
                              pkg.code?.toLowerCase().includes('vip') || pkg.name?.toLowerCase().includes('vip');
                            return (
                              <div
                                key={pkg.id || index}
                                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border ${
                                  isVip ? 'bg-indigo-50 border-indigo-100' : 'bg-emerald-50 border-emerald-100'
                                }`}
                              >
                                <div
                                  className={`w-2 h-2 rounded-full ${
                                    isVip ? 'bg-indigo-500 animate-pulse' : 'bg-emerald-500'
                                  }`}
                                />
                                <span
                                  className={`text-xs font-semibold ${isVip ? 'text-indigo-700' : 'text-emerald-700'}`}
                                >
                                  {pkg.name} ({Number(pkg.price || 0).toLocaleString()}
                                  đ)
                                </span>
                              </div>
                            );
                          })
                        ) : (
                          <div className="text-xs text-slate-400 italic py-2">
                            Chưa có gói vé nào được áp dụng cho phim này
                          </div>
                        )}
                        <button className="px-4 py-2 border border-dashed border-slate-300 rounded-lg text-slate-400 text-xs hover:bg-slate-50 hover:border-slate-400 transition-all">
                          + Gán gói mới
                        </button>
                      </div>
                    </section>
                  </div>

                  {/* RIGHT: Metadata */}
                  <div className="col-span-4">
                    <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm space-y-4 h-full">
                      <h3 className="text-[11px] font-bold text-slate-400 uppercase border-b pb-3 tracking-widest">
                        Metadata
                      </h3>
                      <div className="space-y-3.5">
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-400">Thời lượng:</span>
                          <span className="font-bold text-slate-700">{movieDetails.duration_min} phút</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-400">Ngày phát hành:</span>
                          <span className="font-bold text-slate-700 px-1.5 py-0.5 bg-slate-100 rounded text-[10px]">
                            {movieDetails.release_date
                              ? format(new Date(movieDetails.release_date), 'dd/MM/yyyy HH:mm')
                              : '-'}
                          </span>
                        </div>
                      </div>

                      <div className="pt-4 border-t border-slate-100 space-y-3">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-400 flex items-center gap-1.5">
                            <Calendar size={12} /> Ngày tạo:
                          </span>
                          <span className="font-mono text-slate-600">
                            {movieDetails.created_at
                              ? format(new Date(movieDetails.created_at), 'dd/MM/yyyy HH:mm')
                              : '-'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-400 flex items-center gap-1.5">
                            <History size={12} /> Cập nhật:
                          </span>
                          <span className="font-mono text-slate-600">
                            {movieDetails.updated_at
                              ? format(new Date(movieDetails.updated_at), 'dd/MM/yyyy HH:mm')
                              : '-'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ROW 2: Description & Admin Notes */}
                <div className="grid grid-cols-12 gap-6 items-stretch">
                  <div className="col-span-8">
                    <section className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm h-full">
                      <div className="bg-slate-50 px-4 py-2 border-b border-slate-200">
                        <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                          <FileText size={14} className="text-blue-500" /> Mô tả hệ thống
                        </h3>
                      </div>
                      <div className="p-5 text-[13px] text-slate-600 leading-relaxed min-h-[140px]">
                        {movieDetails.description || 'Chưa có mô tả nội dung cho phim này.'}
                      </div>
                    </section>
                  </div>

                  <div className="col-span-4 self-start">
                    {/* GHI CHÚ QUẢN TRỊ - Màu Amber trung tính */}
                    <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 shadow-sm">
                      <div className="flex items-center gap-2 mb-3 text-amber-700 font-bold uppercase text-[10px]">
                        <AlertCircle size={14} /> Ghi chú quản trị
                      </div>
                      <p className="text-[11px] text-amber-800 leading-snug">
                        Phim đang được đặt ở trạng thái <strong>Ưu tiên Slider</strong>. Hệ thống sẽ tự động cập nhật
                        Cache sau 5 phút.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
