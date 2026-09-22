import React, { useRef, useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import {
  uploadAdminVideo,
  uploadDirectToCloudinary,
  createSiteMediaApi,
  getSiteMediaApi,
  updateSiteMediaApi,
  deleteSiteMediaApi
} from '@/lib/api/uploads';
import { toast } from 'sonner';
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
  Layout,
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
  ChevronRight,
  HardDrive,
  Filter,
  ArrowUpDown,
  Play,
  Maximize2
} from 'lucide-react';
import { ConfirmDeleteDialog } from '@/components/admin/dialogs/ConfirmDeleteDialog';

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
  const [statusLines, setStatusLines] = useState<string[]>([]);
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

  const copyToClipboard = (text: string, id: number) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success('Đã sao chép URL vào bộ nhớ tạm!');
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

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const arr = Array.from(e.target.files || []);
    setFiles(arr);

    // Only reset if we are essentially idle (no active uploads)
    // blocking interactions prevents adding to queue while uploading, which we want to avoid.
    // However, if we blindly keep uploads, we might keep "done" ones forever.
    // Let's decided: If there are ANY pending/uploading items, we DO NOT reset.
    // If all are done/error, we CAN reset (or maybe user wants to clear manually).
    // The user complaint is they CANNOT select. The previous code forced a reset.

    const hasActive = uploads.some((u) => u.status === 'pending' || u.status === 'uploading');
    if (!hasActive && arr.length > 0) {
      // If mixed done/error and we pick new files, maybe we should just keep them until manual clear?
      // But to be safe and consistent with previous "refresh" behavior on new batch:
      if (uploads.length > 0) {
        // Auto-clear old finished tasks if user picks new ones?
        // Or just append?
        // User interaction implies "Add more".
        // Let's NOT clear automatically. Let the user use the "Refresh" button to clear.
      }
    }
    // We remove the auto-reset logic entirely. User must clear manually if they want.
    // EXCEPT: if files was empty and we pick new, we might want to reset stage if it was "done".
    // But stage is derivative.
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
              setStatusLines((prev) => [
                ...prev,
                `Đã nén ảnh [${nextItem.name}] (${formatSize(finalFile.size)} từ ${formatSize(nextItem.size)}), đang upload...`
              ]);
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
              setStatusLines((prev) => [
                ...prev,
                `Đã cập nhật [${nextItem.name}] vào ${nextItem.section} (ID: ${nextItem.targetId})`
              ]);
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
              setStatusLines((prev) => [...prev, `Đã tạo mới [${nextItem.name}] vào ${nextItem.section}`]);
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
            setStatusLines((prev) => [
              ...prev,
              `Tải lên thất bại [${nextItem.name}]: ${err?.message || 'Có lỗi xảy ra'}`
            ]);
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
              `Mục ${section} đã đạt giới hạn 6 video. Hành động này sẽ GHI ĐÈ lên video thứ 6 (ID: ${target.id}).`
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
          setConfirmMessage(`Mục ${section} đã có dữ liệu. Hành động này sẽ CẬP NHẬT thay thế nội dung cũ.`);
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
    setStatusLines((prev) => [...prev, 'Đã thêm vào hàng đợi...']);
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

  return (
    <Card className="bg-gradient-to-br from-slate-900 to-slate-800 text-white border border-white/10">
      <CardHeader className="pb-4">
        <CardTitle className="text-2xl font-bold">Quản lý tệp media</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Upload Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column - Upload Controls */}
          <div className="space-y-6">
            <div className="space-y-3">
              <Label className="text-sm font-semibold text-blue-200 flex items-center gap-2">
                <CloudUpload className="w-4 h-4" />
                Chọn video hoặc ảnh
              </Label>
              <div
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                className={`
                  relative group cursor-pointer
                  border-2 border-dashed border-white/20 
                  hover:border-blue-500/50 hover:bg-blue-500/5 
                  transition-all duration-300 rounded-2xl 
                  p-8 flex flex-col items-center justify-center gap-3
                  bg-white/5 backdrop-blur-sm
                `}
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept="video/*,image/*"
                  multiple
                  onChange={onPickFile}
                  className="hidden"
                />
                <div className="w-14 h-14 rounded-full bg-blue-500/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <Upload className="w-7 h-7 text-blue-400" />
                </div>
                <div className="text-center">
                  <p className="text-white font-medium">Nhấn để chọn hoặc kéo thả files vào đây</p>
                  <p className="text-gray-400 text-xs mt-1">Hỗ trợ Video (MP4, MOV) và Hình ảnh (JPG, PNG, WEBP)</p>
                </div>
              </div>

              {files.length > 0 && (
                <div className="flex items-center gap-2 px-3 py-2 bg-blue-500/10 border border-blue-500/20 rounded-lg animate-in fade-in slide-in-from-top-1">
                  <CheckCircle2 className="w-4 h-4 text-blue-400" />
                  <span className="text-xs text-blue-300 font-medium">
                    Đã chọn {files.length} tệp ({formatSize(files.reduce((s, f) => s + f.size, 0))})
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setFiles([]);
                      if (fileRef.current) fileRef.current.value = '';
                    }}
                    className="ml-auto p-1 hover:bg-white/10 rounded-full transition-colors"
                  >
                    <X className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
              )}

              {files.length === 1 && files[0] && !/^video\//.test(files[0].type) && !/^image\//.test(files[0].type) && (
                <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 p-2 rounded-lg">
                  <AlertCircle className="w-4 h-4" />
                  Tệp đã chọn không phải video/ảnh hợp lệ
                </div>
              )}
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-semibold text-blue-200 flex items-center gap-2">
                <Layout className="w-4 h-4" />
                Vị trí hiển thị
              </Label>
              <div className="relative group">
                <select
                  className="w-full bg-slate-800 text-white border border-white/20 rounded-xl px-4 py-3 h-12 focus:outline-none focus:ring-2 focus:ring-blue-500/50 appearance-none cursor-pointer transition-all hover:border-white/30"
                  value={section}
                  onChange={(e) => setSection(e.target.value as any)}
                >
                  <option value="hero_section">Banner trang chủ</option>
                  <option value="technology_section1">Banner công nghệ</option>
                  <option value="technology_section2">Danh sách công nghệ</option>
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
              <div className="flex items-start gap-2 text-xs text-gray-400 px-1">
                <Info className="w-3.5 h-3.5 mt-0.5 text-blue-400/70" />
                <span>Media sẽ được upload và áp dụng trực tiếp cho phần này trên website.</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-white/10">
              <Button
                disabled={!files.length || uploads.some((u) => u.status === 'uploading' || u.status === 'pending')}
                onClick={checkAndPrepareUpload}
                className="bg-blue-600 hover:bg-blue-700 h-11 px-8 rounded-xl font-bold shadow-lg shadow-blue-900/20 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <CloudUpload className="w-5 h-5" />
                {uploads.some((u) => u.status === 'uploading' || u.status === 'pending')
                  ? 'Đang xử lý...'
                  : 'Bắt đầu tải lên'}
              </Button>
              <Button
                variant="outline"
                size="icon"
                disabled={uploads.some((u) => u.status === 'uploading' || u.status === 'pending')}
                onClick={() => {
                  setFiles([]);
                  setUploads([]);
                  if (fileRef.current) fileRef.current.value = '';
                  setPreviewUrl(null);
                  setStatusLines([]);
                  setStage('idle');
                }}
                className="rounded-xl shadow-sm hover:rotate-180 transition-transform duration-500 shrink-0 h-11 w-11 flex items-center justify-center bg-white/5 border-white/20 text-white disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:rotate-0"
                title="Làm mới"
              >
                <RefreshCw className="w-5 h-5" />
              </Button>

              <div className="hidden sm:block sm:flex-1" />

              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    const { items } = await getSiteMediaApi({});
                    setMediaItems(items);
                    setOpenMediaModal(true);
                  } catch (err: any) {
                    toast.error('Lỗi tải danh sách', { description: err?.message || 'Không thể tải site media' });
                  }
                }}
                className="text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 border-blue-500/20 h-11 px-6 rounded-xl transition-all flex items-center gap-2"
              >
                <Grid3X3 className="w-4 h-4" />
                Thư viện Site Media
              </Button>
            </div>
          </div>

          {/* Right Column - Preview Card */}
          <div className="relative group">
            {files.length === 1 && previewUrl ? (
              <div className="h-full rounded-2xl border border-white/10 bg-black/40 backdrop-blur-md overflow-hidden flex flex-col shadow-2xl">
                <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/5">
                  <div className="flex items-center gap-2">
                    {/^image\//.test(files[0].type) ? (
                      <FileImage className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <FileVideo className="w-4 h-4 text-blue-400" />
                    )}
                    <span className="text-sm font-semibold truncate max-w-[200px]">{files[0].name}</span>
                  </div>
                  <span className="text-[10px] uppercase tracking-wider font-bold text-gray-500 bg-white/5 px-2 py-0.5 rounded">
                    Preview
                  </span>
                </div>

                <div className="relative flex-1 bg-black/20 flex items-center justify-center p-6">
                  <div className="w-full h-full rounded-lg overflow-hidden shadow-center-lg bg-gray-900 flex items-center justify-center border border-white/5">
                    {/^image\//.test(files[0].type) ? (
                      <img
                        src={previewUrl}
                        alt={files[0].name}
                        className="w-full h-full object-contain max-h-[400px] animate-in zoom-in-95 duration-500"
                      />
                    ) : (
                      <video src={previewUrl} controls className="w-full h-full object-contain max-h-[400px]" />
                    )}
                  </div>
                </div>

                <div className="p-5 bg-black/40 border-t border-white/10 mt-auto">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-1">
                      <p className="text-[10px] text-gray-500 font-bold uppercase tracking-tight">Kích thước</p>
                      <p className="text-sm text-white font-medium">{formatSize(files[0].size || 0)}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] text-gray-500 font-bold uppercase tracking-tight">Định dạng</p>
                      <p className="text-sm text-white font-medium truncate">{files[0].type || 'N/A'}</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full min-h-[400px] rounded-2xl border-2 border-dashed border-white/10 bg-white/5 flex flex-col items-center justify-center text-center p-12 group-hover:bg-white/10 transition-all duration-500">
                <div className="w-24 h-24 rounded-3xl bg-white/5 flex items-center justify-center mb-6 group-hover:rotate-12 transition-transform duration-500 border border-white/10">
                  <Monitor className="w-10 h-10 text-gray-600 group-hover:text-blue-500/50 transition-colors" />
                </div>
                <h3 className="text-white font-semibold text-lg mb-2">Chưa có tệp nào được chọn</h3>
                <p className="text-gray-500 text-sm max-w-[250px]">
                  Chọn một tệp để xem trước chi tiết nội dung và thuộc tính trước khi tải lên.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Progress Section */}
        {(!!uploads.length || !!statusLines.length || files.length > 0) && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-6 shadow-xl backdrop-blur-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
            {!!uploads.length && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-blue-200 uppercase tracking-wider flex items-center gap-2">
                    <RefreshCw className={`w-4 h-4 ${stage === 'uploading' ? 'animate-spin' : ''}`} />
                    Tiến trình trực tiếp
                  </h3>
                  <span className="text-[10px] text-gray-500 bg-white/5 px-2 py-0.5 rounded-full border border-white/10">
                    {uploads.filter((u) => u.status === 'done').length}/{uploads.length} Hoàn thành
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {uploads.map((u) => (
                    <div
                      key={u.id}
                      className="relative group rounded-xl bg-white/5 border border-white/10 p-4 transition-all hover:bg-white/10 overflow-hidden"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3 overflow-hidden">
                          <div
                            className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                              u.status === 'done'
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : u.status === 'error'
                                  ? 'bg-red-500/20 text-red-400'
                                  : 'bg-blue-500/20 text-blue-400'
                            }`}
                          >
                            {u.isImage ? <FileImage className="w-5 h-5" /> : <FileVideo className="w-5 h-5" />}
                          </div>
                          <div className="overflow-hidden">
                            <div className="text-sm text-white font-semibold truncate">{u.name}</div>
                            <div className="text-[10px] text-gray-500 font-medium">
                              {formatSize(u.size)} • {u.type.split('/')[1]?.toUpperCase() || 'N/A'}
                            </div>
                          </div>
                        </div>
                        <div
                          className={`shrink-0 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-tighter ${
                            u.status === 'done'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : u.status === 'error'
                                ? 'bg-red-500/20 text-red-400'
                                : u.status === 'uploading'
                                  ? 'bg-blue-500/20 text-blue-400 animate-pulse'
                                  : 'bg-gray-500/20 text-gray-400'
                          }`}
                        >
                          {u.status === 'done'
                            ? 'Xong'
                            : u.status === 'error'
                              ? 'Lỗi'
                              : u.status === 'uploading'
                                ? 'Đang tải'
                                : 'Chờ'}
                        </div>
                      </div>

                      <div className="space-y-3">
                        {u.isImage && u.status !== 'done' && u.status !== 'error' && (
                          <div className="space-y-1.5">
                            <div className="flex justify-between text-[10px] font-bold text-gray-400">
                              <span>Nén ảnh</span>
                              <span>{u.compressProgress || 0}%</span>
                            </div>
                            <Progress value={u.compressProgress || 0} className="h-1 bg-white/5" />
                          </div>
                        )}

                        {u.status !== 'done' && u.status !== 'error' && (
                          <div className="space-y-1.5">
                            <div className="flex justify-between text-[10px] font-bold text-gray-400">
                              <span>Tải lên</span>
                              <span>{u.uploadProgress}%</span>
                            </div>
                            <Progress value={u.uploadProgress} className="h-1 bg-white/5" />
                          </div>
                        )}

                        {u.status === 'done' && (
                          <div className="flex items-center gap-2 text-[11px] text-emerald-400 font-medium py-1 animate-in fade-in">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Tải lên thành công
                          </div>
                        )}

                        {u.error && (
                          <div className="flex items-center gap-2 text-[11px] text-red-400 font-medium py-1">
                            <AlertCircle className="w-3.5 h-3.5" />
                            {u.error}
                          </div>
                        )}
                      </div>

                      {/* Cancel/Remove Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setUploads((prev) => prev.filter((x) => x.id !== u.id));
                        }}
                        className="absolute top-2 right-2 p-1.5 rounded-full hover:bg-white/10 text-gray-500 hover:text-white transition-colors"
                        title="Hủy / Xóa"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!uploads.length && files.length > 0 && (
              <div className="rounded-xl bg-blue-500/5 border border-blue-500/20 p-5 flex items-center gap-4 animate-in fade-in slide-in-from-left-4">
                <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
                  <Info className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-blue-300">Sẵn sàng tải lên</h4>
                  <p className="text-xs text-blue-400/60 mt-0.5">
                    Nhấn nút <span className="text-blue-300 font-bold">"Bắt đầu tải lên"</span> để xử lý {files.length}{' '}
                    tệp đã chọn.
                  </p>
                </div>
              </div>
            )}

            {!!statusLines.length && (
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-gray-600" />
                  Hoạt động hệ thống
                </h3>
                <div className="rounded-xl bg-black/40 p-4 max-h-40 overflow-y-auto border border-white/5 font-mono">
                  {statusLines.map((ln, idx) => (
                    <div
                      key={idx}
                      className="text-[10px] text-gray-500 py-1 flex gap-2 border-b border-white/5 last:border-0"
                    >
                      <span className="text-blue-500/50 shrink-0">
                        [{new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}]
                      </span>
                      <span className="leading-relaxed">{ln}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <Dialog open={openConfirm} onOpenChange={setOpenConfirm}>
          <DialogContent className="bg-white text-black border-gray-200">
            <DialogHeader>
              <DialogTitle>Xác nhận tải lên</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="text-sm text-gray-700">
                {confirmMessage ||
                  (files.length === 1 && /^image\//.test(files[0].type)
                    ? 'Bạn có chắc muốn tải lên ảnh này?'
                    : 'Bạn có chắc muốn tải lên các tệp đã chọn?')}
              </div>
              <div className="flex gap-2">
                <Button onClick={startUpload}>Xác nhận</Button>
                <Button variant="secondary" onClick={() => setOpenConfirm(false)}>
                  Hủy
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog
          open={openMediaModal}
          onOpenChange={(val) => {
            setOpenMediaModal(val);
            if (!val) {
              setPlayingVideoId(null);
              setSelectedMediaItem(null);
            }
          }}
        >
          <DialogContent className="bg-slate-950 text-white border-white/10 max-w-7xl w-[96vw] h-[90vh] flex flex-col p-0 overflow-hidden shadow-2xl [&>button]:hidden">
            {/* Explorer Header Bar */}
            <div className="p-4 border-b border-white/10 bg-slate-900/90 flex flex-col md:flex-row items-center justify-between gap-4 shrink-0">
              <div className="flex items-center gap-3 w-full md:w-auto">
                <div className="w-10 h-10 rounded-xl bg-blue-600/20 flex items-center justify-center border border-blue-500/30 text-blue-400">
                  <HardDrive className="w-5 h-5" />
                </div>
                <div>
                  <DialogTitle className="text-base font-bold flex items-center gap-2 text-white">
                    Thư viện media
                    <span className="text-xs font-normal text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
                      v2.0
                    </span>
                  </DialogTitle>
                  <p className="text-xs text-gray-400 flex items-center gap-1.5 mt-0.5 font-mono">
                    <Folder className="w-3.5 h-3.5 text-yellow-500" />
                    <span>Thư viện</span>
                    <ChevronRight className="w-3 h-3 text-gray-500" />
                    <span className="text-blue-300 font-semibold">{getSectionLabel(selectedFolder)}</span>
                  </p>
                </div>
              </div>

              {/* Explorer Search & Controls Toolbar */}
              <div className="flex items-center gap-3 w-full md:w-auto flex-wrap justify-end">
                {/* Search Bar */}
                <div className="relative flex-1 md:w-64">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <Input
                    placeholder="Tìm tên file, ID, URL..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-black/40 border-white/10 pl-9 pr-8 h-9 text-xs text-white placeholder:text-gray-500 rounded-lg focus:border-blue-500"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Sort dropdown */}
                <div className="flex items-center gap-1 bg-black/40 border border-white/10 rounded-lg p-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSortBy((s) => (s === 'newest' ? 'oldest' : 'newest'))}
                    className="h-7 px-2.5 text-xs text-gray-300 hover:text-white hover:bg-white/10 flex items-center gap-1"
                    title="Sắp xếp ngày"
                  >
                    <ArrowUpDown className="w-3.5 h-3.5 text-blue-400" />
                    <span>{sortBy === 'newest' ? 'Mới nhất' : 'Cũ nhất'}</span>
                  </Button>
                </div>

                {/* View Mode Switcher */}
                <div className="flex items-center bg-black/40 border border-white/10 rounded-lg p-1 gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setExplorerView('grid')}
                    className={`h-7 w-7 rounded ${explorerView === 'grid' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
                    title="Xem dạng lưới"
                  >
                    <Grid className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setExplorerView('list')}
                    className={`h-7 w-7 rounded ${explorerView === 'list' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
                    title="Xem dạng danh sách"
                  >
                    <List className="w-4 h-4" />
                  </Button>
                </div>

                {/* Refresh */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={async () => {
                    try {
                      const { items } = await getSiteMediaApi({});
                      setMediaItems(items);
                      toast.success('Đã làm mới dữ liệu media');
                    } catch (err: any) {
                      toast.error('Không thể làm mới');
                    }
                  }}
                  className="h-9 w-9 border border-white/10 hover:bg-white/10 text-gray-300 rounded-lg"
                  title="Tải lại thư viện"
                >
                  <RefreshCw className="w-4 h-4" />
                </Button>

                {/* Close Button */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setOpenMediaModal(false)}
                  className="h-9 w-9 border border-white/10 hover:bg-red-500/20 text-gray-400 hover:text-red-400 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>
            </div>

            {/* Main Explorer Explorer Container (Sidebar + Content + Inspector) */}
            <div className="flex-1 flex overflow-hidden bg-slate-950">
              {/* Left Navigation Tree Sidebar */}
              <div className="w-64 border-r border-white/10 bg-slate-900/60 p-3 flex flex-col space-y-4 shrink-0 overflow-y-auto custom-scrollbar">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 px-2 mb-2 flex items-center gap-1.5">
                    <FolderTree className="w-3.5 h-3.5 text-blue-400" />
                    Thư mục hệ thống
                  </div>
                  <div className="space-y-1">
                    <button
                      onClick={() => setSelectedFolder('all')}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                        selectedFolder === 'all'
                          ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30'
                          : 'text-gray-300 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <FolderOpen className="w-4 h-4 text-yellow-500 shrink-0" />
                        <span className="truncate">Tất cả Media</span>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/10 text-gray-300">
                        {mediaItems.length}
                      </span>
                    </button>

                    <button
                      onClick={() => setSelectedFolder('hero_section')}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                        selectedFolder === 'hero_section'
                          ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30'
                          : 'text-gray-300 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Folder className="w-4 h-4 text-blue-400 shrink-0" />
                        <span className="truncate">Banner trang chủ</span>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/10 text-gray-300">
                        {mediaItems.filter((m) => m.section === 'hero_section').length}
                      </span>
                    </button>

                    <button
                      onClick={() => setSelectedFolder('technology_section1')}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                        selectedFolder === 'technology_section1'
                          ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30'
                          : 'text-gray-300 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Folder className="w-4 h-4 text-purple-400 shrink-0" />
                        <span className="truncate">Banner công nghệ</span>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/10 text-gray-300">
                        {mediaItems.filter((m) => m.section === 'technology_section1').length}
                      </span>
                    </button>

                    <button
                      onClick={() => setSelectedFolder('technology_section2')}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                        selectedFolder === 'technology_section2'
                          ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30'
                          : 'text-gray-300 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Folder className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span className="truncate">Danh sách công nghệ</span>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/10 text-gray-300">
                        {mediaItems.filter((m) => m.section === 'technology_section2').length}
                      </span>
                    </button>
                  </div>
                </div>

                <div className="pt-2 border-t border-white/10">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 px-2 mb-2 flex items-center gap-1.5">
                    <Filter className="w-3.5 h-3.5 text-blue-400" />
                    Lọc theo loại tệp
                  </div>
                  <div className="space-y-1">
                    <button
                      onClick={() => setSelectedFolder('image')}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                        selectedFolder === 'image'
                          ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/30'
                          : 'text-gray-300 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <FileImage className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span className="truncate">Hình ảnh</span>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400">
                        {mediaItems.filter((m) => m.type === 'image').length}
                      </span>
                    </button>

                    <button
                      onClick={() => setSelectedFolder('video')}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                        selectedFolder === 'video'
                          ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30'
                          : 'text-gray-300 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <FileVideo className="w-4 h-4 text-blue-400 shrink-0" />
                        <span className="truncate">Video Clips</span>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-400">
                        {mediaItems.filter((m) => m.type === 'video').length}
                      </span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Main Directory Area */}
              <div className="flex-1 overflow-y-auto p-5 custom-scrollbar flex flex-col bg-slate-950/60">
                {/* Folder Shortcuts (shown when in 'all' view with no search) */}
                {selectedFolder === 'all' && !searchQuery && (
                  <div className="mb-6 space-y-3">
                    <div className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                      <Folder className="w-4 h-4 text-yellow-500" />
                      Danh mục thư mục chính
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {[
                        {
                          id: 'hero_section',
                          label: 'Banner trang chủ',
                          desc: 'Banner chính trang chủ',
                          color: 'from-blue-600/20 to-indigo-600/10 border-blue-500/30 text-blue-400',
                          icon: <Folder className="w-8 h-8 text-blue-400" />,
                          count: mediaItems.filter((m) => m.section === 'hero_section').length
                        },
                        {
                          id: 'technology_section1',
                          label: 'Banner công nghệ',
                          desc: 'Banner giới thiệu công nghệ',
                          color: 'from-purple-600/20 to-pink-600/10 border-purple-500/30 text-purple-400',
                          icon: <Folder className="w-8 h-8 text-purple-400" />,
                          count: mediaItems.filter((m) => m.section === 'technology_section1').length
                        },
                        {
                          id: 'technology_section2',
                          label: 'Danh sách công nghệ',
                          desc: 'Danh sách tính năng công nghệ',
                          color: 'from-emerald-600/20 to-teal-600/10 border-emerald-500/30 text-emerald-400',
                          icon: <Folder className="w-8 h-8 text-emerald-400" />,
                          count: mediaItems.filter((m) => m.section === 'technology_section2').length
                        }
                      ].map((folder) => (
                        <div
                          key={folder.id}
                          onClick={() => setSelectedFolder(folder.id)}
                          className={`cursor-pointer rounded-2xl p-4 bg-gradient-to-br ${folder.color} border transition-all hover:scale-[1.02] hover:shadow-lg flex items-center gap-4 group`}
                        >
                          <div className="p-2.5 rounded-xl bg-black/30 group-hover:scale-110 transition-transform">
                            {folder.icon}
                          </div>
                          <div>
                            <div className="font-bold text-sm text-white group-hover:text-blue-300 transition-colors">
                              {folder.label}
                            </div>
                            <div className="text-[11px] text-gray-400">{folder.desc}</div>
                            <div className="text-[10px] text-gray-500 font-semibold mt-1">
                              {folder.count} tệp media
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Filter & Items Header */}
                <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/5">
                  <div className="text-xs text-gray-400 font-medium">
                    Hiển thị{' '}
                    <span className="text-white font-bold">
                      {
                        mediaItems
                          .filter((m) => {
                            if (selectedFolder === 'hero_section') return m.section === 'hero_section';
                            if (selectedFolder === 'technology_section1') return m.section === 'technology_section1';
                            if (selectedFolder === 'technology_section2') return m.section === 'technology_section2';
                            if (selectedFolder === 'image') return m.type === 'image';
                            if (selectedFolder === 'video') return m.type === 'video';
                            return true;
                          })
                          .filter((m) => {
                            if (!searchQuery.trim()) return true;
                            const q = searchQuery.toLowerCase();
                            return (
                              String(m.id).includes(q) ||
                              (m.url || '').toLowerCase().includes(q) ||
                              (m.section || '').toLowerCase().includes(q)
                            );
                          }).length
                      }
                    </span>{' '}
                    tệp media
                  </div>
                </div>

                {/* Media Files Display (GRID VIEW) */}
                {explorerView === 'grid' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {mediaItems
                      .filter((m) => {
                        if (selectedFolder === 'hero_section') return m.section === 'hero_section';
                        if (selectedFolder === 'technology_section1') return m.section === 'technology_section1';
                        if (selectedFolder === 'technology_section2') return m.section === 'technology_section2';
                        if (selectedFolder === 'image') return m.type === 'image';
                        if (selectedFolder === 'video') return m.type === 'video';
                        return true;
                      })
                      .filter((m) => {
                        if (!searchQuery.trim()) return true;
                        const q = searchQuery.toLowerCase();
                        return (
                          String(m.id).includes(q) ||
                          (m.url || '').toLowerCase().includes(q) ||
                          (m.section || '').toLowerCase().includes(q)
                        );
                      })
                      .sort((a, b) => {
                        if (sortBy === 'oldest')
                          return (
                            new Date(a.created_at || a.updated_at || 0).getTime() -
                            new Date(b.created_at || b.updated_at || 0).getTime()
                          );
                        return (
                          new Date(b.created_at || b.updated_at || 0).getTime() -
                          new Date(a.created_at || a.updated_at || 0).getTime()
                        );
                      })
                      .map((m) => {
                        const isSelected = selectedMediaItem?.id === m.id;
                        return (
                          <div
                            key={m.id}
                            onClick={() => setSelectedMediaItem(m)}
                            className={`group relative rounded-2xl border bg-slate-900 overflow-hidden flex flex-col cursor-pointer transition-all ${
                              isSelected
                                ? 'border-blue-500 ring-2 ring-blue-500/40 shadow-xl shadow-blue-900/30'
                                : 'border-white/10 hover:border-blue-500/40 hover:shadow-lg'
                            }`}
                          >
                            {/* Media Thumbnail */}
                            <div className="aspect-video bg-black/40 relative flex items-center justify-center overflow-hidden">
                              {m.type === 'image' ? (
                                <img
                                  src={m.url}
                                  alt={m.section}
                                  loading="lazy"
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                />
                              ) : (
                                <div
                                  className="relative w-full h-full cursor-pointer"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setPlayingVideoId(m.id);
                                    setSelectedMediaItem(m);
                                  }}
                                >
                                  {playingVideoId === m.id ? (
                                    <video src={m.url} autoPlay controls className="w-full h-full object-cover" />
                                  ) : (
                                    <>
                                      {getThumbnail(m.url, m.type) ? (
                                        <img
                                          src={getThumbnail(m.url, m.type)!}
                                          alt={m.section}
                                          loading="lazy"
                                          className="w-full h-full object-cover opacity-70 group-hover:opacity-90 transition-opacity"
                                        />
                                      ) : (
                                        <div className="w-full h-full bg-slate-900 flex items-center justify-center">
                                          <FileVideo className="w-12 h-12 text-blue-500/20" />
                                        </div>
                                      )}
                                      <div className="absolute inset-0 flex items-center justify-center">
                                        <div className="w-10 h-10 rounded-full bg-blue-600/30 backdrop-blur-md flex items-center justify-center text-white border border-white/20 group-hover:scale-110 transition-transform">
                                          <Play className="w-5 h-5 ml-0.5" />
                                        </div>
                                      </div>
                                    </>
                                  )}
                                </div>
                              )}

                              {/* Section Badge */}
                              <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-md border border-white/10 text-[9px] font-bold uppercase tracking-wider text-blue-300">
                                {m.section.replace('_', ' ')}
                              </div>

                              {/* Type Badge */}
                              <div className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-md border border-white/10 text-[9px] font-bold uppercase tracking-wider flex items-center gap-1">
                                {m.type === 'image' ? (
                                  <FileImage className="w-3 h-3 text-emerald-400" />
                                ) : (
                                  <FileVideo className="w-3 h-3 text-blue-400" />
                                )}
                                <span className={m.type === 'image' ? 'text-emerald-300' : 'text-blue-300'}>
                                  {m.type}
                                </span>
                              </div>
                            </div>

                            {/* Info Summary */}
                            <div className="p-3 flex-1 flex flex-col justify-between space-y-2">
                              <div>
                                <div className="flex items-center justify-between text-[10px] text-gray-400 font-mono">
                                  <span>ID: #{m.id}</span>
                                  <span>{m.width && m.height ? `${m.width}x${m.height}` : m.format || 'N/A'}</span>
                                </div>
                                <div className="text-xs text-white font-medium truncate mt-1">{m.url}</div>
                              </div>

                              <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[10px] text-gray-500">
                                <span>
                                  {m.updated_at
                                    ? formatDistanceToNow(new Date(m.updated_at), { addSuffix: true, locale: vi })
                                    : 'N/A'}
                                </span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    copyToClipboard(m.url, m.id);
                                  }}
                                  className="h-6 px-2 text-[10px] text-blue-400 hover:bg-blue-500/10 rounded"
                                >
                                  {copiedId === m.id ? (
                                    <Check className="w-3 h-3 text-emerald-400" />
                                  ) : (
                                    <Copy className="w-3 h-3" />
                                  )}
                                </Button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}

                {/* Media Files Display (LIST VIEW TABLE) */}
                {explorerView === 'list' && (
                  <div className="rounded-xl border border-white/10 bg-slate-900 overflow-hidden">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-white/10 bg-white/5 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                          <th className="p-3">Tệp</th>
                          <th className="p-3">ID</th>
                          <th className="p-3">Thư mục (Section)</th>
                          <th className="p-3">Loại</th>
                          <th className="p-3">Kích thước</th>
                          <th className="p-3">Ngày cập nhật</th>
                          <th className="p-3 text-right">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 text-xs">
                        {mediaItems
                          .filter((m) => {
                            if (selectedFolder === 'hero_section') return m.section === 'hero_section';
                            if (selectedFolder === 'technology_section1') return m.section === 'technology_section1';
                            if (selectedFolder === 'technology_section2') return m.section === 'technology_section2';
                            if (selectedFolder === 'image') return m.type === 'image';
                            if (selectedFolder === 'video') return m.type === 'video';
                            return true;
                          })
                          .filter((m) => {
                            if (!searchQuery.trim()) return true;
                            const q = searchQuery.toLowerCase();
                            return (
                              String(m.id).includes(q) ||
                              (m.url || '').toLowerCase().includes(q) ||
                              (m.section || '').toLowerCase().includes(q)
                            );
                          })
                          .map((m) => (
                            <tr
                              key={m.id}
                              onClick={() => setSelectedMediaItem(m)}
                              className={`cursor-pointer hover:bg-white/5 transition-colors ${
                                selectedMediaItem?.id === m.id ? 'bg-blue-600/20 text-white font-medium' : 'text-gray-300'
                              }`}
                            >
                              <td className="p-3 flex items-center gap-3">
                                <div className="w-8 h-8 rounded bg-black/40 overflow-hidden shrink-0 flex items-center justify-center border border-white/10">
                                  {m.type === 'image' ? (
                                    <img src={m.url} className="w-full h-full object-cover" />
                                  ) : (
                                    <FileVideo className="w-4 h-4 text-blue-400" />
                                  )}
                                </div>
                                <span className="truncate max-w-[200px] text-xs font-mono">{m.url}</span>
                              </td>
                              <td className="p-3 font-mono text-gray-400">#{m.id}</td>
                              <td className="p-3">
                                <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 text-[10px] font-bold">
                                  {m.section}
                                </span>
                              </td>
                              <td className="p-3 uppercase text-[10px] font-bold">
                                <span
                                  className={m.type === 'image' ? 'text-emerald-400' : 'text-blue-400'}
                                >
                                  {m.type}
                                </span>
                              </td>
                              <td className="p-3 text-gray-400 text-[11px]">
                                {m.width && m.height ? `${m.width}x${m.height}` : 'N/A'}
                              </td>
                              <td className="p-3 text-gray-400 text-[11px]">
                                {m.updated_at
                                  ? formatDistanceToNow(new Date(m.updated_at), { addSuffix: true, locale: vi })
                                  : 'N/A'}
                              </td>
                              <td className="p-3 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      copyToClipboard(m.url, m.id);
                                    }}
                                    className="h-7 w-7 text-gray-400 hover:text-white"
                                    title="Sao chép URL"
                                  >
                                    <Copy className="w-3.5 h-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      window.open(m.url, '_blank');
                                    }}
                                    className="h-7 w-7 text-gray-400 hover:text-white"
                                    title="Xem trực tiếp"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Empty State */}
                {mediaItems.filter((m) => {
                  if (selectedFolder === 'hero_section') return m.section === 'hero_section';
                  if (selectedFolder === 'technology_section1') return m.section === 'technology_section1';
                  if (selectedFolder === 'technology_section2') return m.section === 'technology_section2';
                  if (selectedFolder === 'image') return m.type === 'image';
                  if (selectedFolder === 'video') return m.type === 'video';
                  return true;
                }).length === 0 && (
                  <div className="flex flex-col items-center justify-center py-20 text-gray-500">
                    <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                      <FolderOpen className="w-8 h-8 opacity-40 text-yellow-500" />
                    </div>
                    <h4 className="text-base font-semibold text-gray-300">Thư mục trống</h4>
                    <p className="text-xs text-gray-500 mt-1">Không có tệp media nào trong thư mục này.</p>
                  </div>
                )}
              </div>

              {/* Right Inspector & Details Pane */}
              <div className="w-80 border-l border-white/10 bg-slate-900/80 p-4 flex flex-col space-y-4 shrink-0 overflow-y-auto custom-scrollbar">
                <div className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5 pb-2 border-b border-white/10">
                  <Maximize2 className="w-3.5 h-3.5 text-blue-400" />
                  Chi tiết tệp Media
                </div>

                {selectedMediaItem ? (
                  <div className="space-y-4">
                    {/* Media Preview Window */}
                    <div className="aspect-video rounded-xl bg-black border border-white/10 overflow-hidden relative flex items-center justify-center">
                      {selectedMediaItem.type === 'image' ? (
                        <img
                          src={selectedMediaItem.url}
                          alt="Xem trước"
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <video src={selectedMediaItem.url} controls className="w-full h-full object-contain" />
                      )}
                    </div>

                    {/* Meta Properties List */}
                    <div className="space-y-3 bg-black/40 rounded-xl p-3 border border-white/5 text-xs">
                      <div>
                        <div className="text-[10px] text-gray-500 font-bold uppercase">ID Tệp</div>
                        <div className="font-mono text-white font-bold">#{selectedMediaItem.id}</div>
                      </div>

                      <div>
                        <div className="text-[10px] text-gray-500 font-bold uppercase">Thư mục (Section)</div>
                        <div className="text-blue-300 font-semibold">{getSectionLabel(selectedMediaItem.section)}</div>
                      </div>

                      <div>
                        <div className="text-[10px] text-gray-500 font-bold uppercase">Định dạng & kích thước</div>
                        <div className="text-gray-300 font-medium">
                          {selectedMediaItem.type.toUpperCase()} •{' '}
                          {selectedMediaItem.width && selectedMediaItem.height
                            ? `${selectedMediaItem.width} x ${selectedMediaItem.height}`
                            : selectedMediaItem.format || 'N/A'}
                        </div>
                      </div>

                      {selectedMediaItem.duration && (
                        <div>
                          <div className="text-[10px] text-gray-500 font-bold uppercase">Thời lượng Video</div>
                          <div className="text-gray-300 font-medium">{Number(selectedMediaItem.duration).toFixed(1)} giây</div>
                        </div>
                      )}

                      <div>
                        <div className="text-[10px] text-gray-500 font-bold uppercase">Đường dẫn Direct URL</div>
                        <div className="font-mono text-[10px] text-gray-400 break-all bg-black/50 p-2 rounded border border-white/5 mt-1 select-all">
                          {selectedMediaItem.url}
                        </div>
                      </div>

                      <div>
                        <div className="text-[10px] text-gray-500 font-bold uppercase">Cập nhật lần cuối</div>
                        <div className="text-gray-400 text-[11px]">
                          {selectedMediaItem.updated_at
                            ? new Date(selectedMediaItem.updated_at).toLocaleString('vi-VN')
                            : 'N/A'}
                        </div>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="space-y-2 pt-2">
                      <Button
                        onClick={() => copyToClipboard(selectedMediaItem.url, selectedMediaItem.id)}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white h-9 rounded-xl font-semibold text-xs flex items-center justify-center gap-2"
                      >
                        {copiedId === selectedMediaItem.id ? (
                          <>
                            <Check className="w-4 h-4 text-emerald-300" />
                            Đã sao chép URL!
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4" />
                            Sao chép đường dẫn Direct
                          </>
                        )}
                      </Button>

                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          variant="outline"
                          onClick={() => window.open(selectedMediaItem.url, '_blank')}
                          className="w-full bg-white/5 border-white/10 hover:bg-white/10 text-white h-9 rounded-xl text-xs flex items-center justify-center gap-1.5"
                        >
                          <ExternalLink className="w-3.5 h-3.5 text-blue-400" />
                          Mở tab mới
                        </Button>

                        <Button
                          variant="destructive"
                          disabled={mediaLoadingId === selectedMediaItem.id}
                          onClick={() => setItemToDelete(selectedMediaItem)}
                          className="w-full bg-red-500/20 hover:bg-red-500 text-red-300 hover:text-white border border-red-500/30 h-9 rounded-xl text-xs flex items-center justify-center gap-1.5"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Xóa media
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-center py-12 text-gray-500">
                    <Info className="w-8 h-8 opacity-30 mb-2" />
                    <p className="text-xs">Chọn 1 tệp media từ danh sách để xem thông tin chi tiết và thao tác.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Explorer Footer Status Bar */}
            <div className="px-4 py-2 border-t border-white/10 bg-slate-900/90 text-xs text-gray-400 flex items-center justify-between shrink-0 font-mono">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <Folder className="w-3.5 h-3.5 text-yellow-500" />
                  {selectedFolder === 'all' ? 'Thư mục gốc' : getSectionLabel(selectedFolder)}
                </span>
                <span>•</span>
                <span>{mediaItems.length} mục trong thư viện</span>
              </div>
              <div className="text-[10px] text-gray-500">Giao diện thư viện v2.0</div>
            </div>
          </DialogContent>
        </Dialog>

        <ConfirmDeleteDialog
          isOpen={!!itemToDelete}
          onOpenChange={(open) => !open && setItemToDelete(null)}
          title="Xác nhận xóa tệp Media"
          description={
            <span>
              Bạn có chắc chắn muốn xóa vĩnh viễn tệp media{' '}
              <strong className="text-slate-900">ID #{itemToDelete?.id}</strong> không? Hành động này không thể hoàn tác.
            </span>
          }
          confirmText="Xóa vĩnh viễn"
          cancelText="Hủy bỏ"
          isDeleting={!!mediaLoadingId}
          onConfirm={async () => {
            if (!itemToDelete) return;
            try {
              setMediaLoadingId(itemToDelete.id);
              const r = await deleteSiteMediaApi(Number(itemToDelete.id));
              if (r.ok) {
                toast.success('Đã xóa media thành công');
                if (selectedMediaItem?.id === itemToDelete.id) {
                  setSelectedMediaItem(null);
                }
                const { items } = await getSiteMediaApi({});
                setMediaItems(items);
                setItemToDelete(null);
              } else throw new Error();
            } catch {
              toast.error('Xóa thất bại');
            } finally {
              setMediaLoadingId(null);
            }
          }}
        />
      </CardContent>
    </Card>
  );
}
