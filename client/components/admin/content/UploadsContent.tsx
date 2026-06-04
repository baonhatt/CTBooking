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
        Info
} from 'lucide-react';
import { useHasStaffPermission } from '@/hooks/useStaffPermission';

export default function UploadsContent() {
        const hasPermission = useHasStaffPermission();
        const canUpload = hasPermission('uploads', 'upload');
        const canDelete = hasPermission('uploads', 'delete');
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
                                                        if (i !== -1) cp[i] = { ...cp[i], status: 'error', error: err?.message || 'Upload lỗi' };
                                                        return cp;
                                                });
                                                setStage('error');
                                                setStatusLines((prev) => [
                                                        ...prev,
                                                        `Upload thất bại [${nextItem.name}]: ${err?.message || 'Có lỗi xảy ra'}`
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
                <Card className="bg-white text-gray-900 border border-[#E5E7EB]">
                        <CardHeader className="pb-4">
                                <CardTitle className="text-2xl font-bold text-gray-900">Uploads</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                                {/* Upload Section */}
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                        {/* Left Column - Upload Controls */}
                                        <div className="space-y-6">
                                                <div className="space-y-3">
                                                        <Label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
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
                  border-2 border-dashed border-[#D1D5DB] 
                  hover:border-[#2563EB] hover:bg-[#EFF6FF] 
                  transition-all duration-300 rounded-xl 
                  p-8 flex flex-col items-center justify-center gap-3
                  bg-white
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
                                                                <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                                                                        <Upload className="w-7 h-7 text-[#6B7280]" />
                                                                </div>
                                                                <div className="text-center">
                                                                        <p className="text-gray-700 font-medium">Nhấn để chọn hoặc kéo thả files vào đây</p>
                                                                        <p className="text-gray-500 text-xs mt-1">Hỗ trợ Video (MP4, MOV) và Hình ảnh (JPG, PNG, WEBP)</p>
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
                                                        <Label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                                                                <Layout className="w-4 h-4" />
                                                                Vị trí hiển thị
                                                        </Label>
                                                        <div className="relative group">
                                                                <select
                                                                        className="w-full bg-white text-gray-900 border border-gray-300 rounded-xl px-3 py-2 h-10 text-sm leading-6 focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 appearance-none cursor-pointer transition-all hover:border-blue-300"
                                                                        value={section}
                                                                        onChange={(e) => setSection(e.target.value as any)}
                                                                >
                                                                        <option value="hero_section">Hero Section</option>
                                                                        <option value="technology_section1">Technology Section 1 (Banner)</option>
                                                                        <option value="technology_section2">Technology Section 2 (Danh sách)</option>
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

                                                <div className="flex items-center gap-3 pt-4 border-t border-gray-200">
                                                        <Button
                                                                disabled={!canUpload || !files.length || uploads.some((u) => u.status === 'uploading' || u.status === 'pending')}
                                                                onClick={checkAndPrepareUpload}
                                                                className="bg-blue-600 hover:bg-blue-700 h-11 px-8 rounded-xl font-bold shadow-lg shadow-blue-900/20 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                                        >
                                                                <CloudUpload className="w-5 h-5" />
                                                                {uploads.some((u) => u.status === 'uploading' || u.status === 'pending')
                                                                        ? 'Đang xử lý...'
                                                                        : 'Bắt đầu Upload'}
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
                                                                className="rounded-xl shadow-sm hover:rotate-180 transition-transform duration-500 shrink-0 h-11 w-11 flex items-center justify-center bg-gray-100 border-gray-300 text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:rotate-0"
                                                                title="Làm mới"
                                                        >
                                                                <RefreshCw className="w-5 h-5" />
                                                        </Button>

                                                        <div className="flex-1" />

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
                                                                className="text-[#2563EB] bg-[#EFF6FF] hover:bg-[#DBEAFE] border-[#BFDBFE] h-11 px-6 rounded-xl transition-all flex items-center gap-2"
                                                        >
                                                                <Grid3X3 className="w-4 h-4" />
                                                                Thư viện Site Media
                                                        </Button>
                                                </div>
                                        </div>

                                        {/* Right Column - Preview Card */}
                                        <div className="relative group">
                                                {files.length === 1 && previewUrl ? (
                                                        <div className="h-full rounded-xl border border-gray-200 bg-white overflow-hidden flex flex-col shadow-sm">
                                                                <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
                                                                        <div className="flex items-center gap-2">
                                                                                {/^image\//.test(files[0].type) ? (
                                                                                        <FileImage className="w-4 h-4 text-emerald-400" />
                                                                                ) : (
                                                                                        <FileVideo className="w-4 h-4 text-blue-400" />
                                                                                )}
                                                                                <span className="text-sm font-semibold truncate max-w-[200px]">{files[0].name}</span>
                                                                        </div>
                                                                        <span className="text-[10px] uppercase tracking-wider font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                                                                                Preview
                                                                        </span>
                                                                </div>

                                                                <div className="relative flex-1 bg-gray-50 flex items-center justify-center p-6">
                                                                        <div className="w-full h-full rounded-lg overflow-hidden shadow-sm bg-white flex items-center justify-center border border-gray-200">
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

                                                                <div className="p-5 bg-gray-50 border-t border-gray-200 mt-auto">
                                                                        <div className="grid grid-cols-2 gap-6">
                                                                                <div className="space-y-1">
                                                                                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-tight">Kích thước</p>
                                                                                        <p className="text-sm text-gray-900 font-medium">{formatSize(files[0].size || 0)}</p>
                                                                                </div>
                                                                                <div className="space-y-1">
                                                                                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-tight">Định dạng</p>
                                                                                        <p className="text-sm text-gray-900 font-medium truncate">{files[0].type || 'N/A'}</p>
                                                                                </div>
                                                                        </div>
                                                                </div>
                                                        </div>
                                                ) : (
                                                        <div className="h-full min-h-[400px] rounded-xl border-2 border-dashed border-gray-200 bg-white flex flex-col items-center justify-center text-center p-12 group-hover:bg-gray-50 transition-all duration-500">
                                                                <div className="w-24 h-24 rounded-3xl bg-gray-100 flex items-center justify-center mb-6 group-hover:rotate-12 transition-transform duration-500 border border-gray-200">
                                                                        <Monitor className="w-10 h-10 text-gray-400 group-hover:text-[#2563EB] transition-colors" />
                                                                </div>
                                                                <h3 className="text-gray-900 font-semibold text-lg mb-2">Chưa có tệp nào được chọn</h3>
                                                                <p className="text-gray-500 text-sm max-w-[250px]">
                                                                        Chọn một tệp để xem trước chi tiết nội dung và thuộc tính trước khi tải lên.
                                                                </p>
                                                        </div>
                                                )}
                                        </div>
                                </div>

                                {/* Progress Section */}
                                {(!!uploads.length || !!statusLines.length || files.length > 0) && (
                                        <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-6 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
                                                {!!uploads.length && (
                                                        <div className="space-y-4">
                                                                <div className="flex items-center justify-between">
                                                                        <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2">
                                                                                <RefreshCw className={`w-4 h-4 ${stage === 'uploading' ? 'animate-spin' : ''}`} />
                                                                                Tiến trình trực tiếp
                                                                        </h3>
                                                                        <span className="text-[10px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full border border-gray-200">
                                                                                {uploads.filter((u) => u.status === 'done').length}/{uploads.length} Hoàn thành
                                                                        </span>
                                                                </div>

                                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                                        {uploads.map((u) => (
                                                                                <div
                                                                                        key={u.id}
                                                                                        className="relative group rounded-xl bg-gray-50 border border-gray-200 p-4 transition-all hover:bg-gray-100 overflow-hidden"
                                                                                >
                                                                                        <div className="flex items-start justify-between mb-3">
                                                                                                <div className="flex items-center gap-3 overflow-hidden">
                                                                                                        <div
                                                                                                                className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${u.status === 'done'
                                                                                                                        ? 'bg-emerald-500/20 text-emerald-400'
                                                                                                                        : u.status === 'error'
                                                                                                                                ? 'bg-red-500/20 text-red-400'
                                                                                                                                : 'bg-blue-500/20 text-blue-400'
                                                                                                                        }`}
                                                                                                        >
                                                                                                                {u.isImage ? <FileImage className="w-5 h-5" /> : <FileVideo className="w-5 h-5" />}
                                                                                                        </div>
                                                                                                        <div className="overflow-hidden">
                                                                                                                <div className="text-sm text-gray-900 font-semibold truncate">{u.name}</div>
                                                                                                                <div className="text-[10px] text-gray-500 font-medium">
                                                                                                                        {formatSize(u.size)} • {u.type.split('/')[1]?.toUpperCase() || 'N/A'}
                                                                                                                </div>
                                                                                                        </div>
                                                                                                </div>
                                                                                                <div
                                                                                                        className={`shrink-0 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-tighter ${u.status === 'done'
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
                                                                                                                                ? 'Upload'
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
                                                                                                                Upload thành công
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
                                                        <div className="rounded-xl bg-[#EFF6FF] border border-[#BFDBFE] p-5 flex items-center gap-4 animate-in fade-in slide-in-from-left-4">
                                                                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                                                                        <Info className="w-6 h-6 text-[#2563EB]" />
                                                                </div>
                                                                <div>
                                                                        <h4 className="text-sm font-bold text-[#1E40AF]">Sẵn sàng tải lên</h4>
                                                                        <p className="text-xs text-[#3B82F6] mt-0.5">
                                                                                Nhấn nút <span className="text-[#1E40AF] font-bold">"Bắt đầu Upload"</span> để xử lý {files.length}{' '}
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
                                                                <div className="rounded-xl bg-gray-50 p-4 max-h-40 overflow-y-auto border border-gray-200 font-mono">
                                                                        {statusLines.map((ln, idx) => (
                                                                                <div
                                                                                        key={idx}
                                                                                        className="text-[10px] text-gray-500 py-1 flex gap-2 border-b border-gray-200 last:border-0"
                                                                                >
                                                                                        <span className="text-blue-500/50 shrink-0">
                                                                                                [{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}]
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
                                                                <Button onClick={startUpload}>Lưu</Button>
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
                                                if (!val) setPlayingVideoId(null);
                                        }}
                                >
                                        <DialogContent className="bg-white text-gray-900 border-gray-200 max-w-5xl w-[95vw] h-[85vh] flex flex-col p-0 overflow-hidden shadow-xl rounded-xl [&>button]:hidden">
                                                <DialogHeader className="p-6 border-b border-gray-200 bg-white flex flex-row items-center justify-between space-y-0">
                                                        <div className="flex items-center gap-3">
                                                                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                                                                        <Grid3X3 className="w-5 h-5 text-blue-400" />
                                                                </div>
                                                                <div>
                                                                        <DialogTitle className="text-lg font-semibold text-gray-900">Thư viện Site Media</DialogTitle>
                                                                        <p className="text-xs text-gray-500 mt-0.5">
                                                                                Quản lý và xem trước nội dung đa phương tiện của trang web
                                                                        </p>
                                                                </div>
                                                        </div>
                                                        <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => setOpenMediaModal(false)}
                                                                className="hover:bg-white/10 text-gray-400"
                                                                title="Đóng"
                                                        >
                                                                <X className="w-5 h-5" />
                                                        </Button>
                                                </DialogHeader>

                                                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-white">
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                                                {mediaItems.map((m) => (
                                                                        <div
                                                                                key={m.id}
                                                                                className="group relative rounded-xl border border-gray-200 bg-white overflow-hidden flex flex-col transition-all hover:border-blue-300 hover:shadow-lg hover:-translate-y-1"
                                                                        >
                                                                                {/* Media Preview Area */}
                                                                                <div className="aspect-video bg-black/40 relative flex items-center justify-center group-hover:bg-black/20 transition-colors">
                                                                                        {m.type === 'image' ? (
                                                                                                <img
                                                                                                        src={m.url}
                                                                                                        alt={m.section}
                                                                                                        loading="lazy"
                                                                                                        className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                                                                                                />
                                                                                        ) : (
                                                                                                <div
                                                                                                        className="relative w-full h-full cursor-pointer group/vid"
                                                                                                        onClick={() => setPlayingVideoId(m.id)}
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
                                                                                                                                        className="w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-opacity"
                                                                                                                                />
                                                                                                                        ) : m.type === 'video' ? (
                                                                                                                                <video
                                                                                                                                        src={m.url}
                                                                                                                                        preload="metadata"
                                                                                                                                        className="w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-opacity"
                                                                                                                                />
                                                                                                                        ) : (
                                                                                                                                <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                                                                                                                                        <FileVideo className="w-12 h-12 text-blue-500/20" />
                                                                                                                                </div>
                                                                                                                        )}

                                                                                                                        <div className="absolute inset-0 flex items-center justify-center">
                                                                                                                                <div className="w-12 h-12 rounded-full bg-blue-600/20 backdrop-blur-md flex items-center justify-center text-white border border-white/20 group-hover/vid:scale-110 group-hover/vid:bg-blue-600/40 transition-all duration-300">
                                                                                                                                        <FileVideo className="w-6 h-6" />
                                                                                                                                </div>
                                                                                                                        </div>

                                                                                                                        {/* Click to Play hint */}
                                                                                                                        <div className="absolute bottom-2 right-2 px-2 py-1 rounded bg-black/60 text-[8px] font-bold text-white uppercase tracking-wider opacity-0 group-hover/vid:opacity-100 transition-opacity">
                                                                                                                                Click to Play
                                                                                                                        </div>
                                                                                                                </>
                                                                                                        )}
                                                                                                </div>
                                                                                        )}

                                                                                        {/* Section Badge */}
                                                                                        <div className="absolute top-3 left-3 px-2 py-1 rounded-md bg-black/60 backdrop-blur-md border border-white/10 text-[10px] font-bold uppercase tracking-wider text-blue-300">
                                                                                                {m.section.replace('_', ' ')}
                                                                                        </div>

                                                                                        {/* Overlays on Hover */}
                                                                                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                                                                                                <Button
                                                                                                        variant="secondary"
                                                                                                        size="sm"
                                                                                                        className="h-8 w-8 p-0 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-md"
                                                                                                        onClick={() => window.open(m.url, '_blank')}
                                                                                                        title="Xem trực tiếp"
                                                                                                >
                                                                                                        <ExternalLink className="w-4 h-4" />
                                                                                                </Button>
                                                                                                {canDelete && (
                                                                                                <Button
                                                                                                        variant="destructive"
                                                                                                        size="sm"
                                                                                                        className="h-8 w-8 p-0 rounded-full bg-red-500/80 hover:bg-red-500 text-white backdrop-blur-md"
                                                                                                        disabled={mediaLoadingId === m.id}
                                                                                                        onClick={async () => {
                                                                                                                if (window.confirm('Bạn có chắc chắn muốn xóa media này?')) {
                                                                                                                        try {
                                                                                                                                setMediaLoadingId(m.id);
                                                                                                                                const r = await deleteSiteMediaApi(Number(m.id));
                                                                                                                                if (r.ok) {
                                                                                                                                        toast.success('Đã xóa media thành công');
                                                                                                                                        const { items } = await getSiteMediaApi({});
                                                                                                                                        setMediaItems(items);
                                                                                                                                } else throw new Error();
                                                                                                                        } catch {
                                                                                                                                toast.error('Xóa thất bại');
                                                                                                                        } finally {
                                                                                                                                setMediaLoadingId(null);
                                                                                                                        }
                                                                                                                }
                                                                                                        }}
                                                                                                        title="Xóa media"
                                                                                                >
                                                                                                        <Trash2 className="w-4 h-4" />
                                                                                                </Button>
                                                                                                )}
                                                                                        </div>
                                                                                </div>

                                                                                {/* Info Area */}
                                                                                <div className="p-4 flex-1 flex flex-col justify-between">
                                                                                        <div className="space-y-2">
                                                                                                <div className="flex items-center justify-between">
                                                                                                        <span className="text-[10px] font-mono text-gray-500 uppercase">ID: #{m.id}</span>
                                                                                                        <span
                                                                                                                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${m.type === 'image' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-blue-500/10 text-blue-400'
                                                                                                                        }`}
                                                                                                        >
                                                                                                                {m.type}
                                                                                                        </span>
                                                                                                </div>
                                                                                                <div className="text-xs text-gray-400 break-all line-clamp-2 leading-relaxed opacity-60 group-hover:opacity-100 transition-opacity">
                                                                                                        {m.url}
                                                                                                </div>
                                                                                        </div>

                                                                                        <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
                                                                                                <div
                                                                                                        className="flex items-center gap-1.5 text-[10px] text-gray-500 font-medium cursor-help"
                                                                                                        title={m.updated_at ? new Date(m.updated_at).toLocaleString('vi-VN') : ''}
                                                                                                >
                                                                                                        <RefreshCw className="w-3 h-3" />
                                                                                                        {m.updated_at
                                                                                                                ? formatDistanceToNow(new Date(m.updated_at), { addSuffix: true, locale: vi })
                                                                                                                : 'N/A'}
                                                                                                </div>
                                                                                        </div>
                                                                                </div>
                                                                        </div>
                                                                ))}
                                                        </div>

                                                        {mediaItems.length === 0 && (
                                                                <div className="flex flex-col items-center justify-center py-24 text-gray-500">
                                                                        <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-6">
                                                                                <Grid3X3 className="w-10 h-10 opacity-20" />
                                                                        </div>
                                                                        <h4 className="text-lg font-medium text-gray-400">Không có dữ liệu media</h4>
                                                                        <p className="text-sm opacity-50">Tải lên tệp đầu tiên để thấy chúng ở đây.</p>
                                                                </div>
                                                        )}
                                                </div>

                                                <div className="p-4 border-t border-white/5 bg-white/5 text-center">
                                                        <p className="text-[11px] text-gray-500">Hiển thị {mediaItems.length} mục media trong hệ thống</p>
                                                </div>
                                        </DialogContent>
                                </Dialog>
                        </CardContent>
                </Card>
        );
}
