import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Search, RefreshCw, Edit3, Trash2, Plus, FileText } from 'lucide-react';
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
import { Label } from '@/components/ui/label';
import { getPosts, createPostApi, updatePostApi, deletePostApi } from '@/lib/api';
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
  const [editData, setEditData] = useState<Partial<PostData> & { imageFile?: File }>({});
  const [isSaving, setIsSaving] = useState(false);

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

  const totalPages = useMemo(() => Math.max(1, Math.ceil(totalPosts / pageSize)), [totalPosts]);

  const handleCreate = () => {
    setEditData({
      id: 0,
      title: '',
      content: '',
      excerpt: '',
      status: 'draft',
      is_featured: false
    });
    setIsEditOpen(true);
  };

  const handleEdit = (post: PostData) => {
    setEditData(post);
    setIsEditOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Bạn có chắc chắn muốn xóa bài viết này?')) return;
    try {
      await deletePostApi(id);
      toast.success('Đã xóa bài viết');
      fetchPosts();
    } catch (error: any) {
      toast.error('Lỗi', { description: error?.message || 'Không thể xóa' });
    }
  };

  const handleSave = async () => {
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
      let imageBase64: string | undefined = undefined;
      if (editData.imageFile) {
        const file = editData.imageFile;
        imageBase64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.readAsDataURL(file);
        });
      }

      const payload = {
        title: editData.title!,
        content: editData.content!,
        excerpt: editData.excerpt,
        featured_image: editData.featured_image,
        image_base64: imageBase64,
        status: editData.status || 'draft',
        is_featured: editData.is_featured || false
      };

      if (editData.id) {
        await updatePostApi(editData.id, payload);
        toast.success('Cập nhật bài viết thành công');
      } else {
        await createPostApi(payload);
        toast.success('Tạo bài viết mới thành công');
      }

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
                <TableHead className="text-[10px] uppercase font-bold text-slate-500">Tiêu đề</TableHead>
                <TableHead className="text-[10px] uppercase font-bold text-slate-500 text-center">Trạng thái</TableHead>
                <TableHead className="text-[10px] uppercase font-bold text-slate-500 text-center">Xuất bản</TableHead>
                <TableHead className="text-right text-[10px] uppercase font-bold text-slate-500 pr-6">
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
                          <div className="font-bold text-slate-700">{post.title}</div>
                          {post.excerpt && <div className="text-xs text-slate-400 line-clamp-1">{post.excerpt}</div>}
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
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(post.id)}
                        className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Xóa"
                      >
                        <Trash2 size={16} />
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
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editData.id ? 'Chỉnh sửa bài viết' : 'Tạo bài viết mới'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Tiêu đề</Label>
              <Input
                className="mt-4"
                value={editData.title || ''}
                onChange={(e) => setEditData({ ...editData, title: e.target.value })}
                placeholder="Nhập tiêu đề bài viết..."
              />
            </div>
            <div>
              <Label>Tóm tắt</Label>
              <Input
                value={editData.excerpt || ''}
                onChange={(e) => setEditData({ ...editData, excerpt: e.target.value })}
                placeholder="Nhập tóm tắt ngắn..."
              />
            </div>
            <div>
              <Label>Ảnh đại diện</Label>
              <div className="flex gap-2 items-center">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const url = URL.createObjectURL(file);
                      setEditData({
                        ...editData,
                        featured_image: url,
                        imageFile: file
                      });
                    }
                  }}
                />
                {editData.featured_image && (
                  <img src={editData.featured_image} alt="Preview" className="w-16 h-16 rounded object-cover border" />
                )}
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
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Trạng thái</Label>
                <select
                  value={editData.status || 'draft'}
                  onChange={(e) => setEditData({ ...editData, status: e.target.value })}
                  className="w-full h-10 border rounded-md px-3"
                >
                  <option value="draft">Nháp</option>
                  <option value="published">Xuất bản</option>
                  <option value="archived">Lưu trữ</option>
                </select>
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Switch
                  checked={editData.is_featured || false}
                  onCheckedChange={(checked) => setEditData({ ...editData, is_featured: checked })}
                />
                <Label>Bài viết nổi bật</Label>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setIsEditOpen(false)}>
                Hủy
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? 'Đang lưu...' : editData.status === 'published' ? 'Xuất bản' : 'Lưu'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
