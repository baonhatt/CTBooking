import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, RefreshCw, Edit3, Plus, FileText, Eye, Trash2, RotateCcw } from 'lucide-react';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious
} from '@/components/ui/pagination';
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
import { BranchIdsBadge } from '@/components/admin/BranchIdsBadge';
import { getPosts, updatePostApi, deletePostApi, getAdminBranchOptions } from '@/lib/api';
import { formatVnDate, formatVnDateTime } from '@/lib/format';
import { toast } from 'sonner';
import { useStaffPermissions, useIsSuperAdmin } from '@/hooks/useStaffPermission';

// Creating, editing and viewing a post all happen on the pages PostCreate and PostEdit; this screen is the list only.

interface PostData {
  id: number;
  title: string;
  slug?: string;
  content: string;
  excerpt?: string;
  featured_image?: string;
  status: string;
  is_featured?: boolean;
  view_count?: number;
  published_at?: string;
  created_at: string;
  updated_at: string;
  // null = all branches
  branch_ids?: number[] | null;
  created_by_staff_name?: string | null;
  updated_by_staff_name?: string | null;
}

export const PostManagement = () => {
  const navigate = useNavigate();
  const isSuperAdmin = useIsSuperAdmin();
  const permissions = useStaffPermissions();

  const hasPermission = (module: string, action: string) => {
    if (isSuperAdmin) return true;
    return permissions.some((p) => p.module === module && p.action === action);
  };
  const [posts, setPosts] = useState<PostData[]>([]);
  const [branches, setBranches] = useState<Array<{ id: number; name: string }>>([]);
  const [totalPosts, setTotalPosts] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [localSearchQuery, setLocalSearchQuery] = useState('');

  const handleSearchPost = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSearchQuery(localSearchQuery);
    setCurrentPage(1);
  };
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [postToDelete, setPostToDelete] = useState<PostData | null>(null);

  const pageSize = 10;

  const fetchPosts = async () => {
    setIsLoading(true);
    try {
      const { items, total } = await getPosts({
        page: currentPage,
        pageSize,
        q: searchQuery,
        status: statusFilter !== 'all' ? statusFilter : undefined
      });
      setPosts(items);
      setTotalPosts(total);
    } catch (error: any) {
      toast.error('Lỗi', { description: error?.message || 'Không thể tải bài viết' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, [currentPage, searchQuery, statusFilter]);

  // Branch names for the "Chi nhánh" column
  useEffect(() => {
    getAdminBranchOptions({ includeInactive: true })
      .then((res) => setBranches(res.items || []))
      .catch(() => setBranches([]));
  }, []);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(totalPosts / pageSize)), [totalPosts]);

  const handleCreate = () => {
    navigate('/posts/new');
  };

  const handleEdit = (post: PostData) => {
    navigate(`/posts/${post.id}/edit?mode=edit`);
  };

  const handleView = (post: PostData) => {
    navigate(`/posts/${post.id}/edit?mode=view`);
  };

  const handleDelete = (post: PostData) => {
    // Check if post is published
    if (post.status === 'published') {
      toast.error('Không thể xóa', { description: 'Bài viết đã xuất bản. Vui lòng gỡ xuất bản trước khi xóa.' });
      return;
    }
    setPostToDelete(post);
    setIsDeleteDialogOpen(true);
  };

  // Take a post out of the archive: it goes back to draft
  const handleRestore = async (post: PostData) => {
    if (!post.id) return;
    try {
      await updatePostApi(post.id, { status: 'draft' });
      toast.success('Đã khôi phục bài viết về bản nháp');
      fetchPosts();
    } catch (error: any) {
      toast.error('Lỗi', { description: error?.message || 'Không thể khôi phục bài viết' });
    }
  };

  const confirmDelete = async (hardDelete = false) => {
    if (!postToDelete?.id) return;
    try {
      await deletePostApi(postToDelete.id, hardDelete);
      toast.success(hardDelete ? 'Đã xóa vĩnh viễn' : 'Đã lưu trữ bài viết');
      setIsDeleteDialogOpen(false);
      setPostToDelete(null);
      fetchPosts();
    } catch (error: any) {
      toast.error('Lỗi', { description: error?.message || 'Không thể xóa bài viết' });
    }
  };

  // ─── Status badge helper ───────────────────────────────────────────────────
  const StatusBadge = ({ status }: { status: string }) => {
    if (status === 'published')
      return (
        <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full text-[11px] font-bold uppercase">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Đã xuất bản
        </span>
      );
    if (status === 'draft')
      return (
        <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full text-[11px] font-bold uppercase">
          Nháp
        </span>
      );
    return (
      <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-500 border border-slate-200 px-2 py-0.5 rounded-full text-[11px] font-bold uppercase">
        Lưu trữ
      </span>
    );
  };


  return (
    <div className="space-y-6">
      {/* ── Toolbar ─────────────────────────────────────────────────────────── */}
      {/* PAGE HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Quản lý bài viết</h1>
          <p className="text-sm text-slate-400 mt-0.5">Tổng cộng {totalPosts} bài viết trong hệ thống</p>
        </div>
      </div>

      {/* TOOLBAR */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
        {/* L E F T - G R O U P */}
        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
          <form onSubmit={handleSearchPost} className="flex gap-2">
            <div className="relative w-[320px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Tìm tiêu đề hoặc nội dung..."
                value={localSearchQuery}
                onChange={(e) => setLocalSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 h-10 bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500 rounded-xl transition-all outline-none text-sm"
              />
            </div>
            <Button
              type="submit"
              className="h-10 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold px-4 flex items-center gap-1.5 shrink-0"
            >
              <Search className="w-3.5 h-3.5" /> Tìm kiếm
            </Button>
          </form>
        </div>

        {/* R I G H T - G R O U P */}
        <div className="flex flex-wrap items-center gap-2.5 w-full xl:w-auto font-sans justify-start xl:justify-end">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="h-10 px-3 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 outline-none shadow-sm cursor-pointer"
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="draft">Nháp</option>
            <option value="published">Đã xuất bản</option>
            <option value="archived">Lưu trữ</option>
          </select>

          {hasPermission('posts', 'create') && (
            <Button
              onClick={handleCreate}
              className="bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm gap-2 text-white h-10 px-5 font-semibold text-xs"
            >
              <Plus className="w-4 h-4" /> Tạo bài viết
            </Button>
          )}

          <Button
            variant="outline"
            size="icon"
            onClick={fetchPosts}
            className="rounded-xl shadow-sm hover:rotate-180 transition-transform duration-500 shrink-0 h-10 w-10 ml-2"
            title="Làm mới"
            aria-label="Làm mới danh sách bài viết"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* ── Table ───────────────────────────────────────────────────────────── */}
      <Card className="border border-slate-200 shadow-sm rounded-xl overflow-hidden bg-white w-full min-w-0">
        <CardContent className="p-0">
          <Table className="w-full">
            <TableHeader className="bg-slate-50/80">
              <TableRow className="hover:bg-transparent border-none">
                <TableHead className="w-12 text-center text-[11px] uppercase font-bold text-slate-400 shrink-0 px-2">
                  ID
                </TableHead>
                <TableHead className="text-[11px] uppercase font-bold text-slate-500 px-3">Tiêu đề</TableHead>
                <TableHead className="text-[11px] uppercase font-bold text-slate-500 w-[130px] shrink-0 px-2">
                  Tác giả
                </TableHead>
                <TableHead className="text-[11px] uppercase font-bold text-slate-500 w-[130px] shrink-0 px-2">
                  Chi nhánh
                </TableHead>
                <TableHead className="text-[11px] uppercase font-bold text-slate-500 text-center w-[110px] shrink-0 px-2">
                  Trạng thái
                </TableHead>
                <TableHead className="text-[11px] uppercase font-bold text-slate-500 text-center w-[90px] shrink-0 px-2">
                  Xuất bản
                </TableHead>
                <TableHead className="text-[11px] uppercase font-bold text-slate-500 w-[140px] shrink-0 px-2">
                  Cập nhật
                </TableHead>
                <TableHead className="text-[11px] uppercase font-bold text-slate-500 text-center w-[75px] shrink-0 px-2">
                  Lượt xem
                </TableHead>
                <TableHead className="text-right text-[11px] uppercase font-bold text-slate-500 pr-3 pl-1 w-[95px] shrink-0">
                  Thao tác
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <TableRow key={`sk-${idx}`}>
                    <TableCell className="px-2">
                      <Skeleton className="h-4 w-8 mx-auto" />
                    </TableCell>
                    <TableCell className="px-3">
                      <Skeleton className="h-4 w-52" />
                    </TableCell>
                    <TableCell className="px-2">
                      <Skeleton className="h-4 w-20" />
                    </TableCell>
                    <TableCell className="px-2">
                      <Skeleton className="h-4 w-20" />
                    </TableCell>
                    <TableCell className="px-2">
                      <Skeleton className="h-5 w-20 mx-auto" />
                    </TableCell>
                    <TableCell className="px-2">
                      <Skeleton className="h-4 w-20 mx-auto" />
                    </TableCell>
                    <TableCell className="px-2">
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                    <TableCell className="px-2">
                      <Skeleton className="h-4 w-12 mx-auto" />
                    </TableCell>
                    <TableCell className="text-right pr-3 pl-1">
                      <Skeleton className="h-7 w-20 ml-auto" />
                    </TableCell>
                  </TableRow>
                ))
              ) : posts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center h-32 text-muted-foreground italic">
                    <div className="flex flex-col items-center gap-2">
                      <FileText size={32} className="opacity-20" />
                      <span>Chưa có bài viết nào</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                posts.map((post) => (
                  <TableRow key={post.id} className="hover:bg-slate-50/50 transition-colors">
                    <TableCell className="text-center font-mono text-xs text-slate-500 px-2">#{post.id}</TableCell>
                    <TableCell className="whitespace-normal px-3 py-2.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        {post.featured_image && (
                          <img
                            src={post.featured_image}
                            alt={`Ảnh đại diện: ${post.title}`}
                            loading="lazy"
                            className="w-10 h-10 rounded-lg object-cover border border-slate-200 shrink-0 shadow-sm"
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-slate-800 text-xs sm:text-sm line-clamp-1" title={post.title}>
                            {post.title}
                          </div>
                          {post.slug && (
                            <div className="font-mono text-[11px] text-slate-400 truncate max-w-[260px] md:max-w-[360px]" title={`/bai-viet/${post.slug}`}>
                              /{post.slug}
                            </div>
                          )}
                          <div className="flex items-center gap-2 mt-0.5">
                            {post.is_featured && (
                              <span className="inline-flex items-center rounded-full bg-cyan-100 text-cyan-700 border border-cyan-200 px-1.5 py-0 text-[11px] font-bold uppercase shrink-0">
                                Nổi bật
                              </span>
                            )}
                            {post.excerpt && (
                              <div
                                className="text-[11px] text-slate-400 truncate max-w-[260px] md:max-w-[360px] lg:max-w-[480px] hidden sm:block"
                                title={post.excerpt}
                              >
                                {post.excerpt}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="px-2 text-xs text-slate-600">
                      <span className="block truncate max-w-[120px]" title={post.created_by_staff_name || undefined}>
                        {post.created_by_staff_name || '-'}
                      </span>
                    </TableCell>
                    <TableCell className="px-2">
                      <BranchIdsBadge branch_ids={post.branch_ids} branches={branches} className="text-[11px]" />
                    </TableCell>
                    <TableCell className="text-center px-2">
                      <StatusBadge status={post.status} />
                    </TableCell>
                    <TableCell className="text-center text-xs text-slate-500 px-2">{formatVnDate(post.published_at)}</TableCell>
                    <TableCell className="px-2 text-xs text-slate-500">
                      <span className="block">{formatVnDateTime(post.updated_at)}</span>
                      {post.updated_by_staff_name && (
                        <span className="block truncate max-w-[130px] text-[11px] text-slate-400" title={post.updated_by_staff_name}>
                          {post.updated_by_staff_name}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-center px-2">
                      <span className="inline-flex items-center gap-1.5 text-xs font-mono text-slate-600 bg-slate-100 px-2 py-1 rounded-md">
                        <Eye className="w-3 h-3" />
                        {post.view_count || 0}
                      </span>
                    </TableCell>
                    <TableCell className="text-right pr-3 pl-1">
                      <div className="flex items-center justify-end gap-1">
                        {/* ALWAYS SHOW VIEW BUTTON */}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleView(post)}
                          className="h-7 w-7 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Xem chi tiết"
                          aria-label={`Xem bài viết ${post.title}`}
                        >
                          <Eye size={15} />
                        </Button>
                        
                        {hasPermission('posts', 'edit') && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(post)}
                            className="h-7 w-7 text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50 rounded-lg transition-colors"
                            title="Chỉnh sửa"
                            aria-label={`Sửa bài viết ${post.title}`}
                          >
                            <Edit3 size={15} />
                          </Button>
                        )}
                        {post.status === 'archived' && hasPermission('posts', 'edit') && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRestore(post)}
                            className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-50 rounded-lg transition-colors"
                            title="Khôi phục về bản nháp"
                            aria-label={`Khôi phục bài viết ${post.title}`}
                          >
                            <RotateCcw size={15} />
                          </Button>
                        )}
                        {hasPermission('posts', 'delete') && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(post)}
                            className="h-7 w-7 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                            title="Xóa"
                            aria-label={`Lưu trữ bài viết ${post.title}`}
                          >
                            <Trash2 size={15} />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* ── Pagination ──────────────────────────────────────────────────────── */}
      <Pagination className="mt-4">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              href="#"
              onClick={(e) => {
                e.preventDefault();
                if (currentPage > 1) setCurrentPage(currentPage - 1);
              }}
            />
          </PaginationItem>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
            <PaginationItem key={page}>
              <PaginationLink
                href="#"
                isActive={page === currentPage}
                onClick={(e) => {
                  e.preventDefault();
                  setCurrentPage(page);
                }}
              >
                {page}
              </PaginationLink>
            </PaginationItem>
          ))}
          <PaginationItem>
            <PaginationNext
              href="#"
              onClick={(e) => {
                e.preventDefault();
                if (currentPage < totalPages) setCurrentPage(currentPage + 1);
              }}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>

      {/* ── Delete Confirmation Dialog ─────────────────────────────────────── */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="rounded-2xl max-w-md font-sans bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-slate-900 text-lg font-bold">Xác nhận xóa bài viết</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-600 text-sm mt-2">
              Bạn có chắc chắn muốn lưu trữ bài viết "{postToDelete?.title}"? Bài viết vẫn còn trong hệ thống (mục Lưu trữ) và có thể khôi phục.{isSuperAdmin ? ' Chỉ nút "Xóa vĩnh viễn" mới xóa hẳn khỏi cơ sở dữ liệu.' : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 flex flex-col sm:flex-row gap-2">
            <AlertDialogCancel className="text-slate-500 hover:bg-slate-100 border-none rounded-xl mt-0 sm:mt-0">
              Hủy
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 rounded-xl"
              onClick={(e) => {
                e.preventDefault();
                confirmDelete(false);
              }}
            >
              Lưu trữ
            </AlertDialogAction>
            {isSuperAdmin && (
              <AlertDialogAction
                className="bg-red-700 hover:bg-red-800 rounded-xl"
                onClick={(e) => {
                  e.preventDefault();
                  confirmDelete(true);
                }}
              >
                Xóa vĩnh viễn
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
