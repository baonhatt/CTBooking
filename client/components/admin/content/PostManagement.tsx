import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getPosts, createPostApi, updatePostApi } from '@/lib/api';
import { uploadDirectToCloudinary } from '@/lib/api/uploads';
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
  meta_description?: string;
  meta_keywords?: string;
  seo_title?: string;
  og_image?: string;
  canonical_url?: string;
  schema_type?: string;
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
  const navigate = useNavigate();
  const [posts, setPosts] = useState<PostData[]>([]);
  const [totalPosts, setTotalPosts] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [editData, setEditData] = useState<Partial<PostData> & { imageFile?: File; ogImageFile?: File }>({});
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('content');
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

  const snapshotEditData = (data: Partial<PostData> & { imageFile?: File; ogImageFile?: File }) =>
    JSON.stringify({
      id: data.id ?? 0,
      title: data.title ?? '',
      content: data.content ?? '',
      excerpt: data.excerpt ?? '',
      featured_image: data.featured_image ?? '',
      status: data.status ?? 'draft',
      is_featured: Boolean(data.is_featured),
      meta_description: data.meta_description ?? '',
      meta_keywords: data.meta_keywords ?? '',
      seo_title: data.seo_title ?? '',
      og_image: data.og_image ?? '',
      canonical_url: data.canonical_url ?? '',
      schema_type: data.schema_type ?? 'Article',
      imageFileName: data.imageFile?.name || '',
      ogImageFileName: data.ogImageFile?.name || ''
    });

  const hasUnsavedChanges = () => initialSnapshotRef.current !== snapshotEditData(editData);

  const requestClose = async (force = false) => {
    if (!isEditOpen) return;
    if (!force && hasUnsavedChanges()) {
      const ok = window.confirm(
        'Bạn có thay đổi chưa lưu. Đóng lại sẽ mất toàn bộ nội dung đang nhập. Bạn chắc chắn muốn đóng?'
      );
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
      is_featured: false,
      meta_description: '',
      meta_keywords: '',
      seo_title: '',
      og_image: '',
      canonical_url: '',
      schema_type: 'Article'
    };
    setEditData(next);
    initialSnapshotRef.current = snapshotEditData(next);
    setIsEditOpen(true);
  };

  const handleEdit = (post: PostData) => {
    navigate(`/posts/${post.id}/edit`);
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

      let featuredImageUrl: string | undefined = editData.imageFile ? undefined : editData.featured_image;
      if (editData.imageFile) {
        try {
          const result = await uploadDirectToCloudinary(editData.imageFile, 'posts');
          featuredImageUrl = result.url;
        } catch (uploadErr: any) {
          toast.error('Lỗi upload ảnh', { description: uploadErr?.message || 'Không thể upload ảnh' });
          setIsSaving(false);
          return;
        }
      }

      let ogImageUrl: string | undefined = editData.ogImageFile ? undefined : editData.og_image;
      if (editData.ogImageFile) {
        try {
          const result = await uploadDirectToCloudinary(editData.ogImageFile, 'posts');
          ogImageUrl = result.url;
        } catch (uploadErr: any) {
          toast.error('Lỗi upload OG image', { description: uploadErr?.message || 'Không thể upload OG image' });
          setIsSaving(false);
          return;
        }
      }

      const nextStatus: 'draft' | 'published' | 'archived' = isNew
        ? 'draft'
        : overrideStatus || (editData.status as any) || 'draft';

      const payload = {
        title: editData.title!,
        content: editData.content!,
        excerpt: editData.excerpt,
        featured_image: featuredImageUrl,
        og_image: ogImageUrl,
        status: nextStatus,
        is_featured: editData.is_featured || false,
        meta_description: editData.meta_description,
        meta_keywords: editData.meta_keywords,
        seo_title: editData.seo_title,
        canonical_url: editData.canonical_url,
        schema_type: editData.schema_type
      };

      if (editData.id) {
        await updatePostApi(editData.id, payload);
        toast.success('Cập nhật bài viết thành công');
      } else {
        await createPostApi(payload);
        toast.success('Đã tạo nháp bài viết');
      }

      initialSnapshotRef.current = snapshotEditData({ ...editData, imageFile: undefined, ogImageFile: undefined });
      setIsEditOpen(false);
      fetchPosts();
    } catch (error: any) {
      toast.error('Lỗi', { description: error?.message || 'Có lỗi xảy ra' });
    } finally {
      setIsSaving(false);
    }
  };

  // ─── Status badge helper ───────────────────────────────────────────────────
  const StatusBadge = ({ status }: { status: string }) => {
    if (status === 'published')
      return (
        <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Đã xuất bản
        </span>
      );
    if (status === 'draft')
      return (
        <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase">
          Nháp
        </span>
      );
    return (
      <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-500 border border-slate-200 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase">
        Lưu trữ
      </span>
    );
  };

  // ─── Save action buttons ───────────────────────────────────────────────────
  const renderSaveButtons = () => {
    if (!editData.id) {
      return (
        <Button
          onClick={() => handleSave('draft')}
          disabled={isSaving}
          className="rounded-xl bg-blue-600 hover:bg-blue-700"
        >
          {isSaving ? 'Đang lưu...' : 'Tạo nháp'}
        </Button>
      );
    }
    return (
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
          >
            Gỡ phát hành
          </Button>
        ) : editData.status === 'archived' ? (
          <Button
            onClick={() => handleSave('draft')}
            disabled={isSaving}
            className="rounded-xl bg-amber-600 hover:bg-amber-700"
          >
            Chuyển sang nháp
          </Button>
        ) : (
          <Button
            onClick={() => handleSave('published')}
            disabled={isSaving}
            className="rounded-xl bg-emerald-600 hover:bg-emerald-700"
          >
            Xuất bản
          </Button>
        )}
      </>
    );
  };

  return (
    <div className="space-y-6">
      {/* ── Toolbar ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col min-h-0 md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-2xl border shadow-sm">
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

      {/* ── Table ───────────────────────────────────────────────────────────── */}
      <Card className="border-none shadow-xl shadow-slate-200/50 rounded-2xl overflow-hidden bg-white w-full min-w-0">
        <CardContent className="p-0">
          <Table className="w-full table-fixed">
            <TableHeader className="bg-slate-50/80">
              <TableRow className="hover:bg-transparent border-none">
                <TableHead className="w-14 text-center text-[10px] uppercase font-bold text-slate-400 shrink-0">
                  ID
                </TableHead>
                <TableHead className="text-[10px] uppercase font-bold text-slate-500 min-w-0">Tiêu đề</TableHead>
                <TableHead className="text-[10px] uppercase font-bold text-slate-500 text-center w-[110px] shrink-0">
                  Trạng thái
                </TableHead>
                <TableHead className="text-[10px] uppercase font-bold text-slate-500 text-center w-[100px] hidden sm:table-cell shrink-0">
                  Xuất bản
                </TableHead>
                <TableHead className="text-[10px] uppercase font-bold text-slate-500 text-center w-[80px] hidden md:table-cell shrink-0">
                  Lượt xem
                </TableHead>
                <TableHead className="text-right text-[10px] uppercase font-bold text-slate-500 pr-4 w-[70px] shrink-0">
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
                      <Skeleton className="h-4 w-64" />
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
                  <TableCell colSpan={6} className="text-center h-32 text-muted-foreground italic">
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
                    <TableCell className="max-w-0">
                      <div className="flex items-center gap-2 sm:gap-3">
                        {post.featured_image && (
                          <img
                            src={post.featured_image}
                            alt={post.title}
                            className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg object-cover border border-slate-200 shrink-0"
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-slate-700 text-sm line-clamp-1">{post.title}</div>
                          <div className="flex items-center gap-2 mt-0.5">
                            {post.is_featured && (
                              <span className="inline-flex items-center rounded-full bg-cyan-100 text-cyan-700 border border-cyan-200 px-1.5 py-0 text-[9px] font-bold uppercase shrink-0">
                                Nổi bật
                              </span>
                            )}
                            {post.excerpt && (
                              <div className="text-xs text-slate-400 truncate hidden sm:block" title={post.excerpt}>
                                {post.excerpt}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <StatusBadge status={post.status} />
                    </TableCell>
                    <TableCell className="text-center text-xs text-slate-500 hidden sm:table-cell">
                      {post.published_at ? new Date(post.published_at).toLocaleDateString('vi-VN') : '---'}
                    </TableCell>
                    <TableCell className="text-center hidden md:table-cell">
                      <span className="inline-flex items-center gap-1.5 text-xs font-mono text-slate-600 bg-slate-100 px-2 py-1 rounded-md">
                        <Eye className="w-3 h-3" />
                        {post.view_count || 0}
                      </span>
                    </TableCell>
                    <TableCell className="text-right pr-4">
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

      {/* ── Edit / Create Dialog ─────────────────────────────────────────────
           Cấu trúc chuẩn để scroll hoạt động:
           DialogContent  h-[92vh]  flex flex-col
             ├─ Header    shrink-0
             ├─ Body      flex-1  min-h-0  overflow-y-auto   ← scroll tại đây
             └─ Footer    shrink-0
      ──────────────────────────────────────────────────────────────────────── */}
      <Dialog
        open={isEditOpen}
        onOpenChange={(next) => {
          if (next) setIsEditOpen(true);
        }}
      >
        <DialogContent
          className="max-w-6xl w-[95vw] h-[92vh] p-0 overflow-hidden bg-white flex flex-col [&>button]:hidden"
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          {/* Header — cố định trên cùng */}
          <div className="shrink-0 px-6 py-4 border-b bg-slate-900 text-white flex items-center justify-between">
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

          {/* Body — scroll toàn bộ nội dung form */}
          <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="p-6">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-3 mb-6">
                  <TabsTrigger value="content">Nội dung</TabsTrigger>
                  <TabsTrigger value="seo">SEO</TabsTrigger>
                  <TabsTrigger value="preview">Preview</TabsTrigger>
                </TabsList>

                {/* Tab: Nội dung chính */}
                <TabsContent value="content" className="space-y-5">
                  <div className="bg-white rounded-2xl border shadow-sm p-5 space-y-5">
                    {/* Tiêu đề + Tóm tắt */}
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
                          Slug dự kiến:{' '}
                          <span className="font-mono text-slate-700">{makeSlug(editData.title || '') || '---'}</span>
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

                    {/* Ảnh đại diện + Thiết lập */}
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
                                setEditData((prev) => ({ ...prev, featured_image: url, imageFile: file }));
                              }
                            }}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            className="shrink-0 rounded-xl"
                            onClick={() =>
                              setEditData((prev) => ({ ...prev, featured_image: '', imageFile: undefined }))
                            }
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
                        <div className="mt-2">
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

                    {/* Rich text editor */}
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
                </TabsContent>

                {/* Tab: SEO */}
                <TabsContent value="seo" className="space-y-5">
                  <div className="bg-white rounded-2xl border shadow-sm p-5 space-y-5">
                    {/* Meta Description + Keywords */}
                    <div className="grid grid-cols-12 gap-4">
                      <div className="col-span-8">
                        <Label>Meta Description (SEO)</Label>
                        <Textarea
                          className="mt-2 min-h-[60px] resize-y"
                          value={editData.meta_description || ''}
                          onChange={(e) => setEditData({ ...editData, meta_description: e.target.value })}
                          placeholder="Mô tả ngắn cho Google (120-160 ký tự)..."
                          maxLength={160}
                        />
                        <p className="mt-1 text-[11px] text-slate-500">
                          {editData.meta_description?.length || 0}/160 ký tự
                        </p>
                      </div>
                      <div className="col-span-4">
                        <Label>Meta Keywords</Label>
                        <Textarea
                          className="mt-2 min-h-[60px] resize-y"
                          value={editData.meta_keywords || ''}
                          onChange={(e) => setEditData({ ...editData, meta_keywords: e.target.value })}
                          placeholder="Từ khóa, cách nhau bằng dấu phẩy..."
                        />
                        <p className="mt-1 text-[11px] text-slate-500">Ví dụ: phim, rạp chiếu, review</p>
                      </div>
                    </div>

                    {/* SEO Title + Schema Type */}
                    <div className="grid grid-cols-12 gap-4">
                      <div className="col-span-6">
                        <Label>SEO Title</Label>
                        <Input
                          className="mt-2"
                          value={editData.seo_title || ''}
                          onChange={(e) => setEditData({ ...editData, seo_title: e.target.value })}
                          placeholder="Tiêu đề tùy chỉnh cho SEO (nếu khác tiêu đề chính)..."
                          maxLength={60}
                        />
                        <p className="mt-1 text-[11px] text-slate-500">{editData.seo_title?.length || 0}/60 ký tự</p>
                      </div>
                      <div className="col-span-6">
                        <Label>Schema Type</Label>
                        <select
                          className="mt-2 w-full px-3 py-2 border border-slate-200 rounded-xl bg-white text-sm"
                          value={editData.schema_type || 'Article'}
                          onChange={(e) => setEditData({ ...editData, schema_type: e.target.value })}
                        >
                          <option value="Article">Article</option>
                          <option value="NewsArticle">NewsArticle</option>
                          <option value="BlogPosting">BlogPosting</option>
                        </select>
                      </div>
                    </div>

                    {/* Canonical URL */}
                    <div>
                      <Label>Canonical URL</Label>
                      <Input
                        className="mt-2"
                        value={editData.canonical_url || ''}
                        onChange={(e) => setEditData({ ...editData, canonical_url: e.target.value })}
                        placeholder="URL chuẩn (canonical) để tránh trùng lặp nội dung..."
                      />
                    </div>

                    {/* OG Image */}
                    <div>
                      <Label>OG Image (Ảnh cho Facebook/Social)</Label>
                      <div className="mt-2 flex items-center gap-3">
                        <Input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) setEditData({ ...editData, ogImageFile: file });
                          }}
                          className="flex-1"
                        />
                        {editData.og_image && (
                          <img
                            src={editData.og_image}
                            alt="OG Preview"
                            className="w-16 h-16 object-cover rounded-lg border"
                          />
                        )}
                      </div>
                    </div>
                  </div>
                </TabsContent>

                {/* Tab: Preview */}
                <TabsContent value="preview" className="space-y-5">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Preview Card */}
                    <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
                      <div className="px-5 py-3 bg-slate-50 border-b flex items-center gap-2">
                        <ImageIcon className="w-4 h-4 text-slate-500" />
                        <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">
                          Preview thumbnail
                        </span>
                      </div>
                      <div className="p-5">
                        {/* Sử dụng og_image nếu có, fallback featured_image */}
                        {editData.og_image || editData.featured_image ? (
                          <img
                            src={editData.og_image || editData.featured_image}
                            alt="Preview"
                            className="w-full aspect-[16/10] rounded-xl object-cover border border-slate-200"
                          />
                        ) : (
                          <div className="w-full aspect-[16/10] rounded-xl border border-dashed border-slate-200 bg-slate-50 flex items-center justify-center text-slate-400 text-xs italic">
                            Chưa chọn ảnh
                          </div>
                        )}
                        <div className="mt-4 space-y-2">
                          {/* Sử dụng seo_title nếu có, fallback title */}
                          <p
                            className="text-sm font-black text-slate-900 line-clamp-1"
                            title={editData.seo_title?.trim() || editData.title?.trim() || ''}
                          >
                            {editData.seo_title?.trim() || editData.title?.trim() || 'Tiêu đề bài viết...'}
                          </p>
                          {/* Sử dụng meta_description nếu có, fallback excerpt */}
                          <p
                            className="text-xs text-slate-500 line-clamp-2"
                            title={editData.meta_description?.trim() || editData.excerpt?.trim() || ''}
                          >
                            {editData.meta_description?.trim() ||
                              editData.excerpt?.trim() ||
                              'Tóm tắt ngắn (excerpt) sẽ hiện ở danh sách / SEO...'}
                          </p>
                          {/* Hiển thị Schema Type */}
                          {editData.schema_type && (
                            <p className="text-[10px] text-slate-400 font-mono">Schema: {editData.schema_type}</p>
                          )}
                          {/* Hiển thị Canonical URL */}
                          {editData.canonical_url && (
                            <p className="text-[10px] text-blue-600 truncate" title={editData.canonical_url}>
                              Canonical: {editData.canonical_url}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Gợi ý nhập liệu */}
                    <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5">
                      <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-2">
                        Gợi ý nhập liệu
                      </p>
                      <ul className="text-xs text-slate-700 space-y-2 leading-relaxed">
                        <li>
                          <strong>Tiêu đề</strong>: 6–12 từ, rõ chủ đề. Tránh viết HOA toàn bộ.
                        </li>
                        <li>
                          <strong>Tóm tắt</strong>: 1–2 câu giúp người đọc hiểu nhanh.
                        </li>
                        <li>
                          <strong>Meta Description</strong>: 120-160 ký tự cho Google, khác với tóm tắt.
                        </li>
                        <li>
                          <strong>Meta Keywords</strong>: từ khóa cách nhau dấu phẩy.
                        </li>
                        <li>
                          <strong>SEO Title</strong>: tối đa 60 ký tự, khác tiêu đề chính nếu cần.
                        </li>
                        <li>
                          <strong>OG Image</strong>: ảnh riêng cho Facebook, tỉ lệ 1200x630.
                        </li>
                        <li>
                          <strong>Canonical URL</strong>: URL chuẩn để tránh duplicate content.
                        </li>
                        <li>
                          <strong>Schema Type</strong>: Article, NewsArticle, hoặc BlogPosting.
                        </li>
                      </ul>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </div>

          {/* Footer — cố định dưới cùng */}
          <div className="shrink-0 px-6 py-4 border-t bg-white flex items-center justify-between">
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
              {renderSaveButtons()}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Preview Dialog ───────────────────────────────────────────────────── */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-4xl w-[95vw] h-[90vh] p-0 overflow-hidden bg-white">
          <div className="h-full overflow-y-auto bg-slate-50">
            <article className="max-w-3xl mx-auto p-6 md:p-8 space-y-6">
              {editData.featured_image && (
                <img
                  src={editData.featured_image}
                  alt={editData.title || 'Ảnh đại diện bài viết'}
                  className="w-full aspect-[16/9] object-cover rounded-2xl border border-slate-200 shadow-sm"
                />
              )}
              <header className="space-y-3">
                <h1 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900">
                  {editData.title?.trim() || 'Tiêu đề bài viết'}
                </h1>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-700">
                    {editData.status === 'published'
                      ? 'Đã xuất bản'
                      : editData.status === 'archived'
                        ? 'Lưu trữ'
                        : 'Nháp'}
                  </span>
                  <span>{new Date().toLocaleDateString('vi-VN')}</span>
                </div>
                {editData.excerpt?.trim() && <p className="text-slate-600 leading-7">{editData.excerpt.trim()}</p>}
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
