import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AdminLayout from '@/admin/layouts/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
        ArrowLeft,
        Save,
        Eye,
        ChevronDown,
        ChevronUp,
        Copy,
        Type,
        Link,
        Calendar,
        Image as ImageIcon,
        FileText,
        Search,
        Share2,
        Globe,
        RefreshCw
} from 'lucide-react';
import { PostRichTextEditor } from '@/components/admin/content/PostRichTextEditor';
import { getPosts, updatePostApi, getPostById } from '@/lib/api';
import { uploadDirectToCloudinary } from '@/lib/api/uploads';
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

interface SectionState {
        publish: boolean;
        images: boolean;
        seo: boolean;
}

export default function PostEditPage() {
        const { id } = useParams<{ id: string }>();
        const navigate = useNavigate();
        const [active, setActive] = useState<
                | 'dashboard'
                | 'users'
                | 'movies'
                | 'toys'
                | 'posts'
                | 'transactions'
                | 'tickets'
                | 'ticket-check'
                | 'uploads'
                | 'email-logs'
                | 'settings'
                | 'branches'
                | 'staff'
                | 'roles'
                | 'audit-logs'
        >('posts');
        const [isLoading, setIsLoading] = useState(true);
        const [isSaving, setIsSaving] = useState(false);
        const [editData, setEditData] = useState<Partial<PostData> & { imageFile?: File; ogImageFile?: File }>({});
        const [sections, setSections] = useState<SectionState>({ publish: true, images: true, seo: false });
        const initialSnapshotRef = useRef<string>('');

        const adminEmail = localStorage.getItem('adminEmail') || '';

        const handleLogout = () => {
                localStorage.removeItem('adminToken');
                localStorage.removeItem('adminEmail');
                window.dispatchEvent(new Event('admin-auth-changed'));
                window.location.href = '/';
        };

        const makeSlug = (title: string) =>
                title
                        .toLowerCase()
                        .replace(/[đĐ]/g, 'd')
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
                        slug: data.slug ?? '',
                        content: data.content ?? '',
                        excerpt: data.excerpt ?? '',
                        featured_image: data.featured_image ?? '',
                        status: data.status ?? 'draft',
                        is_featured: Boolean(data.is_featured),
                        published_at: data.published_at ?? '',
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

        const getChangedFields = () => {
                if (!initialSnapshotRef.current) return {};
                const initial = JSON.parse(initialSnapshotRef.current);
                const current = editData;
                const changed: Record<string, boolean> = {};
                const fields = [
                        'title',
                        'slug',
                        'content',
                        'excerpt',
                        'featured_image',
                        'status',
                        'is_featured',
                        'published_at',
                        'meta_description',
                        'meta_keywords',
                        'seo_title',
                        'og_image',
                        'canonical_url',
                        'schema_type'
                ];
                fields.forEach((field) => {
                        if (initial[field] !== current[field]) {
                                changed[field] = true;
                        }
                });
                return changed;
        };

        const changedFields = getChangedFields();

        const isFieldChanged = (field: string) => changedFields[field];

        const fetchPost = async () => {
                if (!id) return;
                setIsLoading(true);
                try {
                        const { post } = await getPostById(id);
                        if (post) {
                                setEditData(post);
                                initialSnapshotRef.current = snapshotEditData(post);
                        } else {
                                toast.error('Không tìm thấy bài viết');
                                navigate('/posts');
                        }
                } catch (error: any) {
                        toast.error('Lỗi', { description: error?.message || 'Không thể tải bài viết' });
                } finally {
                        setIsLoading(false);
                }
        };

        useEffect(() => {
                fetchPost();
        }, [id]);

        // Auto-generate slug from title
        useEffect(() => {
                if (editData.title && !editData.slug) {
                        setEditData((prev) => ({ ...prev, slug: makeSlug(editData.title!) }));
                }
        }, [editData.title]);

        // Update canonical URL placeholder based on slug
        const canonicalPlaceholder = editData.slug ? `https://cinesphere.com.vn/bai-viet/${editData.slug}` : '';

        // Unsaved changes warning
        useEffect(() => {
                const handleBeforeUnload = (e: BeforeUnloadEvent) => {
                        if (hasUnsavedChanges()) {
                                e.preventDefault();
                                e.returnValue = '';
                        }
                };
                window.addEventListener('beforeunload', handleBeforeUnload);
                return () => window.removeEventListener('beforeunload', handleBeforeUnload);
        }, [editData]);

        const handleSave = async (overrideStatus?: 'draft' | 'published' | 'archived') => {
                if (!editData.title?.trim()) {
                        toast.error('Lỗi', { description: 'Vui lòng nhập tiêu đề' });
                        return;
                }
                if (!editData.content?.trim()) {
                        toast.error('Lỗi', { description: 'Vui lòng nhập nội dung' });
                        return;
                }

                setIsSaving(true);
                try {
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

                        const nextStatus: 'draft' | 'published' | 'archived' = overrideStatus || (editData.status as any) || 'draft';

                        const payload = {
                                title: editData.title!,
                                slug: editData.slug,
                                content: editData.content!,
                                excerpt: editData.excerpt,
                                featured_image: featuredImageUrl,
                                og_image: ogImageUrl,
                                status: nextStatus,
                                is_featured: editData.is_featured || false,
                                published_at: editData.published_at,
                                meta_description: editData.meta_description,
                                meta_keywords: editData.meta_keywords,
                                seo_title: editData.seo_title,
                                canonical_url: editData.canonical_url,
                                schema_type: editData.schema_type
                        };

                        await updatePostApi(parseInt(id!), payload);
                        toast.success('Cập nhật bài viết thành công');
                        initialSnapshotRef.current = snapshotEditData({ ...editData, imageFile: undefined, ogImageFile: undefined });
                        fetchPost();
                } catch (error: any) {
                        toast.error('Lỗi', { description: error?.message || 'Có lỗi xảy ra' });
                } finally {
                        setIsSaving(false);
                }
        };

        const toggleSection = (key: keyof SectionState) => {
                setSections((prev) => ({ ...prev, [key]: !prev[key] }));
        };

        const getMetaDescriptionColor = () => {
                const len = editData.meta_description?.length || 0;
                if (len >= 120 && len <= 160) return 'text-emerald-600';
                if (len < 120) return 'text-amber-600';
                return 'text-red-600';
        };

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

        if (isLoading) {
                return (
                        <AdminLayout active={active} setActive={setActive} adminEmailState={adminEmail} handleLogout={handleLogout}>
                                <div className="flex items-center justify-center h-96">
                                        <div className="text-slate-500">Đang tải...</div>
                                </div>
                        </AdminLayout>
                );
        }

        return (
                <AdminLayout active={active} setActive={setActive} adminEmailState={adminEmail} handleLogout={handleLogout}>
                        <div className="min-h-screen bg-slate-50">
                                {/* Sticky Header */}
                                <div className="sticky top-0 z-10 bg-white border-b shadow-sm">
                                        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                                                <div className="flex items-center justify-between h-16">
                                                        <div className="flex items-center gap-4">
                                                                <Button variant="ghost" size="icon" onClick={() => navigate('/posts')} className="rounded-xl" title="Quay lại">
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
                                                                        <>
                                                                                <Button
                                                                                        onClick={() => handleSave('archived')}
                                                                                        disabled={isSaving}
                                                                                        variant="outline"
                                                                                        className="rounded-xl"
                                                                                >
                                                                                        Gỡ xuất bản
                                                                                </Button>
                                                                                <Button
                                                                                        onClick={() => handleSave()}
                                                                                        disabled={isSaving}
                                                                                        className="rounded-xl bg-blue-600 hover:bg-blue-700"
                                                                                >
                                                                                        <Save className="w-4 h-4 mr-2" />
                                                                                        {isSaving ? 'Đang lưu...' : 'Lưu'}
                                                                                </Button>
                                                                        </>
                                                                ) : editData.status === 'draft' ? (
                                                                        <>
                                                                                <Button
                                                                                        onClick={() => handleSave('published')}
                                                                                        disabled={isSaving}
                                                                                        className="rounded-xl bg-emerald-600 hover:bg-emerald-700"
                                                                                >
                                                                                        Xuất bản
                                                                                </Button>
                                                                                <Button
                                                                                        onClick={() => handleSave()}
                                                                                        disabled={isSaving}
                                                                                        variant="outline"
                                                                                        className="rounded-xl"
                                                                                >
                                                                                        <Save className="w-4 h-4 mr-2" />
                                                                                        {isSaving ? 'Đang lưu...' : 'Lưu'}
                                                                                </Button>
                                                                        </>
                                                                ) : editData.status === 'archived' ? (
                                                                        <>
                                                                                <Button
                                                                                        onClick={() => handleSave('draft')}
                                                                                        disabled={isSaving}
                                                                                        variant="outline"
                                                                                        className="rounded-xl"
                                                                                >
                                                                                        Lưu nháp
                                                                                </Button>
                                                                                <Button
                                                                                        onClick={() => handleSave('published')}
                                                                                        disabled={isSaving}
                                                                                        className="rounded-xl bg-emerald-600 hover:bg-emerald-700"
                                                                                >
                                                                                        Xuất bản
                                                                                </Button>
                                                                                <Button
                                                                                        onClick={() => handleSave()}
                                                                                        disabled={isSaving}
                                                                                        variant="outline"
                                                                                        className="rounded-xl"
                                                                                >
                                                                                        <Save className="w-4 h-4 mr-2" />
                                                                                        {isSaving ? 'Đang lưu...' : 'Lưu'}
                                                                                </Button>
                                                                        </>
                                                                ) : null}
                                                        </div>
                                                </div>
                                        </div>
                                </div>

                                {/* Main Content */}
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
                                                                                        className={`mt-2 text-lg font-semibold ${isFieldChanged('title') ? 'border-amber-500 ring-1 ring-amber-500' : ''}`}
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
                                                                                                className={`flex-1 font-mono text-sm ${isFieldChanged('slug') ? 'border-amber-500 ring-1 ring-amber-500' : ''}`}
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
                                                                                <div
                                                                                        className={`mt-2 ${isFieldChanged('content') ? 'border-amber-500 ring-1 ring-amber-500 rounded-lg' : ''}`}
                                                                                >
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
                                                                                <div className="flex items-center justify-between">
                                                                                        <Label className="flex items-center gap-2">
                                                                                                <Search className="w-4 h-4 text-slate-500" />
                                                                                                Bài nổi bật
                                                                                        </Label>
                                                                                        <Switch
                                                                                                checked={editData.is_featured || false}
                                                                                                onCheckedChange={(checked) => setEditData({ ...editData, is_featured: checked })}
                                                                                                className="data-[state=checked]:bg-emerald-600"
                                                                                        />
                                                                                </div>
                                                                                <div>
                                                                                        <Label className="flex items-center gap-2">
                                                                                                <Calendar className="w-4 h-4 text-slate-500" />
                                                                                                Ngày đăng
                                                                                        </Label>
                                                                                        <Input
                                                                                                type="datetime-local"
                                                                                                className={`mt-2 ${isFieldChanged('published_at') ? 'border-amber-500 ring-1 ring-amber-500' : ''}`}
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
                                                                                        <div
                                                                                                className={`mt-2 flex items-center gap-2 ${isFieldChanged('featured_image') ? 'border-amber-500 ring-1 ring-amber-500 p-2 rounded-lg' : ''}`}
                                                                                        >
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
                                                                                                className={`mt-2 min-h-[80px] resize-y ${isFieldChanged('excerpt') ? 'border-amber-500 ring-1 ring-amber-500' : ''}`}
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
                                                                                                        className={`flex-1 ${isFieldChanged('seo_title') ? 'border-amber-500 ring-1 ring-amber-500' : ''}`}
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
                                                                                                        className={`flex-1 min-h-[80px] resize-y ${isFieldChanged('meta_description') ? 'border-amber-500 ring-1 ring-amber-500' : ''}`}
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
                                                                                                className={`mt-2 ${isFieldChanged('meta_keywords') ? 'border-amber-500 ring-1 ring-amber-500' : ''}`}
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
                                                                                        <div
                                                                                                className={`mt-2 flex items-center gap-2 ${isFieldChanged('og_image') ? 'border-amber-500 ring-1 ring-amber-500 p-2 rounded-lg' : ''}`}
                                                                                        >
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
                                                                                                        className={`flex-1 ${isFieldChanged('canonical_url') ? 'border-amber-500 ring-1 ring-amber-500' : ''}`}
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
                                                                                                className={`mt-2 w-full px-3 py-2 border border-slate-200 rounded-xl bg-white text-sm ${isFieldChanged('schema_type') ? 'border-amber-500 ring-1 ring-amber-500' : ''}`}
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
                </AdminLayout>
        );
}
