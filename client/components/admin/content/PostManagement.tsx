import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Search, RefreshCw, Edit3, Plus, FileText, X, Image as ImageIcon, Link2, Eye } from 'lucide-react';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious
} from '@/components/ui/pagination';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { getPosts, createPostApi, updatePostApi } from '@/lib/api';
import { PostRichTextEditor } from './PostRichTextEditor';
import { toast } from 'sonner';

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
}

function getPlainTextFromHtml(value?: string) {
  if (!value) return '';

  if (typeof document === 'undefined') {
    return value
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  const temp = document.createElement('div');
  temp.innerHTML = value;
  return temp.textContent?.replace(/\s+/g, ' ').trim() || '';
}

export const PostManagement = () => {
  const [posts, setPosts] = useState<PostData[]>([]);
  const [totalPosts, setTotalPosts] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [editData, setEditData] = useState<Partial<PostData> & { imageFile?: File }>({});
  const [isSaving, setIsSaving] = useState(false);
  const initialSnapshotRef = useRef<string>('');

  const pageSize = 10;

  const makeSlug = (title: string) =>
    title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 255);

  const snapshotEditData = (data: Partial<PostData> & { imageFile?: File }) =>
    JSON.stringify({
      id: data.id ?? 0,
      title: data.title ?? '',
      content: data.content ?? '',
      excerpt: data.excerpt ?? '',
      featured_image: data.featured_image ?? '',
      status: data.status ?? 'draft',
      is_featured: Boolean(data.is_featured),
      imageFileName: data.imageFile?.name || ''
    });

  const hasUnsavedChanges = () => initialSnapshotRef.current !== snapshotEditData(editData);

  const requestClose = async (force = false) => {
    if (!isEditOpen) return;
    if (!force && hasUnsavedChanges()) {
      const ok = window.confirm('Bạn có thay đổi chưa lưu. Đóng lại sẽ mất toàn bộ nội dung đang nhập. Bạn chắc chắn muốn đóng?');
      if (!ok) return;
    }
    setIsEditOpen(false);
  };

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

  const totalPages = useMemo(() => Math.max(1, Math.ceil(totalPosts / pageSize)), [totalPosts]);

  const handleCreate = () => {
    const next = {
      id: 0,
      title: '',
      content: '',
      excerpt: '',
      status: 'draft',
      is_featured: false
    };
    setEditData(next);
    initialSnapshotRef.current = snapshotEditData(next);
    setIsEditOpen(true);
  };

  const handleEdit = (post: PostData) => {
    setEditData(post);
    initialSnapshotRef.current = snapshotEditData(post);
    setIsEditOpen(true);
  };

  const handleSave = async (overrideStatus?: 'draft' | 'published' | 'archived') => {
    if (!editData.title?.trim()) {
      toast.error('Lỗi', { description: 'Vui lòng nhập tiêu đề' });
      return;
    }
    if (!getPlainTextFromHtml(editData.content)) {
      toast.error('Lỗi', { description: 'Vui lòng nhập nội dung' });
      return;
    }

    setIsSaving(true);
    try {
      const isNew = !editData.id;
      let imageBase64: string | undefined = undefined;
      if (editData.imageFile) {
        const file = editData.imageFile;
        imageBase64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.readAsDataURL(file);
        });
      }

      // Flow: tạo mới luôn là nháp. Xuất bản chỉ thực hiện khi edit bài đã tồn tại.
      const nextStatus: 'draft' | 'published' | 'archived' =
        isNew ? 'draft' : overrideStatus || (editData.status as any) || 'draft';

      const payload = {
        title: editData.title!,
        content: editData.content!,
        excerpt: editData.excerpt,
        featured_image: editData.imageFile ? undefined : editData.featured_image,
        image_base64: imageBase64,
        status: nextStatus,
        is_featured: editData.is_featured || false
      };

      if (editData.id) {
        await updatePostApi(editData.id, payload);
        toast.success('Cập nhật bài viết thành công');
      } else {
        await createPostApi(payload);
        toast.success('Đã tạo nháp bài viết');
      }

      initialSnapshotRef.current = snapshotEditData({ ...editData, imageFile: undefined });
      setIsEditOpen(false);
      fetchPosts();
    } catch (error: any) {
      toast.error('Lỗi', { description: error?.message || 'Có lỗi xảy ra' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-2xl border shadow-sm">
        <div className="flex flex-col gap-1">
          <h3 className="text-lg font-bold text-slate-900">Quản lý bài viết</h3>
          <p className="text-xs text-slate-500">Tổng cộng {totalPosts} bài viết</p>
        </div>
        <div className="flex flex-1 w-full md:max-w-xl gap-2 ml-auto">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Tìm kiếm bài viết..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-blue-500 rounded-xl transition-all outline-none text-sm border"
            />
          </div>
          <div className="flex gap-2 items-center">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-2 bg-slate-50 rounded-xl border border-slate-200 text-sm font-medium"
            >
              <option value="all">Tất cả</option>
              <option value="draft">Nháp</option>
              <option value="published">Đã xuất bản</option>
              <option value="archived">Lưu trữ</option>
            </select>
            <Button
              variant="outline"
              size="icon"
              onClick={fetchPosts}
              className="rounded-xl shadow-sm hover:rotate-180 transition-transform duration-500 shrink-0 h-10 w-10 flex items-center justify-center bg-white border-slate-200"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
            <Button
              onClick={handleCreate}
              className="bg-blue-600 hover:bg-blue-700 rounded-xl shadow-lg shadow-blue-200 gap-2 text-white font-bold h-10 px-4"
            >
              <Plus className="w-4 h-4" /> Tạo bài viết
            </Button>
          </div>
        </div>
      </div>

      <Card className="border-none shadow-xl shadow-slate-200/50 rounded-2xl overflow-hidden bg-white">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50/80">
              <TableRow className="hover:bg-transparent border-none">
                <TableHead className="w-16 text-center text-[10px] uppercase font-bold text-slate-400">ID</TableHead>
                <TableHead className="text-[10px] uppercase font-bold text-slate-500 min-w-[420px]">Tiêu đề</TableHead>
                <TableHead className="text-[10px] uppercase font-bold text-slate-500 text-center w-[140px]">Trạng thái</TableHead>
                <TableHead className="text-[10px] uppercase font-bold text-slate-500 text-center w-[120px]">Xuất bản</TableHead>
                <TableHead className="text-[10px] uppercase font-bold text-slate-500 text-center w-[100px]">Lượt xem</TableHead>
                <TableHead className="text-right text-[10px] uppercase font-bold text-slate-500 pr-6 w-[90px]">
                  Thao tác
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <TableRow key={`sk-${idx}`}>
                    <TableCell>
                      <Skeleton className="h-4 w-8 mx-auto" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-64 " />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-5 w-20 mx-auto" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-24 mx-auto" />
                    </TableCell>
                    <TableCell className="text-right">
                      <Skeleton className="h-8 w-24 ml-auto" />
                    </TableCell>
                  </TableRow>
                ))
              ) : posts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center h-32 text-muted-foreground italic">
                    <div className="flex flex-col items-center gap-2">
                      <FileText size={32} className="opacity-20" />
                      <span>Chưa có bài viết nào</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                posts.map((post) => (
                  <TableRow key={post.id} className="hover:bg-slate-50/50 transition-colors">
                    <TableCell className="text-center font-mono text-xs text-slate-500">#{post.id}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {post.featured_image && (
                          <img
                            src={post.featured_image}
                            alt={post.title}
                            className="w-12 h-12 rounded-lg object-cover border border-slate-200"
                          />
                        )}
                        <div>
                          <div className="font-bold text-slate-700 line-clamp-2">{post.title}</div>
                          {post.excerpt && <div className="text-xs text-slate-400 line-clamp-2">{post.excerpt}</div>}
                          {post.is_featured ? (
                            <span className="inline-flex mt-1 items-center rounded-full bg-cyan-100 text-cyan-700 border border-cyan-200 px-2 py-0.5 text-[10px] font-bold uppercase">
                              Nổi bật
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {post.status === 'published' ? (
                        <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          Đã xuất bản
                        </span>
                      ) : post.status === 'draft' ? (
                        <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase">
                          Nháp
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-500 border border-slate-200 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase">
                          Lưu trữ
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-center text-xs text-slate-500">
                      {post.published_at ? new Date(post.published_at).toLocaleDateString('vi-VN') : '---'}
                    </TableCell>
                    <TableCell className="text-center">
                       <span className="inline-flex items-center gap-1.5 text-xs font-mono text-slate-600 bg-slate-100 px-2 py-1 rounded-md">
                          <Eye className="w-3 h-3" />
                          {post.view_count || 0}
                       </span>
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(post)}
                        className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Chỉnh sửa"
                      >
                        <Edit3 size={16} />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

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

      {/* Edit/Create Dialog */}
      <Dialog
        open={isEditOpen}
        onOpenChange={(next) => {
          if (next) setIsEditOpen(true);
        }}
      >
        <DialogContent
          className="max-w-6xl w-[95vw] h-[92vh] p-0 overflow-hidden bg-white [&>button]:hidden"
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="px-6 py-4 border-b bg-slate-900 text-white flex items-center justify-between">
              <div className="min-w-0">
                <DialogHeader>
                  <DialogTitle className="text-white">
                    {editData.id ? 'Chỉnh sửa bài viết' : 'Tạo bài viết mới'}
                  </DialogTitle>
                </DialogHeader>
                <p className="text-[10px] text-slate-300 font-bold uppercase tracking-widest mt-1">
                  {hasUnsavedChanges() ? 'Đang nhập liệu • Chưa lưu' : 'Sẵn sàng'}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => requestClose(false)}
                className="h-9 w-9 text-slate-300 hover:text-white hover:bg-white/10 rounded-full"
                title="Đóng"
              >
                <X size={18} />
              </Button>
            </div>

            {/* Body */}
            <div className="flex-1 bg-slate-50 min-h-0 overflow-y-scroll scrollbar-neon scrollbar-gutter-stable">
              <div className="grid grid-cols-12 gap-6 p-6">
                {/* Left: Form */}
                <div className="col-span-8 pr-2">
                  <div className="bg-white rounded-2xl border shadow-sm p-5 space-y-5">
                    <div className="grid grid-cols-12 gap-4 items-start">
                      <div className="col-span-8">
                        <Label>Tiêu đề</Label>
                        <Textarea
                          className="mt-2 min-h-[44px] resize-y"
                          value={editData.title || ''}
                          onChange={(e) => setEditData({ ...editData, title: e.target.value })}
                          placeholder="Nhập tiêu đề bài viết..."
                        />
                        <p className="mt-2 text-[11px] text-slate-500 flex items-center gap-1.5">
                          <Link2 className="w-3.5 h-3.5 text-slate-400" />
                          Slug dự kiến: <span className="font-mono text-slate-700">{makeSlug(editData.title || '') || '---'}</span>
                        </p>
                      </div>
                      <div className="col-span-4">
                        <Label>Tóm tắt</Label>
                        <Textarea
                          className="mt-2 min-h-[92px] resize-y"
                          value={editData.excerpt || ''}
                          onChange={(e) => setEditData({ ...editData, excerpt: e.target.value })}
                          placeholder="Tóm tắt 1–2 câu..."
                        />
                        <p className="mt-2 text-[11px] text-slate-500">
                          Gợi ý: giữ trong khoảng <strong>120–180 ký tự</strong> để hiển thị đẹp.
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-12 gap-4">
                      <div className="col-span-7">
                        <Label>Ảnh đại diện</Label>
                        <div className="mt-2 flex items-center gap-3">
                          <Input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const url = URL.createObjectURL(file);
                                setEditData((prev) => ({
                                  ...prev,
                                  featured_image: url,
                                  imageFile: file
                                }));
                              }
                            }}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            className="shrink-0 rounded-xl"
                            onClick={() => setEditData((prev) => ({ ...prev, featured_image: '', imageFile: undefined }))}
                            disabled={!editData.featured_image}
                            title="Gỡ ảnh"
                          >
                            Gỡ
                          </Button>
                        </div>
                        <p className="mt-2 text-[11px] text-slate-500">
                          Ảnh này sẽ dùng làm thumbnail trong danh sách & khi share link.
                        </p>
                      </div>

                      <div className="col-span-5">
                        <Label>Thiết lập</Label>
                        <div className="mt-2 grid grid-cols-1 gap-3">
                          <div className="flex items-center gap-2 px-3 h-10 border border-slate-200 rounded-xl bg-white">
                            <Switch
                              checked={editData.is_featured || false}
                              onCheckedChange={(checked) => setEditData({ ...editData, is_featured: checked })}
                            />
                            <Label className="cursor-pointer">Nổi bật</Label>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <Label>Nội dung</Label>
                      <div className="mt-2">
                        <PostRichTextEditor
                          value={editData.content || ''}
                          onChange={(content) => setEditData((prev) => ({ ...prev, content }))}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right: Preview / Tips */}
                <div className="col-span-4">
                  <div className="space-y-4">
                    <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
                      <div className="px-5 py-3 bg-slate-50 border-b flex items-center gap-2">
                        <ImageIcon className="w-4 h-4 text-slate-500" />
                        <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">
                          Preview thumbnail
                        </span>
                      </div>
                      <div className="p-5">
                        {editData.featured_image ? (
                          <img
                            src={editData.featured_image}
                            alt="Preview"
                            className="w-full aspect-[16/10] rounded-xl object-cover border border-slate-200"
                          />
                        ) : (
                          <div className="w-full aspect-[16/10] rounded-xl border border-dashed border-slate-200 bg-slate-50 flex items-center justify-center text-slate-400 text-xs italic">
                            Chưa chọn ảnh đại diện
                          </div>
                        )}
                        <div className="mt-4 space-y-1">
                          <p className="text-sm font-black text-slate-900 line-clamp-2">
                            {editData.title?.trim() || 'Tiêu đề bài viết...'}
                          </p>
                          <p className="text-xs text-slate-500 line-clamp-2">
                            {editData.excerpt?.trim() || 'Tóm tắt ngắn (excerpt) sẽ hiện ở danh sách / SEO...'}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5">
                      <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-2">Gợi ý nhập liệu</p>
                      <ul className="text-xs text-slate-700 space-y-2 leading-relaxed">
                        <li>
                          <strong>Tiêu đề</strong>: 6–12 từ, rõ chủ đề. Tránh viết HOA toàn bộ.
                        </li>
                        <li>
                          <strong>Tóm tắt</strong>: 1–2 câu giúp người đọc hiểu nhanh.
                        </li>
                        <li>
                          <strong>Ảnh đại diện</strong>: ưu tiên ảnh ngang tỉ lệ 16:10 hoặc 16:9.
                        </li>
                        <li>
                          <strong>Nội dung</strong>: dùng heading để chia đoạn, chèn ảnh minh họa khi cần.
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t bg-white flex items-center justify-between shrink-0 sticky bottom-0 z-20">
              <span className="text-[11px] text-slate-500">
                {hasUnsavedChanges() ? 'Có thay đổi chưa lưu' : 'Không có thay đổi'}
              </span>
              <div className="flex items-center gap-2 flex-wrap justify-end">
                <Button
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => setIsPreviewOpen(true)}
                  disabled={!editData.title?.trim() && !getPlainTextFromHtml(editData.content)}
                >
                  <Eye className="w-4 h-4 mr-1.5" />
                  Preview
                </Button>
                <Button variant="outline" className="rounded-xl" onClick={() => requestClose(false)} disabled={isSaving}>
                  Hủy
                </Button>
                {editData.id ? (
                  <>
                    <Button
                      onClick={() => handleSave(undefined)}
                      disabled={isSaving}
                      className="rounded-xl bg-blue-600 hover:bg-blue-700"
                    >
                      {isSaving ? 'Đang lưu...' : 'Lưu'}
                    </Button>
                    {editData.status === 'published' ? (
                      <Button
                        onClick={() => handleSave('archived')}
                        disabled={isSaving}
                        className="rounded-xl bg-slate-600 hover:bg-slate-700"
                        title="Gỡ phát hành (chuyển sang lưu trữ)"
                      >
                        Gỡ phát hành
                      </Button>
                    ) : editData.status === 'archived' ? (
                      <Button
                        onClick={() => handleSave('draft')}
                        disabled={isSaving}
                        className="rounded-xl bg-amber-600 hover:bg-amber-700"
                        title="Chuyển bài viết về bản nháp"
                      >
                        Chuyển sang nháp
                      </Button>
                    ) : (
                      <Button
                        onClick={() => handleSave('published')}
                        disabled={isSaving}
                        className="rounded-xl bg-emerald-600 hover:bg-emerald-700"
                        title="Xuất bản bài viết"
                      >
                        Xuất bản
                      </Button>
                    )}
                  </>
                ) : (
                  <Button
                    onClick={() => handleSave('draft')}
                    disabled={isSaving}
                    className="rounded-xl bg-blue-600 hover:bg-blue-700"
                  >
                    {isSaving ? 'Đang lưu...' : 'Tạo nháp'}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-4xl w-[95vw] h-[90vh] p-0 overflow-hidden bg-white">
          <div className="h-full overflow-y-auto bg-slate-50">
            <article className="max-w-3xl mx-auto p-6 md:p-8 space-y-6">
              {editData.featured_image ? (
                <img
                  src={editData.featured_image}
                  alt={editData.title || 'Ảnh đại diện bài viết'}
                  className="w-full aspect-[16/9] object-cover rounded-2xl border border-slate-200 shadow-sm"
                />
              ) : null}

              <header className="space-y-3">
                <h1 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900">
                  {editData.title?.trim() || 'Tiêu đề bài viết'}
                </h1>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-700">
                    {editData.status === 'published' ? 'Đã xuất bản' : editData.status === 'archived' ? 'Lưu trữ' : 'Nháp'}
                  </span>
                  <span>{new Date().toLocaleDateString('vi-VN')}</span>
                </div>
                {editData.excerpt?.trim() ? <p className="text-slate-600 leading-7">{editData.excerpt.trim()}</p> : null}
              </header>

              <section
                className="prose prose-slate max-w-none prose-img:rounded-xl prose-headings:font-extrabold"
                dangerouslySetInnerHTML={{
                  __html: editData.content?.trim() || '<p>Nội dung bài viết sẽ hiển thị ở đây.</p>'
                }}
              />
            </article>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
