import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useStaffPermissions, useIsSuperAdmin } from '@/hooks/useStaffPermission';
import AdminLayout from '@/admin/layouts/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { BranchMultiSelect } from '@/components/admin/BranchMultiSelect';
import { ConfirmDialog } from '@/components/admin/common/ConfirmDialog';
import { FormField } from '@/components/admin/common/FormField';
import { PageHeader } from '@/components/admin/common/PageHeader';
import { StatusBadge } from '@/components/admin/common/StatusBadge';
import { notify } from '@/components/admin/common/notify';
import { ADMIN_BTN_OUTLINE, ADMIN_BTN_PRIMARY, ADMIN_CARD, ADMIN_INPUT, ADMIN_TEXT } from '@/components/admin/common/adminTokens';
import { formatToVNDatetimeLocal, vnDatetimeLocalToUTC } from '@/lib/utils';
import { getPublicPostUrl, getPublicSiteBaseUrl } from '@/lib/site-url';
import { ArrowLeft, ChevronDown, ChevronUp, Copy, Eye, RefreshCw } from 'lucide-react';
import { PostRichTextEditor } from '@/components/admin/content/PostRichTextEditor';
import { updatePostApi, getPostById, getAdminBranchOptions } from '@/lib/api';
import { formatVnDateTime } from '@/lib/format';
import { uploadDirectToCloudinary } from '@/lib/api/uploads';

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
  // null = all branches
  branch_ids?: number[] | null;
}

interface SectionState {
  publish: boolean;
  images: boolean;
  seo: boolean;
}

// Shared look of the form controls on this page
const POST_TEXTAREA_CLASS = 'min-h-[80px] resize-y rounded-xl border-slate-300 text-sm';
const POST_SELECT_CLASS =
  'h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/20 focus-visible:border-blue-600 disabled:cursor-not-allowed disabled:opacity-50';
const POST_ICON_BUTTON_CLASS = 'h-10 w-10 shrink-0 rounded-xl border-slate-200 text-slate-600 hover:bg-slate-50';
const POST_HINT_CLASS = 'text-xs text-slate-500';
// Publish action: outline button with a green accent (blue stays for the main save action)
const POST_PUBLISH_BUTTON_CLASS = `${ADMIN_BTN_OUTLINE} border-emerald-300 text-emerald-700 hover:bg-emerald-50`;

// Collapsible card of the right column (header toggles the body)
function CollapsibleCard({
  title,
  open,
  onToggle,
  children
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className={`${ADMIN_CARD} overflow-hidden`}>
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className={`flex w-full items-center justify-between bg-slate-50 px-4 py-3 text-left ${open ? 'border-b border-slate-200' : ''}`}
      >
        <span className="text-xs font-bold uppercase tracking-wide text-slate-500">{title}</span>
        {open ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
      </button>
      {open && <div className="space-y-4 p-4">{children}</div>}
    </div>
  );
}

export default function PostEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isSuperAdmin = useIsSuperAdmin();
  const permissions = useStaffPermissions();

  const hasPermission = (module: string, action: string) => {
    if (isSuperAdmin) return true;
    return permissions.some((p) => p.module === module && p.action === action);
  };
  
  const canEdit = hasPermission('posts', 'edit');
  const initialMode = searchParams.get('mode') || 'edit';
  const [isEditMode, setIsEditMode] = useState(canEdit ? initialMode === 'edit' : false);
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
  // Facts about the saved post (shown read-only; they are not part of the editable form)
  const [postInfo, setPostInfo] = useState<{
    view_count?: number;
    created_at?: string;
    updated_at?: string;
    created_by_staff_name?: string | null;
    updated_by_staff_name?: string | null;
  } | null>(null);
  const [branchOptions, setBranchOptions] = useState<Array<{ id: number; name: string }>>([]);
  const [isMetaCutConfirmOpen, setIsMetaCutConfirmOpen] = useState(false);
  const [isLeaveConfirmOpen, setIsLeaveConfirmOpen] = useState(false);

  // Branches the staff member can pick (the list is already limited to their branches by the server)
  useEffect(() => {
    getAdminBranchOptions({ includeInactive: true })
      .then((res) => setBranchOptions(res.items || []))
      .catch(() => setBranchOptions([]));
  }, []);

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
      branch_ids: data.branch_ids ?? null,
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

  // Back: leave at once, or ask first when there are unsaved changes
  const askLeave = () => {
    if (isSaving) return;
    if (initialSnapshotRef.current !== '' && hasUnsavedChanges()) {
      setIsLeaveConfirmOpen(true);
    } else {
      navigate('/posts');
    }
  };

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
      'schema_type',
      'branch_ids'
    ];
    fields.forEach((field) => {
      const initial_value = initial[field];
      const current_value = (current as any)[field];
      // Arrays (branch_ids) are compared by content, not by reference
      const is_changed =
        Array.isArray(initial_value) || Array.isArray(current_value)
          ? [...(initial_value ?? [])].sort().join(',') !== [...(current_value ?? [])].sort().join(',')
          : initial_value !== current_value;
      if (is_changed) {
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
        setPostInfo({
          view_count: post.view_count,
          created_at: post.created_at,
          updated_at: post.updated_at,
          created_by_staff_name: post.created_by_staff_name,
          updated_by_staff_name: post.updated_by_staff_name
        });
        initialSnapshotRef.current = snapshotEditData(post);
      } else {
        notify.error('Không tìm thấy bài viết');
        navigate('/posts');
      }
    } catch (error: any) {
      notify.error(error, 'Không thể tải bài viết');
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
    if (!isEditMode) return;
    if (!editData.title?.trim()) {
      notify.error('Vui lòng nhập tiêu đề');
      return;
    }
    if (!editData.content?.trim()) {
      notify.error('Vui lòng nhập nội dung');
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
          notify.error(uploadErr, 'Không thể tải ảnh lên');
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
          notify.error(uploadErr, 'Không thể tải ảnh OG');
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
        branch_ids: editData.branch_ids ?? null,
        meta_description: editData.meta_description,
        meta_keywords: editData.meta_keywords,
        seo_title: editData.seo_title,
        canonical_url: editData.canonical_url,
        schema_type: editData.schema_type
      };

      await updatePostApi(parseInt(id!), payload);
      notify.saved('bài viết');
      initialSnapshotRef.current = snapshotEditData({ ...editData, imageFile: undefined, ogImageFile: undefined });
      fetchPost();
    } catch (error: any) {
      notify.error(error, 'Có lỗi xảy ra');
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

  // Highlight of a field changed since the last save
  const changedClass = (field: string) => (isFieldChanged(field) ? 'border-amber-500 ring-1 ring-amber-500' : '');

  const currentStatus = editData.status || 'draft';
  const statusBadge =
    currentStatus === 'published' || currentStatus === 'draft' ? (
      <StatusBadge status={currentStatus} />
    ) : (
      <StatusBadge tone="neutral">Lưu trữ</StatusBadge>
    );

  const cancelEdit = () => {
    setIsEditMode(false);
    setSearchParams({ mode: 'view' });
    if (initialSnapshotRef.current) {
      setEditData(JSON.parse(initialSnapshotRef.current));
    }
  };

  const saveLabel = isSaving ? ADMIN_TEXT.busy : ADMIN_TEXT.save;

  if (isLoading) {
    return (
      <AdminLayout active={active} setActive={setActive} adminEmailState={adminEmail} handleLogout={handleLogout}>
        <div className="flex h-96 items-center justify-center">
          <div className="text-slate-500">{ADMIN_TEXT.loading}</div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout active={active} setActive={setActive} adminEmailState={adminEmail} handleLogout={handleLogout}>
      <div className="min-h-screen bg-slate-50">
        {/* HEADER (sticky) */}
        <div className="sticky top-0 z-10 border-b border-slate-200 bg-white">
          <div className="mx-auto max-w-7xl px-4 pt-4 sm:px-6 lg:px-8 [&>div]:mb-0 [&>div]:pb-4">
            <PageHeader
              title={editData.title || 'Bài viết chưa có tiêu đề'}
              description={statusBadge}
              leading={
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={askLeave}
                  className="rounded-full"
                  title="Quay lại"
                  aria-label="Quay lại danh sách bài viết"
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              }
              actions={
                isEditMode ? (
                  <>
                    <Button variant="outline" onClick={cancelEdit} disabled={isSaving} className={ADMIN_BTN_OUTLINE}>
                      {ADMIN_TEXT.cancel}
                    </Button>
                    {editData.status === 'published' ? (
                      <>
                        <Button onClick={() => handleSave('archived')} disabled={isSaving} variant="outline" className={ADMIN_BTN_OUTLINE}>
                          Gỡ xuất bản
                        </Button>
                        <Button onClick={() => handleSave()} disabled={isSaving} className={ADMIN_BTN_PRIMARY}>
                          {saveLabel}
                        </Button>
                      </>
                    ) : editData.status === 'draft' ? (
                      <>
                        <Button onClick={() => handleSave('published')} disabled={isSaving} variant="outline" className={POST_PUBLISH_BUTTON_CLASS}>
                          Xuất bản
                        </Button>
                        <Button onClick={() => handleSave()} disabled={isSaving} className={ADMIN_BTN_PRIMARY}>
                          {saveLabel}
                        </Button>
                      </>
                    ) : editData.status === 'archived' ? (
                      <>
                        <Button onClick={() => handleSave('draft')} disabled={isSaving} variant="outline" className={ADMIN_BTN_OUTLINE}>
                          Lưu nháp
                        </Button>
                        <Button onClick={() => handleSave('published')} disabled={isSaving} variant="outline" className={POST_PUBLISH_BUTTON_CLASS}>
                          Xuất bản
                        </Button>
                        <Button onClick={() => handleSave()} disabled={isSaving} className={ADMIN_BTN_PRIMARY}>
                          {saveLabel}
                        </Button>
                      </>
                    ) : null}
                  </>
                ) : (
                  canEdit && (
                    <Button
                      onClick={() => {
                        setIsEditMode(true);
                        setSearchParams({ mode: 'edit' });
                      }}
                      className={ADMIN_BTN_PRIMARY}
                    >
                      {ADMIN_TEXT.edit}
                    </Button>
                  )
                )
              }
            />
          </div>
        </div>

        {/* READ-ONLY FACTS ABOUT THE POST */}
        {postInfo && (
          <div className="border-b border-slate-200 bg-white">
            <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-1 px-4 py-2 text-xs text-slate-500 sm:px-6 lg:px-8">
              <span className="inline-flex items-center gap-1.5">
                <Eye className="h-3.5 w-3.5" />
                <b className="text-slate-700">{(postInfo.view_count || 0).toLocaleString('vi-VN')}</b> lượt xem
              </span>
              <span>
                Tạo lúc <b className="text-slate-700">{formatVnDateTime(postInfo.created_at)}</b>
                {postInfo.created_by_staff_name ? ` bởi ${postInfo.created_by_staff_name}` : ''}
              </span>
              <span>
                Cập nhật lúc <b className="text-slate-700">{formatVnDateTime(postInfo.updated_at)}</b>
                {postInfo.updated_by_staff_name ? ` bởi ${postInfo.updated_by_staff_name}` : ''}
              </span>
            </div>
          </div>
        )}

        {/* MAIN CONTENT */}
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* LEFT COLUMN - EDITOR */}
            <div className="space-y-6 lg:col-span-8">
              <div className={`${ADMIN_CARD} space-y-5 p-6`}>
                <FormField label="Tiêu đề bài viết" htmlFor="fmi_post_title" required>
                  <Input
                    disabled={!isEditMode}
                    id="fmi_post_title"
                    className={`${ADMIN_INPUT} text-lg font-semibold ${changedClass('title')}`}
                    value={editData.title || ''}
                    onChange={(e) => setEditData({ ...editData, title: e.target.value })}
                    placeholder="Nhập tiêu đề bài viết..."
                  />
                </FormField>

                <FormField label="Đường dẫn URL" htmlFor="fmi_post_slug">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-400">/bai-viet/</span>
                    <Input
                      disabled={!isEditMode}
                      id="fmi_post_slug"
                      className={`${ADMIN_INPUT} flex-1 font-mono ${changedClass('slug')}`}
                      value={editData.slug || ''}
                      onChange={(e) => setEditData({ ...editData, slug: e.target.value })}
                      placeholder="tu-dong-tao-tu-tieu-de"
                    />
                    <Button
                      type="button"
                      disabled={!isEditMode}
                      variant="outline"
                      size="icon"
                      onClick={() => setEditData({ ...editData, slug: makeSlug(editData.title || '') })}
                      title="Tạo lại đường dẫn từ tiêu đề"
                      className={POST_ICON_BUTTON_CLASS}
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>
                </FormField>

                <FormField label="Nội dung" required>
                  <div className={isFieldChanged('content') ? 'rounded-xl border border-amber-500 ring-1 ring-amber-500' : ''}>
                    <PostRichTextEditor
                      disabled={!isEditMode}
                      value={editData.content || ''}
                      onChange={(content) => setEditData((prev) => ({ ...prev, content }))}
                    />
                  </div>
                </FormField>
              </div>
            </div>

            {/* RIGHT COLUMN - SETTINGS */}
            <div className="space-y-4 lg:col-span-4">
              {/* PUBLISHING */}
              <CollapsibleCard title="Xuất bản" open={sections.publish} onToggle={() => toggleSection('publish')}>
                <div className="flex items-center justify-between">
                  <Label htmlFor="fmi_post_is_featured" className="text-sm font-medium text-slate-700">
                    Bài nổi bật
                  </Label>
                  <Switch
                    id="fmi_post_is_featured"
                    disabled={!isEditMode}
                    checked={editData.is_featured || false}
                    onCheckedChange={(checked) => setEditData({ ...editData, is_featured: checked })}
                    className="data-[state=checked]:bg-blue-600"
                  />
                </div>
                <FormField
                  label="Ngày đăng"
                  htmlFor="fmi_post_published_at"
                  helper="Giờ Việt Nam. Chỉ dùng để đặt ngày đăng đã qua, không hẹn giờ."
                >
                  <Input
                    disabled={!isEditMode}
                    id="fmi_post_published_at"
                    type="datetime-local"
                    className={`${ADMIN_INPUT} ${changedClass('published_at')}`}
                    value={formatToVNDatetimeLocal(editData.published_at)}
                    onChange={(e) => setEditData({ ...editData, published_at: vnDatetimeLocalToUTC(e.target.value) || undefined })}
                  />
                </FormField>
                <FormField
                  label="Chi nhánh hiển thị"
                  helper="Mặc định là tất cả chi nhánh. Hiện trang khách chưa lọc bài viết theo chi nhánh, nên lựa chọn này chỉ được lưu lại."
                >
                  <BranchMultiSelect
                    branches={branchOptions}
                    value={editData.branch_ids ?? null}
                    onChange={(ids) => setEditData({ ...editData, branch_ids: ids })}
                    disabled={!isEditMode}
                    className="rounded-xl text-xs"
                  />
                </FormField>
              </CollapsibleCard>

              {/* IMAGES AND SUMMARY */}
              <CollapsibleCard title="Hình ảnh & tóm tắt" open={sections.images} onToggle={() => toggleSection('images')}>
                <FormField label="Ảnh đại diện" helper="Ảnh hiển thị trong danh sách và khi chia sẻ">
                  <div
                    className={`flex items-center gap-2 ${isFieldChanged('featured_image') ? 'rounded-xl border border-amber-500 p-2 ring-1 ring-amber-500' : ''}`}
                  >
                    <Input
                      disabled={!isEditMode}
                      type="file"
                      accept="image/*"
                      className={ADMIN_INPUT}
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
                      onClick={() => setEditData((prev) => ({ ...prev, featured_image: '', imageFile: undefined }))}
                      disabled={!isEditMode || !editData.featured_image}
                      className={`${ADMIN_BTN_OUTLINE} shrink-0`}
                    >
                      Gỡ
                    </Button>
                  </div>
                  {editData.featured_image && (
                    <img
                      src={editData.featured_image}
                      alt="Xem trước"
                      className="mt-2 aspect-video w-full cursor-pointer rounded-xl border border-slate-200 object-cover transition-opacity hover:opacity-80"
                      onClick={() => window.open(editData.featured_image, '_blank', 'noopener,noreferrer')}
                      title="Bấm để xem ảnh lớn"
                    />
                  )}
                </FormField>
                <FormField label="Tóm tắt" htmlFor="fmi_post_excerpt">
                  <Textarea
                    disabled={!isEditMode}
                    id="fmi_post_excerpt"
                    className={`${POST_TEXTAREA_CLASS} ${changedClass('excerpt')}`}
                    value={editData.excerpt || ''}
                    onChange={(e) => setEditData({ ...editData, excerpt: e.target.value })}
                    placeholder="1-2 câu mô tả ngắn, hiển thị ngoài danh sách"
                  />
                </FormField>
              </CollapsibleCard>

              {/* SEO AND SHARING */}
              <CollapsibleCard title="SEO & chia sẻ" open={sections.seo} onToggle={() => toggleSection('seo')}>
                <FormField label="Tiêu đề trên Google" htmlFor="fmi_post_seo_title">
                  <div className="flex items-center gap-2">
                    <Input
                      disabled={!isEditMode}
                      id="fmi_post_seo_title"
                      className={`${ADMIN_INPUT} flex-1 ${changedClass('seo_title')}`}
                      value={editData.seo_title || ''}
                      onChange={(e) => setEditData({ ...editData, seo_title: e.target.value })}
                      placeholder="Ví dụ: Phim 8 Kỳ Quan | Cinesphere"
                      maxLength={60}
                    />
                    <Button
                      type="button"
                      disabled={!isEditMode}
                      variant="outline"
                      size="icon"
                      onClick={() => setEditData({ ...editData, seo_title: editData.title || '' })}
                      title="Sao chép từ tiêu đề bài viết"
                      className={POST_ICON_BUTTON_CLASS}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <p className="text-xs text-amber-600">{editData.seo_title?.length || 0}/60 ký tự</p>
                    <p className={POST_HINT_CLASS}>Ấn biểu tượng để sao chép từ tiêu đề bài viết</p>
                  </div>
                </FormField>
                <FormField label="Mô tả trên Google" htmlFor="fmi_post_meta_description">
                  <div className="flex items-start gap-2">
                    <Textarea
                      disabled={!isEditMode}
                      id="fmi_post_meta_description"
                      className={`${POST_TEXTAREA_CLASS} flex-1 ${changedClass('meta_description')}`}
                      value={editData.meta_description || ''}
                      onChange={(e) => setEditData({ ...editData, meta_description: e.target.value })}
                      placeholder="Tóm tắt ngắn 120-160 ký tự giúp tăng lượt nhấp từ Google"
                      maxLength={160}
                    />
                    <Button
                      type="button"
                      disabled={!isEditMode}
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        if (editData.excerpt) {
                          if (editData.excerpt.length > 160) {
                            setIsMetaCutConfirmOpen(true);
                          } else {
                            setEditData({ ...editData, meta_description: editData.excerpt });
                          }
                        }
                      }}
                      title="Sao chép từ tóm tắt"
                      className={POST_ICON_BUTTON_CLASS}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <p className={`text-xs ${getMetaDescriptionColor()}`}>{editData.meta_description?.length || 0}/160 ký tự</p>
                    <p className={POST_HINT_CLASS}>Ấn biểu tượng để sao chép từ tóm tắt bài viết</p>
                  </div>
                </FormField>
                <FormField label="Từ khóa" htmlFor="fmi_post_meta_keywords">
                  <Input
                    disabled={!isEditMode}
                    id="fmi_post_meta_keywords"
                    className={`${ADMIN_INPUT} ${changedClass('meta_keywords')}`}
                    value={editData.meta_keywords || ''}
                    onChange={(e) => setEditData({ ...editData, meta_keywords: e.target.value })}
                    placeholder="phim, rạp chiếu, review"
                  />
                </FormField>
                <FormField label="Ảnh khi chia sẻ Facebook/Zalo">
                  <div
                    className={`flex items-center gap-2 ${isFieldChanged('og_image') ? 'rounded-xl border border-amber-500 p-2 ring-1 ring-amber-500' : ''}`}
                  >
                    <Input
                      disabled={!isEditMode}
                      type="file"
                      accept="image/*"
                      className={ADMIN_INPUT}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) setEditData({ ...editData, ogImageFile: file });
                      }}
                    />
                    {editData.og_image && (
                      <img
                        src={editData.og_image}
                        alt="Xem trước ảnh chia sẻ"
                        className="h-12 w-12 cursor-pointer rounded-lg border border-slate-200 object-cover transition-opacity hover:opacity-80"
                        onClick={() => window.open(editData.og_image, '_blank', 'noopener,noreferrer')}
                        title="Bấm để xem ảnh lớn"
                      />
                    )}
                  </div>
                </FormField>
                <FormField label="URL chuẩn" htmlFor="fmi_post_canonical_url" helper="Ấn biểu tượng để sao chép URL bài viết">
                  <div className="flex items-center gap-2">
                    <Input
                      disabled={!isEditMode}
                      id="fmi_post_canonical_url"
                      className={`${ADMIN_INPUT} flex-1 ${changedClass('canonical_url')}`}
                      value={editData.canonical_url || ''}
                      onChange={(e) => setEditData({ ...editData, canonical_url: e.target.value })}
                      placeholder={`${getPublicSiteBaseUrl()}/bai-viet/ten-bai-viet`}
                    />
                    <Button
                      type="button"
                      disabled={!isEditMode}
                      variant="outline"
                      size="icon"
                      onClick={() => setEditData({ ...editData, canonical_url: getPublicPostUrl(editData.slug) })}
                      title="Sao chép URL bài viết"
                      className={POST_ICON_BUTTON_CLASS}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </FormField>
                <FormField label="Loại nội dung" htmlFor="fmi_post_schema_type">
                  <select
                    disabled={!isEditMode}
                    id="fmi_post_schema_type"
                    className={`${POST_SELECT_CLASS} ${changedClass('schema_type')}`}
                    value={editData.schema_type || 'Article'}
                    onChange={(e) => setEditData({ ...editData, schema_type: e.target.value })}
                  >
                    <option value="Article">Bài viết</option>
                    <option value="NewsArticle">Tin tức</option>
                    <option value="BlogPosting">Bài blog</option>
                  </select>
                </FormField>
              </CollapsibleCard>
            </div>
          </div>
        </div>
      </div>

      {/* LEAVE WITH UNSAVED CHANGES */}
      <ConfirmDialog
        open={isLeaveConfirmOpen}
        onOpenChange={setIsLeaveConfirmOpen}
        variant="warning"
        title="Thay đổi chưa được lưu"
        description="Bạn đang có những thay đổi dở dang. Nếu thoát bây giờ, các nội dung vừa nhập sẽ bị mất."
        cancelText="Tiếp tục chỉnh sửa"
        confirmText="Thoát, bỏ thay đổi"
        onConfirm={() => {
          setIsLeaveConfirmOpen(false);
          navigate('/posts');
        }}
      />

      {/* CUT SUMMARY TO 160 CHARACTERS */}
      <ConfirmDialog
        open={isMetaCutConfirmOpen}
        onOpenChange={setIsMetaCutConfirmOpen}
        variant="warning"
        title="Cắt bớt tóm tắt?"
        description={`Tóm tắt dài ${editData.excerpt?.length || 0} ký tự, mô tả trên Google chỉ nhận tối đa 160 ký tự. Phần dư sẽ bị cắt bỏ. Tiếp tục?`}
        confirmText="Cắt và sao chép"
        onConfirm={() => {
          setEditData({ ...editData, meta_description: (editData.excerpt || '').slice(0, 160) });
          setIsMetaCutConfirmOpen(false);
        }}
      />
    </AdminLayout>
  );
}
