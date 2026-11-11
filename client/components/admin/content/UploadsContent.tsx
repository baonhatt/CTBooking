import React, { useRef, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  uploadAdminVideo,
  uploadDirectToCloudinary,
  createSiteMediaApi,
  getSiteMediaApi,
  updateSiteMediaApi,
  deleteSiteMediaApi
} from '@/lib/api/uploads';
import { getBranches } from '@/lib/api/branches';
import { BranchIdsBadge } from '@/components/admin/BranchIdsBadge';
import { formatVnDateTime } from '@/lib/format';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';
import { optimizeCloudinaryUrl, getCloudinaryThumbnail } from '@/lib/utils';
import {
  Upload,
  FileVideo,
  FileImage,
  X,
  CheckCircle2,
  AlertCircle,
  CloudUpload,
  Trash2,
  ExternalLink,
  Monitor,
  Grid3X3,
  RefreshCw,
  Info,
  Folder,
  FolderOpen,
  FolderTree,
  Search,
  Grid,
  List,
  Copy,
  Check,
  HardDrive,
  Filter,
  ArrowUpDown,
  Play,
  Maximize2
} from 'lucide-react';
import { AdminDialog, AdminDialogFooter } from '@/components/admin/common/AdminDialog';
import { ConfirmDialog } from '@/components/admin/common/ConfirmDialog';
import { RowActionButton, RowActions } from '@/components/admin/common/RowActionButton';
import { StatusBadge } from '@/components/admin/common/StatusBadge';
import { PageHeader } from '@/components/admin/common/PageHeader';
import { EmptyState } from '@/components/admin/common/EmptyState';
import { FormField } from '@/components/admin/common/FormField';
import { notify } from '@/components/admin/common/notify';
import {
  ADMIN_BTN_PRIMARY,
  ADMIN_BTN_OUTLINE,
  ADMIN_BTN_DANGER,
  ADMIN_CARD,
  ADMIN_INPUT,
  ADMIN_TABLE_HEAD,
  ADMIN_TH,
  ADMIN_TEXT
} from '@/components/admin/common/adminTokens';

export default function UploadsContent() {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [openConfirm, setOpenConfirm] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState('');
  const [pendingTargetId, setPendingTargetId] = useState<number | null>(null);
  const [uploads, setUploads] = useState<
    {
      id: string;
      file: File;
      name: string;
      size: number;
      type: string;
      section: 'hero_section' | 'technology_section1' | 'technology_section2';
      isVideo: boolean;
      isImage: boolean;
      compressProgress?: number | null;
      uploadProgress: number;
      status: 'pending' | 'uploading' | 'done' | 'error';
      error?: string;
      targetId?: number;
    }[]
  >([]);
  const runningRef = useRef(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [section, setSection] = useState<'hero_section' | 'technology_section1' | 'technology_section2'>(
    'hero_section'
  );
  const [statusLines, setStatusLines] = useState<{ time: string; text: string }[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [stage, setStage] = useState<'idle' | 'compressing' | 'uploading' | 'done' | 'error'>('idle');
  const [openMediaModal, setOpenMediaModal] = useState(false);
  const [mediaItems, setMediaItems] = useState<any[]>([]);
  const [mediaLoadingId, setMediaLoadingId] = useState<number | null>(null);
  const [playingVideoId, setPlayingVideoId] = useState<number | null>(null);

  // Windows Explorer Media Library States
  const [selectedFolder, setSelectedFolder] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [explorerView, setExplorerView] = useState<'grid' | 'list'>('grid');
  const [selectedMediaItem, setSelectedMediaItem] = useState<any | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'section'>('newest');
  const [itemToDelete, setItemToDelete] = useState<any | null>(null);

  // Branches, only to turn the branch ids of a media item into names
  const [branches, setBranches] = useState<{ id: number; name: string }[]>([]);

  useEffect(() => {
    getBranches({ pageSize: 100, includeInactive: true })
      .then((res) => setBranches((res.items || []).map((branch: any) => ({ id: branch.id, name: branch.name }))))
      .catch(() => {
        // Without the names the badge falls back to the branch count, so the library still works
      });
  }, []);

  // What to call a media item: its title, else the file name taken from the URL
  const media_display_name = (media: any): string => {
    if (media?.title) return String(media.title);
    const lastSegment = String(media?.url || '').split('?')[0].split('/').pop() || '';
    try {
      return decodeURIComponent(lastSegment) || String(media?.public_id || '');
    } catch {
      return lastSegment || String(media?.public_id || '');
    }
  };

  // Exact time of a media item, shown as a tooltip next to the relative time
  const media_exact_time = (media: any): string => formatVnDateTime(media?.updated_at);

  const media_status_badge = (media: any) => (
    <StatusBadge tone={media?.is_active === false ? 'neutral' : 'success'}>
      {media?.is_active === false ? 'Ẩn' : 'Hiển thị'}
    </StatusBadge>
  );

  // The clipboard can be blocked (no permission, not https): try the old way, then say it failed
  const copyToClipboard = async (text: string, id: number) => {
    let copied = false;
    try {
      await navigator.clipboard.writeText(text);
      copied = true;
    } catch {
      try {
        const helperInput = document.createElement('textarea');
        helperInput.value = text;
        helperInput.style.position = 'fixed';
        helperInput.style.opacity = '0';
        document.body.appendChild(helperInput);
        helperInput.select();
        copied = document.execCommand('copy');
        document.body.removeChild(helperInput);
      } catch {
        copied = false;
      }
    }
    if (!copied) {
      notify.error('Không sao chép được URL, hãy chọn và sao chép thủ công');
      return;
    }
    setCopiedId(id);
    notify.copied('URL vào bộ nhớ tạm');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getSectionLabel = (sec: string) => {
    switch (sec) {
      case 'hero_section':
        return 'Banner trang chủ';
      case 'technology_section1':
        return 'Banner công nghệ';
      case 'technology_section2':
        return 'Danh sách công nghệ';
      case 'image':
        return 'Hình ảnh';
      case 'video':
        return 'Video';
      default:
        return sec.replace(/_/g, ' ').toUpperCase();
    }
  };

  const getThumbnail = (url: string, type: string) => {
    if (type === 'image') return url;
    if (url.includes('cloudinary.com') || url.includes('res.cloudinary.com')) {
      return getCloudinaryThumbnail(url);
    }
    return null;
  };

  // One log line, stamped with the time the event happened (not the time of each render)
  const push_status_line = (text: string) => {
    const time = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    setStatusLines((prev) => [...prev, { time, text }]);
  };

  // Same entry point for the file input and the dropzone
  const accept_files = (picked: File[]) => {
    setFiles(picked);
  };

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    accept_files(Array.from(e.target.files || []));
  };

  // Drag and drop: only video/image files are taken, like the accept filter of the file input
  const onDropFiles = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const dropped = Array.from(e.dataTransfer?.files || []);
    if (!dropped.length) return;
    const valid = dropped.filter((file) => /^(video|image)\//.test(file.type));
    if (!valid.length) {
      notify.error('Tệp đã chọn không phải video/ảnh hợp lệ');
      return;
    }
    if (valid.length < dropped.length) notify.error('Một số tệp không phải video/ảnh nên đã bị bỏ qua');
    if (fileRef.current) fileRef.current.value = '';
    accept_files(valid);
  };

  const isValidVideo = (f: File | null) => !!f && /^video\//.test(f.type);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  };

  React.useEffect(() => {
    if (!files.length) {
      setPreviewUrl(null);
      return;
    }
    const first = files[0];
    const url = URL.createObjectURL(first);
    setPreviewUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [files]);

  const compressImage = async (fi: File) => {
    const url = URL.createObjectURL(fi);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = reject as any;
        i.src = url;
      });
      const maxDim = 2560;
      const ratio = Math.min(1, maxDim / Math.max(img.width, img.height));
      const w = Math.round(img.width * ratio);
      const h = Math.round(img.height * ratio);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return fi;
      ctx.drawImage(img, 0, 0, w, h);
      let quality = 0.82;
      let blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', quality));
      for (let i = 0; i < 3 && blob && blob.size > 10_000_000; i++) {
        quality = Math.max(0.5, quality - 0.12);
        blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', quality));
      }
      if (blob && blob.size < fi.size) {
        return new File([blob], fi.name.replace(/\.(png|jpg|jpeg|bmp|gif)$/i, '.webp'), { type: 'image/webp' });
      }
      return fi;
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  // Effect to manage queue processing
  useEffect(() => {
    const maxConcurrent = 4;
    const activeCount = uploads.filter((u) => u.status === 'uploading').length;
    const pendingItem = uploads.find((u) => u.status === 'pending');

    // Auto-update stage to "done" if nothing is running or pending
    if (activeCount === 0 && !pendingItem && uploads.length > 0 && stage === 'uploading') {
      setStage('done');
    }

    // If we have slots and pending items
    if (activeCount < maxConcurrent && pendingItem) {
      const nextItem = pendingItem;
      if (nextItem) {
        // Mark as uploading immediately to prevent double processing in next render
        setUploads((prev) => prev.map((u) => (u.id === nextItem.id ? { ...u, status: 'uploading' } : u)));

        // Start async task
        (async () => {
          try {
            let finalFile = nextItem.file;
            // Compress image if needed
            if (nextItem.isImage && nextItem.file.size > 10_000_000) {
              setUploads((arr) => {
                const cp = [...arr];
                const i = cp.findIndex((x) => x.id === nextItem.id);
                if (i !== -1) cp[i] = { ...cp[i], compressProgress: 0 };
                return cp;
              });

              finalFile = await compressImage(nextItem.file);

              setUploads((arr) => {
                const cp = [...arr];
                const i = cp.findIndex((x) => x.id === nextItem.id);
                if (i !== -1) cp[i] = { ...cp[i], compressProgress: 100 };
                return cp;
              });
              push_status_line(
                `Đã nén ảnh [${nextItem.name}] (${formatSize(finalFile.size)} từ ${formatSize(nextItem.size)}), đang upload...`
              );
            }

            setStage('uploading');

            const result = await (nextItem.isVideo
              ? uploadAdminVideo(finalFile, nextItem.section, (p) =>
                  setUploads((arr) => {
                    const cp = [...arr];
                    const i = cp.findIndex((x) => x.id === nextItem.id);
                    if (i !== -1) cp[i] = { ...cp[i], uploadProgress: p };
                    return cp;
                  })
                )
              : uploadDirectToCloudinary(finalFile, nextItem.section, (p) =>
                  setUploads((arr) => {
                    const cp = [...arr];
                    const i = cp.findIndex((x) => x.id === nextItem.id);
                    if (i !== -1) cp[i] = { ...cp[i], uploadProgress: p };
                    return cp;
                  })
                ));

            if (nextItem.targetId) {
              await updateSiteMediaApi({
                id: nextItem.targetId,
                section: nextItem.section,
                type: nextItem.isVideo ? 'video' : 'image',
                url: result.url,
                public_id: result.public_id,
                format: result.format,
                width: result.width,
                height: result.height,
                duration: result.duration,
                is_active: true
              });
              push_status_line(`Đã cập nhật [${nextItem.name}] vào ${getSectionLabel(nextItem.section)}`);
            } else {
              await createSiteMediaApi({
                section: nextItem.section,
                type: nextItem.isVideo ? 'video' : 'image',
                url: result.url,
                public_id: result.public_id,
                format: result.format,
                width: result.width,
                height: result.height,
                duration: result.duration,
                display_order: 0,
                is_active: true
              });
              push_status_line(`Đã tạo mới [${nextItem.name}] vào ${getSectionLabel(nextItem.section)}`);
            }

            setUploads((arr) => {
              const cp = [...arr];
              const i = cp.findIndex((x) => x.id === nextItem.id);
              if (i !== -1) cp[i] = { ...cp[i], status: 'done', uploadProgress: 100 };
              return cp;
            });
          } catch (err: any) {
            setUploads((arr) => {
              const cp = [...arr];
              const i = cp.findIndex((x) => x.id === nextItem.id);
              if (i !== -1) cp[i] = { ...cp[i], status: 'error', error: err?.message || 'Tải lên lỗi' };
              return cp;
            });
            setStage('error');
            push_status_line(`Tải lên thất bại [${nextItem.name}]: ${err?.message || 'Có lỗi xảy ra'}`);
          }
        })();
      }
    }
  }, [uploads]);

  const checkAndPrepareUpload = async () => {
    if (!files.length) return;
    setConfirmMessage('');
    setPendingTargetId(null);

    try {
      // Fetch existing items to check constraints
      const res = await getSiteMediaApi({ section });
      const items = res.items || [];

      if (section === 'technology_section2') {
        if (items.length >= 6) {
          // Sort by display_order to find the 6th one
          const sorted = [...items].sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
          // Target the 6th item (index 5) or the last one if fewer than 6 but logic says >=6
          const target = sorted[5] || sorted[items.length - 1];

          if (target) {
            setPendingTargetId(target.id);
            setConfirmMessage(
              `Mục ${getSectionLabel(section)} đã đạt giới hạn 6 video. Hành động này sẽ ghi đè lên video thứ 6.`
            );
            setOpenConfirm(true);
            return;
          }
        }
      } else {
        // hero_section or technology_section1 -> single item
        if (items.length > 0) {
          const target = items[0];
          setPendingTargetId(target.id);
          setConfirmMessage(`Mục ${getSectionLabel(section)} đã có dữ liệu. Hành động này sẽ cập nhật, thay thế nội dung cũ.`);
          setOpenConfirm(true);
          return;
        }
      }

      // Default: Insert new
      setConfirmMessage(
        files.length === 1 && /^image\//.test(files[0].type)
          ? 'Bạn có chắc muốn tải lên ảnh này?'
          : 'Bạn có chắc muốn tải lên các tệp đã chọn?'
      );
      setOpenConfirm(true);
    } catch (err) {
      console.error('Check failed', err);
      setConfirmMessage('Không thể kiểm tra dữ liệu cũ. Bạn có muốn tiếp tục tải lên?');
      setOpenConfirm(true);
    }
  };

  const startUpload = async () => {
    if (!files.length) return;
    setOpenConfirm(false);
    setStage('compressing');
    push_status_line('Đã thêm vào hàng đợi...');
    const toAdd = files.map((f) => ({
      id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random()}`,
      file: f,
      name: f.name,
      size: f.size,
      type: f.type,
      section,
      isVideo: /^video\//.test(f.type),
      isImage: /^image\//.test(f.type),
      compressProgress: /^image\//.test(f.type) ? 0 : null,
      uploadProgress: 0,
      status: 'pending' as const,
      targetId: pendingTargetId || undefined
    }));
    setUploads((arr) => [...arr, ...toAdd]);
    setFiles([]);
    setPendingTargetId(null); // Reset
    if (fileRef.current) fileRef.current.value = '';
  };

  // ─── Derived data for the render ───────────────────────────────────────────
  const has_active_upload = uploads.some((u) => u.status === 'uploading' || u.status === 'pending');

  // Library: folder filter + search + sort, computed once for grid, list, counter and empty state
  const matches_folder = (media: any) => {
    if (selectedFolder === 'hero_section') return media.section === 'hero_section';
    if (selectedFolder === 'technology_section1') return media.section === 'technology_section1';
    if (selectedFolder === 'technology_section2') return media.section === 'technology_section2';
    if (selectedFolder === 'image') return media.type === 'image';
    if (selectedFolder === 'video') return media.type === 'video';
    return true;
  };
  const matches_search = (media: any) => {
    if (!searchQuery.trim()) return true;
    const search_text = searchQuery.toLowerCase();
    return (
      media_display_name(media).toLowerCase().includes(search_text) ||
      (media.url || '').toLowerCase().includes(search_text) ||
      (media.section || '').toLowerCase().includes(search_text)
    );
  };
  const media_time = (media: any) => new Date(media.created_at || media.updated_at || 0).getTime();
  const visible_media = mediaItems
    .filter(matches_folder)
    .filter(matches_search)
    .sort((a, b) => (sortBy === 'oldest' ? media_time(a) - media_time(b) : media_time(b) - media_time(a)));

  const folder_nav_items = [
    { id: 'all', label: 'Tất cả Media', icon: FolderOpen, icon_color: 'text-amber-500', count: mediaItems.length },
    {
      id: 'hero_section',
      label: 'Banner trang chủ',
      icon: Folder,
      icon_color: 'text-blue-500',
      count: mediaItems.filter((m) => m.section === 'hero_section').length
    },
    {
      id: 'technology_section1',
      label: 'Banner công nghệ',
      icon: Folder,
      icon_color: 'text-purple-500',
      count: mediaItems.filter((m) => m.section === 'technology_section1').length
    },
    {
      id: 'technology_section2',
      label: 'Danh sách công nghệ',
      icon: Folder,
      icon_color: 'text-emerald-500',
      count: mediaItems.filter((m) => m.section === 'technology_section2').length
    }
  ];
  const type_nav_items = [
    {
      id: 'image',
      label: 'Hình ảnh',
      icon: FileImage,
      icon_color: 'text-emerald-500',
      count: mediaItems.filter((m) => m.type === 'image').length
    },
    {
      id: 'video',
      label: 'Video',
      icon: FileVideo,
      icon_color: 'text-blue-500',
      count: mediaItems.filter((m) => m.type === 'video').length
    }
  ];
  const folder_shortcuts = [
    { id: 'hero_section', desc: 'Banner chính trang chủ', icon_color: 'text-blue-500 bg-blue-50' },
    { id: 'technology_section1', desc: 'Banner giới thiệu công nghệ', icon_color: 'text-purple-500 bg-purple-50' },
    { id: 'technology_section2', desc: 'Danh sách tính năng công nghệ', icon_color: 'text-emerald-500 bg-emerald-50' }
  ];

  const upload_status_tone = (status: string) =>
    status === 'done' ? 'success' : status === 'error' ? 'danger' : status === 'uploading' ? 'info' : 'neutral';
  const upload_status_label = (status: string) =>
    status === 'done' ? 'Xong' : status === 'error' ? 'Lỗi' : status === 'uploading' ? 'Đang tải' : 'Chờ';

  const reset_queue = () => {
    setFiles([]);
    setUploads([]);
    if (fileRef.current) fileRef.current.value = '';
    setPreviewUrl(null);
    setStatusLines([]);
    setStage('idle');
  };

  const open_media_library = async () => {
    try {
      const { items } = await getSiteMediaApi({});
      setMediaItems(items);
      setOpenMediaModal(true);
    } catch (err: any) {
      notify.error(err, 'Không thể tải site media');
    }
  };

  const refresh_media_library = async () => {
    try {
      const { items } = await getSiteMediaApi({});
      setMediaItems(items);
      notify.success('Đã làm mới dữ liệu media');
    } catch {
      notify.error('Không thể làm mới');
    }
  };

  const close_media_library = () => {
    setOpenMediaModal(false);
    setPlayingVideoId(null);
    setSelectedMediaItem(null);
  };

  const confirm_delete_media = async () => {
    if (!itemToDelete) return;
    try {
      setMediaLoadingId(itemToDelete.id);
      const r = await deleteSiteMediaApi(Number(itemToDelete.id));
      if (r.ok) {
        notify.deleted('tệp media');
        if (selectedMediaItem?.id === itemToDelete.id) {
          setSelectedMediaItem(null);
        }
        const { items } = await getSiteMediaApi({});
        setMediaItems(items);
        setItemToDelete(null);
      } else throw new Error();
    } catch {
      notify.error('Xóa thất bại');
    } finally {
      setMediaLoadingId(null);
    }
  };

  const nav_button_class = (is_active: boolean) =>
    `flex w-full items-center justify-between rounded-xl border px-3 py-2 text-xs font-medium transition-all ${
      is_active ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-transparent text-slate-600 hover:bg-slate-100'
    }`;

  return (
    <div>
      <PageHeader
        title="Quản lý tệp media"
        description="Tải video, ảnh lên website và quản lý thư viện media theo từng vị trí hiển thị"
      />

      <div className="space-y-6">
        {/* UPLOAD SECTION */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Left column: upload controls */}
          <div className={`${ADMIN_CARD} space-y-6 p-5`}>
            <FormField label="Chọn video hoặc ảnh">
              <div
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDragging(true);
                }}
                onDragEnter={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  // Ignore leave events fired when moving over a child element
                  if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setIsDragging(false);
                }}
                onDrop={onDropFiles}
                className={`group relative flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 transition-all hover:border-blue-400 hover:bg-blue-50/50 ${
                  isDragging ? 'border-blue-500 bg-blue-50' : 'border-slate-300 bg-slate-50'
                }`}
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept="video/*,image/*"
                  multiple
                  onChange={onPickFile}
                  className="hidden"
                />
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 transition-transform duration-300 group-hover:scale-110">
                  <Upload className="h-7 w-7 text-blue-600" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-slate-700">Nhấn để chọn hoặc kéo thả tệp vào đây</p>
                  <p className="mt-1 text-xs text-slate-500">Hỗ trợ Video (MP4, MOV) và Hình ảnh (JPG, PNG, WEBP)</p>
                </div>
              </div>

              {files.length > 0 && (
                <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 animate-in fade-in slide-in-from-top-1">
                  <CheckCircle2 className="h-4 w-4 text-blue-600" />
                  <span className="text-xs font-medium text-blue-700">
                    Đã chọn {files.length} tệp ({formatSize(files.reduce((s, f) => s + f.size, 0))})
                  </span>
                  <button
                    type="button"
                    aria-label="Bỏ chọn tệp"
                    title="Bỏ chọn tệp"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFiles([]);
                      if (fileRef.current) fileRef.current.value = '';
                    }}
                    className="ml-auto rounded-full p-1 transition-colors hover:bg-blue-100"
                  >
                    <X className="h-4 w-4 text-slate-500" />
                  </button>
                </div>
              )}

              {files.length === 1 && files[0] && !/^video\//.test(files[0].type) && !/^image\//.test(files[0].type) && (
                <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-600">
                  <AlertCircle className="h-4 w-4" />
                  Tệp đã chọn không phải video/ảnh hợp lệ
                </div>
              )}
            </FormField>

            <FormField label="Vị trí hiển thị">
              <select
                className="h-10 w-full cursor-pointer rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none transition-all focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
                value={section}
                onChange={(e) => setSection(e.target.value as any)}
              >
                <option value="hero_section">Banner trang chủ</option>
                <option value="technology_section1">Banner công nghệ</option>
                <option value="technology_section2">Danh sách công nghệ</option>
              </select>
              <div className="flex items-start gap-2 px-1 text-xs text-slate-500">
                <Info className="mt-0.5 h-3.5 w-3.5 text-blue-500" />
                <span>Media sẽ được upload và áp dụng trực tiếp cho phần này trên website.</span>
              </div>
            </FormField>

            <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 pt-4">
              <Button
                disabled={!files.length || has_active_upload}
                onClick={checkAndPrepareUpload}
                className={`${ADMIN_BTN_PRIMARY} gap-2 disabled:cursor-not-allowed disabled:opacity-50`}
              >
                <CloudUpload className="h-4 w-4" />
                {has_active_upload ? ADMIN_TEXT.busy : 'Bắt đầu tải lên'}
              </Button>
              <Button
                variant="outline"
                size="icon"
                disabled={has_active_upload}
                onClick={reset_queue}
                className={`${ADMIN_BTN_OUTLINE} w-10 shrink-0 px-0 disabled:cursor-not-allowed disabled:opacity-50`}
                title={ADMIN_TEXT.refresh}
                aria-label={ADMIN_TEXT.refresh}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>

              <div className="hidden sm:block sm:flex-1" />

              <Button variant="outline" onClick={open_media_library} className={`${ADMIN_BTN_OUTLINE} gap-2`}>
                <Grid3X3 className="h-4 w-4" />
                Thư viện Site Media
              </Button>
            </div>
          </div>

          {/* Right column: preview card */}
          <div>
            {files.length === 1 && previewUrl ? (
              <div className={`${ADMIN_CARD} flex h-full flex-col overflow-hidden`}>
                <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 p-4">
                  <div className="flex min-w-0 items-center gap-2">
                    {/^image\//.test(files[0].type) ? (
                      <FileImage className="h-4 w-4 shrink-0 text-emerald-600" />
                    ) : (
                      <FileVideo className="h-4 w-4 shrink-0 text-blue-600" />
                    )}
                    <span className="max-w-[240px] truncate text-sm font-semibold text-slate-800">{files[0].name}</span>
                  </div>
                  <StatusBadge tone="info">Xem trước</StatusBadge>
                </div>

                <div className="flex flex-1 items-center justify-center p-5">
                  {/* The media frame stays dark so images and video read clearly */}
                  <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-900">
                    {/^image\//.test(files[0].type) ? (
                      <img
                        src={previewUrl}
                        alt={files[0].name}
                        className="h-full max-h-[400px] w-full object-contain animate-in zoom-in-95 duration-500"
                      />
                    ) : (
                      <video src={previewUrl} controls className="h-full max-h-[400px] w-full object-contain" />
                    )}
                  </div>
                </div>

                <div className="mt-auto border-t border-slate-200 bg-slate-50 p-5">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-1">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Kích thước</p>
                      <p className="text-sm font-medium text-slate-800">{formatSize(files[0].size || 0)}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Định dạng</p>
                      <p className="truncate text-sm font-medium text-slate-800">{files[0].type || 'N/A'}</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className={`${ADMIN_CARD} flex h-full min-h-[400px] items-center justify-center border-dashed border-slate-300`}>
                <EmptyState
                  icon={<Monitor className="h-6 w-6" />}
                  title="Chưa có tệp nào được chọn"
                  description="Chọn một tệp để xem trước nội dung và thuộc tính trước khi tải lên."
                />
              </div>
            )}
          </div>
        </div>

        {/* PROGRESS SECTION */}
        {(!!uploads.length || !!statusLines.length || files.length > 0) && (
          <div className={`${ADMIN_CARD} space-y-6 p-5 animate-in fade-in slide-in-from-bottom-4 duration-500`}>
            {!!uploads.length && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                    <RefreshCw className={`h-4 w-4 ${stage === 'uploading' ? 'animate-spin' : ''}`} />
                    Tiến trình tải lên
                  </h3>
                  <StatusBadge tone="neutral">
                    {uploads.filter((u) => u.status === 'done').length}/{uploads.length} hoàn thành
                  </StatusBadge>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {uploads.map((u) => (
                    <div key={u.id} className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="mb-3 flex items-start justify-between gap-2 pr-8">
                        <div className="flex items-center gap-3 overflow-hidden">
                          <div
                            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                              u.status === 'done'
                                ? 'bg-emerald-50 text-emerald-600'
                                : u.status === 'error'
                                  ? 'bg-red-50 text-red-600'
                                  : 'bg-blue-50 text-blue-600'
                            }`}
                          >
                            {u.isImage ? <FileImage className="h-5 w-5" /> : <FileVideo className="h-5 w-5" />}
                          </div>
                          <div className="overflow-hidden">
                            <div className="truncate text-sm font-semibold text-slate-800">{u.name}</div>
                            <div className="text-xs font-medium text-slate-500">
                              {formatSize(u.size)} • {u.type.split('/')[1]?.toUpperCase() || 'N/A'}
                            </div>
                          </div>
                        </div>
                        <StatusBadge tone={upload_status_tone(u.status)} className={u.status === 'uploading' ? 'animate-pulse' : ''}>
                          {upload_status_label(u.status)}
                        </StatusBadge>
                      </div>

                      <div className="space-y-3">
                        {u.isImage && u.status !== 'done' && u.status !== 'error' && (
                          <div className="space-y-1.5">
                            <div className="flex justify-between text-xs font-medium text-slate-500">
                              <span>Nén ảnh</span>
                              <span>{u.compressProgress || 0}%</span>
                            </div>
                            <Progress value={u.compressProgress || 0} className="h-1.5 bg-slate-200" />
                          </div>
                        )}

                        {u.status !== 'done' && u.status !== 'error' && (
                          <div className="space-y-1.5">
                            <div className="flex justify-between text-xs font-medium text-slate-500">
                              <span>Tải lên</span>
                              <span>{u.uploadProgress}%</span>
                            </div>
                            <Progress value={u.uploadProgress} className="h-1.5 bg-slate-200" />
                          </div>
                        )}

                        {u.status === 'done' && (
                          <div className="flex items-center gap-2 py-1 text-xs font-medium text-emerald-600 animate-in fade-in">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Tải lên thành công
                          </div>
                        )}

                        {u.error && (
                          <div className="flex items-center gap-2 py-1 text-xs font-medium text-red-600">
                            <AlertCircle className="h-3.5 w-3.5" />
                            {u.error}
                          </div>
                        )}
                      </div>

                      {/* Cancel / remove */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setUploads((prev) => prev.filter((x) => x.id !== u.id));
                        }}
                        className="absolute right-2 top-2 rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700"
                        title="Hủy / Xóa"
                        aria-label="Hủy / Xóa"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!uploads.length && files.length > 0 && (
              <div className="flex items-center gap-4 rounded-xl border border-blue-200 bg-blue-50 p-5 animate-in fade-in slide-in-from-left-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white">
                  <Info className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-blue-800">Sẵn sàng tải lên</h4>
                  <p className="mt-0.5 text-xs text-blue-700">
                    Nhấn nút <span className="font-bold">"Bắt đầu tải lên"</span> để xử lý {files.length} tệp đã chọn.
                  </p>
                </div>
              </div>
            )}

            {!!statusLines.length && (
              <div className="space-y-3">
                <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                  <div className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                  Hoạt động hệ thống
                </h3>
                <div className="max-h-40 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-4 font-mono">
                  {statusLines.map((ln, idx) => (
                    <div key={idx} className="flex gap-2 border-b border-slate-200 py-1 text-xs text-slate-600 last:border-0">
                      <span className="shrink-0 text-blue-500">[{ln.time}]</span>
                      <span className="leading-relaxed">{ln.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* UPLOAD CONFIRM DIALOG */}
      <AdminDialog
        open={openConfirm}
        onClose={() => setOpenConfirm(false)}
        size="sm"
        mode="form"
        title="Xác nhận tải lên"
        footer={<AdminDialogFooter onCancel={() => setOpenConfirm(false)} onSubmit={startUpload} submitText="Xác nhận" />}
      >
        <p className="text-sm text-slate-700">
          {confirmMessage ||
            (files.length === 1 && /^image\//.test(files[0].type)
              ? 'Bạn có chắc muốn tải lên ảnh này?'
              : 'Bạn có chắc muốn tải lên các tệp đã chọn?')}
        </p>
      </AdminDialog>

      {/* MEDIA LIBRARY DIALOG */}
      <AdminDialog
        open={openMediaModal}
        onClose={close_media_library}
        size="full"
        mode="view"
        flushBody
        icon={<HardDrive className="h-5 w-5" />}
        title="Thư viện media"
        subtitle={`Thư viện / ${selectedFolder === 'all' ? 'Tất cả Media' : getSectionLabel(selectedFolder)}`}
        footer={
          <>
            <span className="mr-auto text-xs text-slate-500">{mediaItems.length} mục trong thư viện</span>
            <AdminDialogFooter onCancel={close_media_library} cancelText={ADMIN_TEXT.close} />
          </>
        }
      >
        <div className="flex h-[calc(90vh-8.5rem)] min-h-[420px] flex-col">
          {/* Toolbar: search, sort, view mode, refresh */}
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-3 border-b border-slate-200 bg-white px-4 py-3">
            <div className="relative min-w-[220px] flex-1 md:max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Tìm tên file, tiêu đề, URL..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`${ADMIN_INPUT} pl-9 pr-8`}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Xóa nội dung tìm kiếm"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <Button
              variant="outline"
              onClick={() => setSortBy((s) => (s === 'newest' ? 'oldest' : 'newest'))}
              className={`${ADMIN_BTN_OUTLINE} gap-1.5`}
              title="Sắp xếp theo ngày"
            >
              <ArrowUpDown className="h-4 w-4 text-blue-600" />
              {sortBy === 'newest' ? 'Mới nhất' : 'Cũ nhất'}
            </Button>

            <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setExplorerView('grid')}
                className={`h-8 w-8 rounded-lg ${explorerView === 'grid' ? 'bg-blue-600 text-white hover:bg-blue-700 hover:text-white' : 'text-slate-500'}`}
                title="Xem dạng lưới"
                aria-label="Xem dạng lưới"
              >
                <Grid className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setExplorerView('list')}
                className={`h-8 w-8 rounded-lg ${explorerView === 'list' ? 'bg-blue-600 text-white hover:bg-blue-700 hover:text-white' : 'text-slate-500'}`}
                title="Xem dạng danh sách"
                aria-label="Xem dạng danh sách"
              >
                <List className="h-4 w-4" />
              </Button>
            </div>

            <Button
              variant="outline"
              size="icon"
              onClick={refresh_media_library}
              className={`${ADMIN_BTN_OUTLINE} w-10 px-0`}
              title={ADMIN_TEXT.refresh}
              aria-label={ADMIN_TEXT.refresh}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>

          {/* Explorer: sidebar + content + inspector */}
          <div className="flex min-h-0 flex-1 overflow-hidden">
            {/* Left navigation */}
            <div className="flex w-60 shrink-0 flex-col space-y-4 overflow-y-auto border-r border-slate-200 bg-white p-3">
              <div>
                <div className="mb-2 flex items-center gap-1.5 px-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                  <FolderTree className="h-3.5 w-3.5 text-blue-600" />
                  Thư mục hệ thống
                </div>
                <div className="space-y-1">
                  {folder_nav_items.map((nav_item) => (
                    <button
                      key={nav_item.id}
                      type="button"
                      onClick={() => setSelectedFolder(nav_item.id)}
                      className={nav_button_class(selectedFolder === nav_item.id)}
                    >
                      <div className="flex items-center gap-2.5">
                        <nav_item.icon className={`h-4 w-4 shrink-0 ${nav_item.icon_color}`} />
                        <span className="truncate">{nav_item.label}</span>
                      </div>
                      <StatusBadge tone="neutral" className="px-2 py-0 text-[11px]">
                        {nav_item.count}
                      </StatusBadge>
                    </button>
                  ))}
                </div>
              </div>

              <div className="border-t border-slate-200 pt-3">
                <div className="mb-2 flex items-center gap-1.5 px-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                  <Filter className="h-3.5 w-3.5 text-blue-600" />
                  Lọc theo loại tệp
                </div>
                <div className="space-y-1">
                  {type_nav_items.map((nav_item) => (
                    <button
                      key={nav_item.id}
                      type="button"
                      onClick={() => setSelectedFolder(nav_item.id)}
                      className={nav_button_class(selectedFolder === nav_item.id)}
                    >
                      <div className="flex items-center gap-2.5">
                        <nav_item.icon className={`h-4 w-4 shrink-0 ${nav_item.icon_color}`} />
                        <span className="truncate">{nav_item.label}</span>
                      </div>
                      <StatusBadge tone="neutral" className="px-2 py-0 text-[11px]">
                        {nav_item.count}
                      </StatusBadge>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Main directory area */}
            <div className="flex min-w-0 flex-1 flex-col overflow-y-auto bg-slate-50/50 p-5">
              {/* Folder shortcuts (all view, no search) */}
              {selectedFolder === 'all' && !searchQuery && (
                <div className="mb-6 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                    <Folder className="h-4 w-4 text-amber-500" />
                    Danh mục thư mục chính
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    {folder_shortcuts.map((folder) => (
                      <div
                        key={folder.id}
                        onClick={() => setSelectedFolder(folder.id)}
                        className={`${ADMIN_CARD} group flex cursor-pointer items-center gap-4 p-4 transition-all hover:border-blue-300 hover:shadow-md`}
                      >
                        <div className={`rounded-xl p-2.5 ${folder.icon_color}`}>
                          <Folder className="h-7 w-7" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-slate-800 transition-colors group-hover:text-blue-700">
                            {getSectionLabel(folder.id)}
                          </div>
                          <div className="text-xs text-slate-500">{folder.desc}</div>
                          <div className="mt-1 text-xs font-semibold text-slate-500">
                            {mediaItems.filter((m) => m.section === folder.id).length} tệp media
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Items header */}
              <div className="mb-4 flex items-center justify-between border-b border-slate-200 pb-2">
                <div className="text-xs font-medium text-slate-500">
                  Hiển thị <span className="font-bold text-slate-800">{visible_media.length}</span> tệp media
                </div>
              </div>

              {/* GRID VIEW */}
              {explorerView === 'grid' && (
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {visible_media.map((m) => {
                    const isSelected = selectedMediaItem?.id === m.id;
                    return (
                      <div
                        key={m.id}
                        onClick={() => setSelectedMediaItem(m)}
                        className={`group relative flex cursor-pointer flex-col overflow-hidden rounded-xl border bg-white transition-all ${
                          isSelected
                            ? 'border-blue-500 shadow-md ring-2 ring-blue-500/30'
                            : 'border-slate-200 shadow-sm hover:border-blue-300 hover:shadow-md'
                        }`}
                      >
                        {/* Thumbnail (dark frame) */}
                        <div className="relative flex aspect-video items-center justify-center overflow-hidden bg-slate-900">
                          {m.type === 'image' ? (
                            <img
                              src={m.url}
                              alt={media_display_name(m)}
                              loading="lazy"
                              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                            />
                          ) : (
                            <div
                              className="relative h-full w-full cursor-pointer"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPlayingVideoId(m.id);
                                setSelectedMediaItem(m);
                              }}
                            >
                              {playingVideoId === m.id ? (
                                <video src={m.url} autoPlay controls className="h-full w-full object-cover" />
                              ) : (
                                <>
                                  {getThumbnail(m.url, m.type) ? (
                                    <img
                                      src={getThumbnail(m.url, m.type)!}
                                      alt={media_display_name(m)}
                                      loading="lazy"
                                      className="h-full w-full object-cover opacity-80 transition-opacity group-hover:opacity-100"
                                    />
                                  ) : (
                                    <div className="flex h-full w-full items-center justify-center bg-slate-900">
                                      <FileVideo className="h-12 w-12 text-slate-600" />
                                    </div>
                                  )}
                                  <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/30 bg-blue-600/70 text-white backdrop-blur-md transition-transform group-hover:scale-110">
                                      <Play className="ml-0.5 h-5 w-5" />
                                    </div>
                                  </div>
                                </>
                              )}
                            </div>
                          )}

                          {/* Section and type badges */}
                          <div className="absolute left-2 top-2 rounded-md border border-slate-200 bg-white/90 px-2 py-0.5 text-[11px] font-semibold text-slate-700 backdrop-blur-md">
                            {getSectionLabel(m.section)}
                          </div>
                          <div className="absolute right-2 top-2 flex items-center gap-1 rounded-md border border-slate-200 bg-white/90 px-2 py-0.5 text-[11px] font-semibold text-slate-700 backdrop-blur-md">
                            {m.type === 'image' ? (
                              <FileImage className="h-3 w-3 text-emerald-600" />
                            ) : (
                              <FileVideo className="h-3 w-3 text-blue-600" />
                            )}
                            {m.type === 'image' ? 'Ảnh' : 'Video'}
                          </div>
                        </div>

                        {/* Info summary */}
                        <div className="flex flex-1 flex-col justify-between space-y-2 p-3">
                          <div>
                            <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                              <span className="flex items-center gap-1.5">
                                {media_status_badge(m)}
                                <span title="Thứ tự hiển thị">#{m.display_order ?? 0}</span>
                              </span>
                              <span className="font-mono">{m.width && m.height ? `${m.width}x${m.height}` : m.format || 'N/A'}</span>
                            </div>
                            <div className="mt-1 truncate text-sm font-medium text-slate-800" title={media_display_name(m)}>
                              {media_display_name(m)}
                            </div>
                            <BranchIdsBadge branch_ids={m.branch_ids} branches={branches} className="mt-1" />
                          </div>

                          <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-xs text-slate-500">
                            <span className="cursor-help" title={media_exact_time(m)}>
                              {m.updated_at ? formatDistanceToNow(new Date(m.updated_at), { addSuffix: true, locale: vi }) : 'N/A'}
                            </span>
                            <RowActionButton
                              action="copy"
                              label="Sao chép URL"
                              onClick={(e) => {
                                e.stopPropagation();
                                copyToClipboard(m.url, m.id);
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* LIST VIEW */}
              {explorerView === 'list' && visible_media.length > 0 && (
                <div className={`${ADMIN_CARD} overflow-hidden`}>
                  <Table>
                    <TableHeader className={ADMIN_TABLE_HEAD}>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className={ADMIN_TH}>Tệp</TableHead>
                        <TableHead className={ADMIN_TH}>Chi nhánh</TableHead>
                        <TableHead className={ADMIN_TH}>Thư mục</TableHead>
                        <TableHead className={ADMIN_TH}>Loại</TableHead>
                        <TableHead className={ADMIN_TH}>Trạng thái</TableHead>
                        <TableHead className={ADMIN_TH}>Thứ tự</TableHead>
                        <TableHead className={ADMIN_TH}>Kích thước</TableHead>
                        <TableHead className={ADMIN_TH}>Ngày cập nhật</TableHead>
                        <TableHead className={`${ADMIN_TH} w-[90px] text-right`}>{ADMIN_TEXT.actionColumn}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visible_media.map((m) => (
                        <TableRow
                          key={m.id}
                          onClick={() => setSelectedMediaItem(m)}
                          className={`cursor-pointer ${selectedMediaItem?.id === m.id ? 'bg-blue-50 hover:bg-blue-50' : ''}`}
                        >
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded border border-slate-200 bg-slate-900">
                                {m.type === 'image' ? (
                                  <img src={m.url} alt={media_display_name(m)} className="h-full w-full object-cover" />
                                ) : (
                                  <FileVideo className="h-4 w-4 text-blue-400" />
                                )}
                              </div>
                              <span className="max-w-[200px] truncate text-xs font-medium text-slate-800" title={media_display_name(m)}>
                                {media_display_name(m)}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <BranchIdsBadge branch_ids={m.branch_ids} branches={branches} />
                          </TableCell>
                          <TableCell>
                            <StatusBadge tone="info">{getSectionLabel(m.section)}</StatusBadge>
                          </TableCell>
                          <TableCell className="text-xs font-semibold text-slate-600">{m.type === 'image' ? 'Ảnh' : 'Video'}</TableCell>
                          <TableCell>{media_status_badge(m)}</TableCell>
                          <TableCell className="text-xs text-slate-500">{m.display_order ?? 0}</TableCell>
                          <TableCell className="text-xs text-slate-500">{m.width && m.height ? `${m.width}x${m.height}` : 'N/A'}</TableCell>
                          <TableCell className="cursor-help whitespace-nowrap text-xs text-slate-500" title={media_exact_time(m)}>
                            {m.updated_at ? formatDistanceToNow(new Date(m.updated_at), { addSuffix: true, locale: vi }) : 'N/A'}
                          </TableCell>
                          <TableCell>
                            <RowActions>
                              <RowActionButton
                                action="copy"
                                label="Sao chép URL"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  copyToClipboard(m.url, m.id);
                                }}
                              />
                              <RowActionButton
                                action="view"
                                label="Xem trực tiếp"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  window.open(m.url, '_blank');
                                }}
                              />
                            </RowActions>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Empty state */}
              {visible_media.length === 0 && (
                <EmptyState
                  icon={<FolderOpen className="h-6 w-6" />}
                  title={mediaItems.filter(matches_folder).length === 0 ? 'Thư mục trống' : 'Không tìm thấy tệp media'}
                  description={
                    mediaItems.filter(matches_folder).length === 0
                      ? 'Không có tệp media nào trong thư mục này.'
                      : 'Hãy thử từ khóa khác.'
                  }
                />
              )}
            </div>

            {/* Right inspector */}
            <div className="flex w-80 shrink-0 flex-col space-y-4 overflow-y-auto border-l border-slate-200 bg-white p-4">
              <div className="flex items-center gap-1.5 border-b border-slate-200 pb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                <Maximize2 className="h-3.5 w-3.5 text-blue-600" />
                Chi tiết tệp media
              </div>

              {selectedMediaItem ? (
                <div className="space-y-4">
                  {/* Media preview (dark frame) */}
                  <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-900">
                    {selectedMediaItem.type === 'image' ? (
                      <img
                        src={selectedMediaItem.url}
                        alt={media_display_name(selectedMediaItem)}
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <video src={selectedMediaItem.url} controls className="h-full w-full object-contain" />
                    )}
                  </div>

                  {/* Properties */}
                  <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
                    <div>
                      <div className="text-[11px] font-bold uppercase text-slate-500">Tên tệp / tiêu đề</div>
                      <div className="break-all font-bold text-slate-800">{media_display_name(selectedMediaItem)}</div>
                    </div>

                    <div>
                      <div className="text-[11px] font-bold uppercase text-slate-500">Chi nhánh</div>
                      <BranchIdsBadge branch_ids={selectedMediaItem.branch_ids} branches={branches} className="mt-1" />
                    </div>

                    <div className="flex items-center gap-4">
                      <div>
                        <div className="text-[11px] font-bold uppercase text-slate-500">Trạng thái</div>
                        <div className="mt-1">{media_status_badge(selectedMediaItem)}</div>
                      </div>
                      <div>
                        <div className="text-[11px] font-bold uppercase text-slate-500">Thứ tự hiển thị</div>
                        <div className="font-medium text-slate-700">{selectedMediaItem.display_order ?? 0}</div>
                      </div>
                    </div>

                    <div>
                      <div className="text-[11px] font-bold uppercase text-slate-500">Thư mục</div>
                      <div className="font-semibold text-blue-700">{getSectionLabel(selectedMediaItem.section)}</div>
                    </div>

                    <div>
                      <div className="text-[11px] font-bold uppercase text-slate-500">Định dạng và kích thước</div>
                      <div className="font-medium text-slate-700">
                        {selectedMediaItem.type.toUpperCase()} •{' '}
                        {selectedMediaItem.width && selectedMediaItem.height
                          ? `${selectedMediaItem.width} x ${selectedMediaItem.height}`
                          : selectedMediaItem.format || 'N/A'}
                      </div>
                    </div>

                    {selectedMediaItem.duration && (
                      <div>
                        <div className="text-[11px] font-bold uppercase text-slate-500">Thời lượng video</div>
                        <div className="font-medium text-slate-700">{Number(selectedMediaItem.duration).toFixed(1)} giây</div>
                      </div>
                    )}

                    <div>
                      <div className="text-[11px] font-bold uppercase text-slate-500">Đường dẫn trực tiếp (URL)</div>
                      <div className="mt-1 select-all break-all rounded border border-slate-200 bg-white p-2 font-mono text-[11px] text-slate-600">
                        {selectedMediaItem.url}
                      </div>
                    </div>

                    <div>
                      <div className="text-[11px] font-bold uppercase text-slate-500">Cập nhật lần cuối</div>
                      <div className="text-[11px] text-slate-500">
                        {selectedMediaItem.updated_at ? formatVnDateTime(selectedMediaItem.updated_at) : 'N/A'}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="space-y-2 pt-2">
                    <Button
                      onClick={() => copyToClipboard(selectedMediaItem.url, selectedMediaItem.id)}
                      className={`${ADMIN_BTN_PRIMARY} w-full gap-2`}
                    >
                      {copiedId === selectedMediaItem.id ? (
                        <>
                          <Check className="h-4 w-4" />
                          Đã sao chép URL
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4" />
                          Sao chép đường dẫn
                        </>
                      )}
                    </Button>

                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="outline"
                        onClick={() => window.open(selectedMediaItem.url, '_blank')}
                        className={`${ADMIN_BTN_OUTLINE} w-full gap-1.5 px-2`}
                      >
                        <ExternalLink className="h-4 w-4 text-blue-600" />
                        Mở tab mới
                      </Button>

                      <Button
                        disabled={mediaLoadingId === selectedMediaItem.id}
                        onClick={() => setItemToDelete(selectedMediaItem)}
                        className={`${ADMIN_BTN_DANGER} w-full gap-1.5 px-2`}
                      >
                        <Trash2 className="h-4 w-4" />
                        Xóa media
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <EmptyState
                  icon={<Info className="h-6 w-6" />}
                  title="Chưa chọn tệp media"
                  description="Chọn một tệp trong danh sách để xem thông tin chi tiết và thao tác."
                />
              )}
            </div>
          </div>
        </div>
      </AdminDialog>

      <ConfirmDialog
        open={!!itemToDelete}
        onOpenChange={(open) => !open && setItemToDelete(null)}
        variant="danger"
        title="Xác nhận xóa tệp media"
        description={
          <span>
            Bạn có chắc chắn muốn xóa vĩnh viễn tệp media{' '}
            <strong className="text-slate-900">{itemToDelete ? media_display_name(itemToDelete) : ''}</strong> không? Hành động
            này không thể hoàn tác.
          </span>
        }
        confirmText="Xóa vĩnh viễn"
        busy={!!mediaLoadingId}
        onConfirm={confirm_delete_media}
      />
    </div>
  );
}
