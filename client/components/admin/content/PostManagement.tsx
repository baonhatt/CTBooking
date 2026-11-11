import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Search, RefreshCw, Plus, FileText, Eye } from 'lucide-react';
import { AdminDialog, AdminDialogFooter } from '@/components/admin/common/AdminDialog';
import { RowActionButton, RowActions } from '@/components/admin/common/RowActionButton';
import { StatusBadge } from '@/components/admin/common/StatusBadge';
import { PageHeader } from '@/components/admin/common/PageHeader';
import { AdminPagination } from '@/components/admin/common/AdminPagination';
import { EmptyState, TableSkeleton } from '@/components/admin/common/EmptyState';
import { notify } from '@/components/admin/common/notify';
import {
  ADMIN_BTN_PRIMARY,
  ADMIN_BTN_OUTLINE,
  ADMIN_BTN_DANGER,
  ADMIN_CARD,
  ADMIN_TABLE_HEAD,
  ADMIN_TH,
  ADMIN_TEXT
} from '@/components/admin/common/adminTokens';
import { BranchIdsBadge } from '@/components/admin/BranchIdsBadge';
import { getPosts, updatePostApi, deletePostApi, getAdminBranchOptions } from '@/lib/api';
import { formatVnDate, formatVnDateTime } from '@/lib/format';
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
      notify.error(error, 'Không thể tải bài viết');
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
      notify.error('Bài viết đã xuất bản. Vui lòng gỡ xuất bản trước khi lưu trữ.');
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
      notify.success('Đã khôi phục bài viết về bản nháp');
      fetchPosts();
    } catch (error: any) {
      notify.error(error, 'Không thể khôi phục bài viết');
    }
  };

  const confirmDelete = async (hardDelete = false) => {
    if (!postToDelete?.id) return;
    try {
      await deletePostApi(postToDelete.id, hardDelete);
      notify.success(hardDelete ? 'Đã xóa vĩnh viễn bài viết' : 'Đã lưu trữ bài viết');
      setIsDeleteDialogOpen(false);
      setPostToDelete(null);
      fetchPosts();
    } catch (error: any) {
      notify.error(error, hardDelete ? 'Không thể xóa bài viết' : 'Không thể lưu trữ bài viết');
    }
  };

  // Post status -> shared badge (archived posts show "Lưu trữ")
  const render_status = (status: string) =>
    status === 'published' || status === 'draft' ? <StatusBadge status={status} /> : <StatusBadge tone="neutral">Lưu trữ</StatusBadge>;

  return (
    <div>
      <PageHeader
        title="Quản lý bài viết"
        description={`Tổng cộng ${totalPosts} bài viết trong hệ thống`}
        actions={
          hasPermission('posts', 'create') && (
            <Button onClick={handleCreate} className={`${ADMIN_BTN_PRIMARY} gap-2`}>
              <Plus className="h-4 w-4" /> Tạo bài viết
            </Button>
          )
        }
      />

      {/* TOOLBAR */}
      <div className={`${ADMIN_CARD} mb-4 flex flex-col items-start justify-between gap-4 p-4 xl:flex-row xl:items-center`}>
        <form onSubmit={handleSearchPost} className="flex gap-2">
          <div className="relative w-[320px] max-w-full">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm tiêu đề hoặc nội dung..."
              value={localSearchQuery}
              onChange={(e) => setLocalSearchQuery(e.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm outline-none transition-all focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-600/20"
            />
          </div>
          <Button type="submit" className={`${ADMIN_BTN_PRIMARY} shrink-0 gap-1.5`}>
            <Search className="h-4 w-4" /> {ADMIN_TEXT.search}
          </Button>
        </form>

        <div className="flex w-full flex-wrap items-center justify-start gap-2.5 xl:w-auto xl:justify-end">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="h-10 cursor-pointer rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="draft">Bản nháp</option>
            <option value="published">Đã xuất bản</option>
            <option value="archived">Lưu trữ</option>
          </select>

          <Button
            variant="outline"
            onClick={fetchPosts}
            className={`${ADMIN_BTN_OUTLINE} w-10 shrink-0 px-0`}
            title={ADMIN_TEXT.refresh}
            aria-label="Làm mới danh sách bài viết"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* TABLE */}
      <Card className={`${ADMIN_CARD} w-full min-w-0 overflow-hidden`}>
        <CardContent className="p-0">
          {isLoading ? (
            <TableSkeleton rows={6} />
          ) : posts.length === 0 ? (
            <EmptyState
              icon={<FileText className="h-6 w-6" />}
              title={searchQuery || statusFilter !== 'all' ? 'Không tìm thấy bài viết' : 'Chưa có bài viết nào'}
              description={searchQuery || statusFilter !== 'all' ? 'Hãy thử từ khóa hoặc bộ lọc khác.' : undefined}
            />
          ) : (
            <Table className="w-full">
              <TableHeader className={ADMIN_TABLE_HEAD}>
                <TableRow className="hover:bg-transparent">
                  <TableHead className={`${ADMIN_TH} px-3`}>Tiêu đề</TableHead>
                  <TableHead className={`${ADMIN_TH} w-[130px] px-2`}>Tác giả</TableHead>
                  <TableHead className={`${ADMIN_TH} w-[130px] px-2`}>Chi nhánh</TableHead>
                  <TableHead className={`${ADMIN_TH} w-[110px] px-2 text-center`}>Trạng thái</TableHead>
                  <TableHead className={`${ADMIN_TH} w-[90px] px-2 text-center`}>Xuất bản</TableHead>
                  <TableHead className={`hidden 2xl:table-cell ${ADMIN_TH} w-[140px] px-2`}>Cập nhật</TableHead>
                  <TableHead className={`${ADMIN_TH} w-[75px] px-2 text-center`}>Lượt xem</TableHead>
                  <TableHead className={`${ADMIN_TH} w-[150px] pl-1 pr-3 text-right`}>{ADMIN_TEXT.actionColumn}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {posts.map((post) => (
                  <TableRow key={post.id} className="transition-colors hover:bg-slate-50/50">
                    <TableCell className="whitespace-normal px-3 py-2.5">
                      <div className="flex min-w-0 max-w-[420px] items-center gap-2.5">
                        {post.featured_image && (
                          <img
                            src={post.featured_image}
                            alt={`Ảnh đại diện: ${post.title}`}
                            loading="lazy"
                            className="h-10 w-10 shrink-0 rounded-lg border border-slate-200 object-cover shadow-sm"
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="line-clamp-1 text-sm font-semibold text-slate-800" title={post.title}>
                            {post.title}
                          </div>
                          {post.slug && (
                            <div className="max-w-[260px] truncate font-mono text-[11px] text-slate-400 md:max-w-[360px]" title={`/bai-viet/${post.slug}`}>
                              /{post.slug}
                            </div>
                          )}
                          <div className="mt-0.5 flex items-center gap-2">
                            {post.is_featured && <StatusBadge tone="info">Nổi bật</StatusBadge>}
                            {post.excerpt && (
                              <div
                                className="hidden max-w-[260px] truncate text-[11px] text-slate-400 sm:block md:max-w-[360px] lg:max-w-[340px]"
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
                      <span className="block max-w-[120px] truncate" title={post.created_by_staff_name || undefined}>
                        {post.created_by_staff_name || '-'}
                      </span>
                    </TableCell>
                    <TableCell className="px-2">
                      <BranchIdsBadge branch_ids={post.branch_ids} branches={branches} className="text-[11px]" />
                    </TableCell>
                    <TableCell className="px-2 text-center">{render_status(post.status)}</TableCell>
                    <TableCell className="px-2 text-center text-xs text-slate-500">{formatVnDate(post.published_at)}</TableCell>
                    <TableCell className="hidden px-2 text-xs text-slate-500 2xl:table-cell">
                      <span className="block">{formatVnDateTime(post.updated_at)}</span>
                      {post.updated_by_staff_name && (
                        <span className="block max-w-[130px] truncate text-[11px] text-slate-400" title={post.updated_by_staff_name}>
                          {post.updated_by_staff_name}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="px-2 text-center">
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2 py-1 font-mono text-xs text-slate-600">
                        <Eye className="h-3 w-3" />
                        {post.view_count || 0}
                      </span>
                    </TableCell>
                    <TableCell className="pl-1 pr-3">
                      <RowActions>
                        <RowActionButton action="view" label="Xem chi tiết" onClick={() => handleView(post)} />
                        {hasPermission('posts', 'edit') && (
                          <RowActionButton action="edit" label="Chỉnh sửa" onClick={() => handleEdit(post)} />
                        )}
                        {post.status === 'archived' && hasPermission('posts', 'edit') && (
                          <RowActionButton action="restore" label="Khôi phục về bản nháp" onClick={() => handleRestore(post)} />
                        )}
                        {hasPermission('posts', 'delete') && (
                          <RowActionButton action="delete" label="Lưu trữ bài viết" onClick={() => handleDelete(post)} />
                        )}
                      </RowActions>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* PAGINATION */}
      <AdminPagination
        page={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
        totalLabel={`${totalPosts} bài viết`}
      />

      {/* ARCHIVE / DELETE CONFIRMATION */}
      <AdminDialog
        open={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        size="sm"
        mode="form"
        title="Lưu trữ bài viết"
        footer={
          <AdminDialogFooter
            onCancel={() => setIsDeleteDialogOpen(false)}
            onSubmit={() => confirmDelete(false)}
            submitText="Lưu trữ"
            leading={
              isSuperAdmin && (
                <Button className={ADMIN_BTN_DANGER} onClick={() => confirmDelete(true)}>
                  Xóa vĩnh viễn
                </Button>
              )
            }
          />
        }
      >
        <p className="text-sm text-slate-600">
          Bạn có chắc chắn muốn lưu trữ bài viết "{postToDelete?.title}"? Bài viết vẫn còn trong hệ thống (mục Lưu trữ) và có thể khôi phục.
          {isSuperAdmin ? ' Chỉ nút "Xóa vĩnh viễn" mới xóa hẳn khỏi cơ sở dữ liệu.' : ''}
        </p>
      </AdminDialog>
    </div>
  );
};
