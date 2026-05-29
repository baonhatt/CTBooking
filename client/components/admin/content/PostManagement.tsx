import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import {
        Search,
        RefreshCw,
        Edit3,
        Plus,
        FileText,
        X,
        Image as ImageIcon,
        Link2,
        Eye,
        ArrowLeft,
        Save,
        ChevronDown,
        ChevronUp,
        Copy,
        Type,
        Link,
        Calendar,
        Share2,
        Globe
} from 'lucide-react';
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
        const [sections, setSections] = useState<{ publish: boolean; images: boolean; seo: boolean }>({ publish: true, images: true, seo: false });
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

        const toggleSection = (key: 'publish' | 'images' | 'seo') => {
                setSections((prev) => ({ ...prev, [key]: !prev[key] }));
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
                                                        placeholder="Tìm kiếm..."
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

                        {/* ── Edit / Create Dialog ───────────────────────────────────────────── */}
                        <Dialog
                                open={isEditOpen}
                                onOpenChange={(next) => {
                                        if (next) setIsEditOpen(true);
                                }}
                        >
                                <DialogContent
                                        className="max-w-7xl w-[95vw] h-[92vh] p-0 overflow-hidden bg-white flex flex-col [&>button]:hidden"
                                        onPointerDownOutside={(e) => e.preventDefault()}
                                        onInteractOutside={(e) => e.preventDefault()}
                                        onEscapeKeyDown={(e) => e.preventDefault()}
                                        onOpenAutoFocus={(e) => e.preventDefault()}
                                >
                                        {/* Sticky Header */}
                                        <div className="sticky top-0 z-10 bg-white border-b shadow-sm shrink-0">
                                                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                                                        <div className="flex items-center justify-between h-16">
                                                                <div className="flex items-center gap-4">
                                                                        <Button variant="ghost" size="icon" onClick={() => requestClose(false)} className="rounded-xl">
                                                                                <ArrowLeft className="w-5 h-5" />
                                                                        </Button>
                                                                        <div className="min-w-0">
                                                                                <h1 className="text-lg font-bold text-slate-900 truncate">
                                                                                        {editData.title || 'Bài viết chưa có tiêu đề'}
                                                                                </h1>
                                                                                <div className="flex items-center gap-2 mt-0.5">
                                                                                        <StatusBadge status={editData.status || 'draft'} />
                                                                                </div>
                                                                        </div>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                        {editData.status === 'published' ? (
                                                                                <Button
                                                                                        onClick={() => handleSave('archived')}
                                                                                        disabled={isSaving}
                                                                                        variant="outline"
                                                                                        className="rounded-xl"
                                                                                >
                                                                                        Gỡ phát hành
                                                                                </Button>
                                                                        ) : editData.status === 'archived' ? (
                                                                                <Button
                                                                                        onClick={() => handleSave('draft')}
                                                                                        disabled={isSaving}
                                                                                        variant="outline"
                                                                                        className="rounded-xl"
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
                                                                        <Button
                                                                                onClick={() => handleSave()}
                                                                                disabled={isSaving}
                                                                                className="rounded-xl bg-blue-600 hover:bg-blue-700"
                                                                        >
                                                                                <Save className="w-4 h-4 mr-2" />
                                                                                {isSaving ? 'Đang lưu...' : 'Lưu'}
                                                                        </Button>
                                                                </div>
                                                        </div>
                                                </div>
                                        </div>

                                        {/* Main Content */}
                                        <div className="flex-1 min-h-0 overflow-y-auto">
                                                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                                                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                                                                {/* Left Column - Editor (65%) */}
                                                                <div className="lg:col-span-8 space-y-6">
                                                                        <Card className="border-none shadow-sm">
                                                                                <CardContent className="p-6 space-y-6">
                                                                                        {/* Title */}
                                                                                        <div>
                                                                                                <Label className="flex items-center gap-2">
                                                                                                        <Type className="w-4 h-4 text-slate-500" />
                                                                                                        Tiêu đề bài viết
                                                                                                </Label>
                                                                                                <Input
                                                                                                        className="mt-2 text-lg font-semibold"
                                                                                                        value={editData.title || ''}
                                                                                                        onChange={(e) => setEditData({ ...editData, title: e.target.value })}
                                                                                                        placeholder="Nhập tiêu đề bài viết..."
                                                                                                />
                                                                                        </div>

                                                                                        {/* Slug */}
                                                                                        <div>
                                                                                                <Label className="flex items-center gap-2">
                                                                                                        <Link className="w-4 h-4 text-slate-500" />
                                                                                                        Đường dẫn URL
                                                                                                </Label>
                                                                                                <div className="mt-2 flex items-center gap-2">
                                                                                                        <span className="text-slate-400 text-sm">/bai-viet/</span>
                                                                                                        <Input
                                                                                                                className="flex-1 font-mono text-sm"
                                                                                                                value={editData.slug || ''}
                                                                                                                onChange={(e) => setEditData({ ...editData, slug: e.target.value })}
                                                                                                                placeholder="tu-dong-tao-tu-tieu-de"
                                                                                                        />
                                                                                                        <Button
                                                                                                                type="button"
                                                                                                                variant="outline"
                                                                                                                size="icon"
                                                                                                                onClick={() => setEditData({ ...editData, slug: makeSlug(editData.title || '') })}
                                                                                                                title="Tạo lại slug từ tiêu đề"
                                                                                                                className="shrink-0"
                                                                                                        >
                                                                                                                <RefreshCw className="w-4 h-4" />
                                                                                                        </Button>
                                                                                                </div>
                                                                                        </div>

                                                                                        {/* Rich Text Editor */}
                                                                                        <div>
                                                                                                <Label>Nội dung</Label>
                                                                                                <div className="mt-2">
                                                                                                        <PostRichTextEditor
                                                                                                                value={editData.content || ''}
                                                                                                                onChange={(content) => setEditData((prev) => ({ ...prev, content }))}
                                                                                                        />
                                                                                                </div>
                                                                                        </div>
                                                                                </CardContent>
                                                                        </Card>
                                                                </div>

                                                                {/* Right Column - Settings (35%) */}
                                                                <div className="lg:col-span-4 space-y-4">
                                                                        {/* Section 1: Publishing */}
                                                                        <Card className="border-none shadow-sm">
                                                                                <CardHeader
                                                                                        className="px-4 py-3 bg-slate-50 border-b cursor-pointer"
                                                                                        onClick={() => toggleSection('publish')}
                                                                                >
                                                                                        <div className="flex items-center justify-between">
                                                                                                <CardTitle className="text-sm font-bold">Xuất bản</CardTitle>
                                                                                                {sections.publish ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                                                                        </div>
                                                                                </CardHeader>
                                                                                {sections.publish && (
                                                                                        <CardContent className="p-4 space-y-4">
                                                                                                <div>
                                                                                                        <Label className="flex items-center gap-2">
                                                                                                                <FileText className="w-4 h-4 text-slate-500" />
                                                                                                                Trạng thái
                                                                                                        </Label>
                                                                                                        <select
                                                                                                                className="mt-2 w-full px-3 py-2 border border-slate-200 rounded-xl bg-white text-sm"
                                                                                                                value={editData.status || 'draft'}
                                                                                                                onChange={(e) => setEditData({ ...editData, status: e.target.value as any })}
                                                                                                        >
                                                                                                                <option value="draft">Bản nháp</option>
                                                                                                                <option value="published">Đã xuất bản</option>
                                                                                                                <option value="archived">Lưu trữ</option>
                                                                                                        </select>
                                                                                                </div>
                                                                                                <div className="flex items-center justify-between">
                                                                                                        <Label className="flex items-center gap-2">
                                                                                                                <Search className="w-4 h-4 text-slate-500" />
                                                                                                                Bài nổi bật
                                                                                                        </Label>
                                                                                                        <Switch
                                                                                                                checked={editData.is_featured || false}
                                                                                                                onCheckedChange={(checked) => setEditData({ ...editData, is_featured: checked })}
                                                                                                                className="data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-gray-300 cursor-pointer"
                                                                                                        />
                                                                                                </div>
                                                                                                <div>
                                                                                                        <Label className="flex items-center gap-2">
                                                                                                                <Calendar className="w-4 h-4 text-slate-500" />
                                                                                                                Ngày đăng
                                                                                                        </Label>
                                                                                                        <Input
                                                                                                                type="datetime-local"
                                                                                                                className="h-10 mt-2"
                                                                                                                value={editData.published_at ? new Date(editData.published_at).toISOString().slice(0, 16) : ''}
                                                                                                                onChange={(e) => setEditData({ ...editData, published_at: e.target.value })}
                                                                                                        />
                                                                                                </div>
                                                                                        </CardContent>
                                                                                )}
                                                                        </Card>

                                                                        {/* Section 2: Images & Summary */}
                                                                        <Card className="border-none shadow-sm">
                                                                                <CardHeader
                                                                                        className="px-4 py-3 bg-slate-50 border-b cursor-pointer"
                                                                                        onClick={() => toggleSection('images')}
                                                                                >
                                                                                        <div className="flex items-center justify-between">
                                                                                                <CardTitle className="text-sm font-bold">Hình ảnh & Tóm tắt</CardTitle>
                                                                                                {sections.images ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                                                                        </div>
                                                                                </CardHeader>
                                                                                {sections.images && (
                                                                                        <CardContent className="p-4 space-y-4">
                                                                                                <div>
                                                                                                        <Label className="flex items-center gap-2">
                                                                                                                <ImageIcon className="w-4 h-4 text-slate-500" />
                                                                                                                Ảnh đại diện
                                                                                                        </Label>
                                                                                                        <div className="mt-2 flex items-center gap-2">
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
                                                                                                                        variant="outline"
                                                                                                                        size="sm"
                                                                                                                        onClick={() => setEditData((prev) => ({ ...prev, featured_image: '', imageFile: undefined }))}
                                                                                                                        disabled={!editData.featured_image}
                                                                                                                >
                                                                                                                        Gỡ
                                                                                                                </Button>
                                                                                                        </div>
                                                                                                        <p className="mt-2 text-[11px] text-slate-500">Ảnh hiển thị trong danh sách và khi chia sẻ</p>
                                                                                                        {editData.featured_image && (
                                                                                                                <img
                                                                                                                        src={editData.featured_image}
                                                                                                                        alt="Preview"
                                                                                                                        className="mt-2 w-full aspect-video object-cover rounded-lg border cursor-pointer hover:opacity-80 transition-opacity"
                                                                                                                        onClick={() => window.open(editData.featured_image, '_blank')}
                                                                                                                        title="Click để xem ảnh lớn"
                                                                                                                />
                                                                                                        )}
                                                                                                </div>
                                                                                                <div>
                                                                                                        <Label className="flex items-center gap-2">
                                                                                                                <FileText className="w-4 h-4 text-slate-500" />
                                                                                                                Tóm tắt
                                                                                                        </Label>
                                                                                                        <Textarea
                                                                                                                className="mt-2 min-h-[80px] resize-y"
                                                                                                                value={editData.excerpt || ''}
                                                                                                                onChange={(e) => setEditData({ ...editData, excerpt: e.target.value })}
                                                                                                                placeholder="1-2 câu mô tả ngắn, hiển thị ngoài danh sách"
                                                                                                        />
                                                                                                </div>
                                                                                        </CardContent>
                                                                                )}
                                                                        </Card>

                                                                        {/* Section 3: SEO & Sharing */}
                                                                        <Card className="border-none shadow-sm">
                                                                                <CardHeader
                                                                                        className="px-4 py-3 bg-slate-50 border-b cursor-pointer"
                                                                                        onClick={() => toggleSection('seo')}
                                                                                >
                                                                                        <div className="flex items-center justify-between">
                                                                                                <CardTitle className="text-sm font-bold">SEO & Chia sẻ</CardTitle>
                                                                                                {sections.seo ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                                                                        </div>
                                                                                </CardHeader>
                                                                                {sections.seo && (
                                                                                        <CardContent className="p-4 space-y-4">
                                                                                                <div>
                                                                                                        <Label className="flex items-center gap-2">
                                                                                                                <Search className="w-4 h-4 text-slate-500" />
                                                                                                                Tiêu đề trên Google
                                                                                                        </Label>
                                                                                                        <div className="mt-2 flex items-center gap-2">
                                                                                                                <Input
                                                                                                                        className="flex-1"
                                                                                                                        value={editData.seo_title || ''}
                                                                                                                        onChange={(e) => setEditData({ ...editData, seo_title: e.target.value })}
                                                                                                                        placeholder="Ví dụ: Phim 8 Kỳ Quan | Cinesphere"
                                                                                                                        maxLength={60}
                                                                                                                />
                                                                                                                <Button
                                                                                                                        type="button"
                                                                                                                        variant="outline"
                                                                                                                        size="icon"
                                                                                                                        onClick={() => setEditData({ ...editData, seo_title: editData.title || '' })}
                                                                                                                        title="Sao chép từ tiêu đề bài viết"
                                                                                                                        className="shrink-0"
                                                                                                                >
                                                                                                                        <Copy className="w-4 h-4" />
                                                                                                                </Button>
                                                                                                        </div>
                                                                                                        <div className="mt-1 flex items-center justify-between">
                                                                                                                <p className="text-[11px] text-amber-600">{editData.seo_title?.length || 0}/60 ký tự</p>
                                                                                                                <p className="text-[11px] text-slate-400">Ấn icon để sao chép từ tiêu đề bài viết</p>
                                                                                                        </div>
                                                                                                </div>
                                                                                                <div>
                                                                                                        <Label className="flex items-center gap-2">
                                                                                                                <FileText className="w-4 h-4 text-slate-500" />
                                                                                                                Mô tả trên Google
                                                                                                        </Label>
                                                                                                        <div className="mt-2 flex items-start gap-2">
                                                                                                                <Textarea
                                                                                                                        className="flex-1 min-h-[80px] resize-y"
                                                                                                                        value={editData.meta_description || ''}
                                                                                                                        onChange={(e) => setEditData({ ...editData, meta_description: e.target.value })}
                                                                                                                        placeholder="Tóm tắt ngắn 120-160 ký tự giúp tăng click từ Google"
                                                                                                                        maxLength={160}
                                                                                                                />
                                                                                                                <Button
                                                                                                                        type="button"
                                                                                                                        variant="outline"
                                                                                                                        size="icon"
                                                                                                                        onClick={() => {
                                                                                                                                if (editData.excerpt) {
                                                                                                                                        if (editData.excerpt.length > 160) {
                                                                                                                                                if (
                                                                                                                                                        confirm(
                                                                                                                                                                `Tóm tắt dài ${editData.excerpt.length} ký tự. Chỉ có thể copy tối đa 160 ký tự. Bạn có muốn tiếp tục?`
                                                                                                                                                        )
                                                                                                                                                ) {
                                                                                                                                                        setEditData({ ...editData, meta_description: editData.excerpt.slice(0, 160) });
                                                                                                                                                }
                                                                                                                                        } else {
                                                                                                                                                setEditData({ ...editData, meta_description: editData.excerpt });
                                                                                                                                        }
                                                                                                                                }
                                                                                                                        }}
                                                                                                                        title="Sao chép từ tóm tắt"
                                                                                                                        className="shrink-0"
                                                                                                                >
                                                                                                                        <Copy className="w-4 h-4" />
                                                                                                                </Button>
                                                                                                        </div>
                                                                                                        <div className="mt-1 flex items-center justify-between">
                                                                                                                <p className="text-[11px] text-amber-600">{editData.meta_description?.length || 0}/160 ký tự</p>
                                                                                                                <p className="text-[11px] text-slate-400">Ấn icon để sao chép từ tóm tắt bài viết</p>
                                                                                                        </div>
                                                                                                </div>
                                                                                                <div>
                                                                                                        <Label className="flex items-center gap-2">
                                                                                                                <Search className="w-4 h-4 text-slate-500" />
                                                                                                                Từ khóa
                                                                                                        </Label>
                                                                                                        <Input
                                                                                                                className="mt-2"
                                                                                                                value={editData.meta_keywords || ''}
                                                                                                                onChange={(e) => setEditData({ ...editData, meta_keywords: e.target.value })}
                                                                                                                placeholder="phim, rạp chiếu, review"
                                                                                                        />
                                                                                                </div>
                                                                                                <div>
                                                                                                        <Label className="flex items-center gap-2">
                                                                                                                <Share2 className="w-4 h-4 text-slate-500" />
                                                                                                                Ảnh khi chia sẻ Facebook/Zalo
                                                                                                        </Label>
                                                                                                        <div className="mt-2 flex items-center gap-2">
                                                                                                                <Input
                                                                                                                        type="file"
                                                                                                                        accept="image/*"
                                                                                                                        onChange={(e) => {
                                                                                                                                const file = e.target.files?.[0];
                                                                                                                                if (file) setEditData({ ...editData, ogImageFile: file });
                                                                                                                        }}
                                                                                                                />
                                                                                                                {editData.og_image && (
                                                                                                                        <img
                                                                                                                                src={editData.og_image}
                                                                                                                                alt="OG Preview"
                                                                                                                                className="w-12 h-12 object-cover rounded border cursor-pointer hover:opacity-80 transition-opacity"
                                                                                                                                onClick={() => window.open(editData.og_image, '_blank')}
                                                                                                                                title="Click để xem ảnh lớn"
                                                                                                                        />
                                                                                                                )}
                                                                                                        </div>
                                                                                                </div>
                                                                                                <div>
                                                                                                        <Label className="flex items-center gap-2">
                                                                                                                <Globe className="w-4 h-4 text-slate-500" />
                                                                                                                URL chuẩn
                                                                                                        </Label>
                                                                                                        <div className="mt-2 flex items-center gap-2">
                                                                                                                <Input
                                                                                                                        className="flex-1"
                                                                                                                        value={editData.canonical_url || ''}
                                                                                                                        onChange={(e) => setEditData({ ...editData, canonical_url: e.target.value })}
                                                                                                                        placeholder="https://cinesphere.com.vn/bai-viet/ten-bai-viet"
                                                                                                                />
                                                                                                                <Button
                                                                                                                        type="button"
                                                                                                                        variant="outline"
                                                                                                                        size="icon"
                                                                                                                        onClick={() =>
                                                                                                                                setEditData({
                                                                                                                                        ...editData,
                                                                                                                                        canonical_url: editData.slug ? `https://cinesphere.com.vn/bai-viet/${editData.slug}` : ''
                                                                                                                                })
                                                                                                                        }
                                                                                                                        title="Sao chép URL bài viết"
                                                                                                                        className="shrink-0"
                                                                                                                >
                                                                                                                        <Copy className="w-4 h-4" />
                                                                                                                </Button>
                                                                                                        </div>
                                                                                                        <p className="mt-1 text-[11px] text-slate-400">Ấn icon để sao chép URL bài viết</p>
                                                                                                </div>
                                                                                                <div>
                                                                                                        <Label className="flex items-center gap-2">
                                                                                                                <FileText className="w-4 h-4 text-slate-500" />
                                                                                                                Loại nội dung
                                                                                                        </Label>
                                                                                                        <select
                                                                                                                className="mt-2 w-full px-3 py-2 border border-slate-200 rounded-xl bg-white text-sm"
                                                                                                                value={editData.schema_type || 'Article'}
                                                                                                                onChange={(e) => setEditData({ ...editData, schema_type: e.target.value })}
                                                                                                        >
                                                                                                                <option value="Article">Bài viết</option>
                                                                                                                <option value="NewsArticle">Tin tức</option>
                                                                                                                <option value="BlogPosting">Blog</option>
                                                                                                        </select>
                                                                                                </div>
                                                                                        </CardContent>
                                                                                )}
                                                                        </Card>
                                                                </div>
                                                        </div>
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
