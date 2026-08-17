import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calendar, Eye, Loader2, Lock, Plus, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import React, { useEffect, useState } from 'react';
import {
        createMovieApi,
        updateMovieApi,
        getMoviesAdmin,
        createToyApi,
        updateToyApi,
        getToys,
        getMovieById,
        getBranches
} from '@/lib/api';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { BranchMultiSelect } from '@/components/admin/BranchMultiSelect';
import { normalizeBranchIdsInput, parseBranchIdsFromApi } from '@/lib/branch-ids';

interface AdminEditModalProps {
        isEditOpen: boolean;
        setIsEditOpen: (open: boolean) => void;
        editType: 'user' | 'movie' | 'toy' | null;
        editData: any;
        setEditData: (data: any) => void;
        moviesLocal: any[];
        toLocalDateTimeString: (date: Date) => string;
        pageSize: number;
        currentPage: number;
        setUsers: React.Dispatch<React.SetStateAction<any[]>>;
        setMoviesLocal: React.Dispatch<React.SetStateAction<any[]>>;
        setMovieStatus: React.Dispatch<React.SetStateAction<Record<string, 'active' | 'inactive'>>>;
        setToys: React.Dispatch<React.SetStateAction<any[]>>;
        onViewDetails?: (id: number) => void;
        onRefresh?: () => Promise<void>;
        branches?: any[];
}

const AdminEditModal: React.FC<AdminEditModalProps> = (props) => {
        const [isSaving, setIsSaving] = useState(false);
        const [isDirty, setIsDirty] = useState(false);
        const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
        const [isDragging, setIsDragging] = useState(false);
        const [branches, setBranches] = useState<any[]>([]);
        const {
                isEditOpen,
                setIsEditOpen,
                editType,
                editData,
                setEditData,
                setUsers,
                setMoviesLocal,
                setMovieStatus,
                setToys,
                moviesLocal,
                toLocalDateTimeString,
                pageSize,
                currentPage,
                branches: branchesProp
        } = props;

        // Load branches when modal opens (only if not provided as prop)
        useEffect(() => {
                if (isEditOpen && editType === 'movie' && !branchesProp?.length) {
                        (async () => {
                                try {
                                        const { items } = await getBranches({ includeInactive: true });
                                        setBranches(items);
                                } catch (error) {
                                        console.error('Error loading branches:', error);
                                }
                        })();
                }
        }, [isEditOpen, editType, branchesProp]);

        // Sync branches from prop when provided
        useEffect(() => {
                if (branchesProp && branchesProp.length > 0) {
                        setBranches(branchesProp);
                }
        }, [branchesProp]);

        // Reset dirty state when modal opens/closes
        useEffect(() => {
                if (!isEditOpen) {
                        setIsDirty(false);
                }
        }, [isEditOpen]);

        // Wrapper for setEditData to track dirty state
        const handleEditChange = (newData: any) => {
                setEditData(newData);
                setIsDirty(true);
        };

        // Close handler with dirty state check
        const handleClose = () => {
                if (isDirty) {
                        const confirmed = window.confirm(
                                'Bạn có thay đổi chưa lưu. Bạn chắc chắn muốn đóng?'
                        );
                        if (!confirmed) return;
                }
                setIsEditOpen(false);
                setIsDirty(false);
        };

        // Real-time validation function
        const validateField = (field: string, value: any) => {
                let error = '';

                if (field === 'title' && !value?.trim()) {
                        error = 'Tên phim không được để trống';
                }

                if (field === 'duration' && (!value || Number(value) <= 0)) {
                        error = 'Thời lượng phải lớn hơn 0 phút';
                }

                if (field === 'rating' && value && (Number(value) < 0 || Number(value) > 10)) {
                        error = 'Đánh giá phải từ 0-10';
                }

                if (field === 'posterFile' && value?.size > 15_000_000) {
                        error = 'Ảnh phải nhỏ hơn 15MB';
                }

                setFieldErrors((prev) => ({ ...prev, [field]: error }));
        };

        // Drag & drop handlers
        const handleDragOver = (e: React.DragEvent) => {
                e.preventDefault();
                setIsDragging(true);
        };

        const handleDragLeave = (e: React.DragEvent) => {
                e.preventDefault();
                setIsDragging(false);
        };

        const handleDrop = (e: React.DragEvent) => {
                e.preventDefault();
                setIsDragging(false);
                const file = e.dataTransfer.files?.[0];
                if (file && file.type.startsWith('image/')) {
                        validateField('posterFile', file);
                        const url = URL.createObjectURL(file);
                        setEditData({
                                ...editData,
                                posterUrl: url,
                                posterFile: file
                        });
                }
        };

        useEffect(() => {
                const run = async () => {
                        if (!isEditOpen || editType !== 'movie' || !editData?.id) return;
                        const idNum = Number(editData?.id);
                        if (!idNum || editData?.description) return;
                        try {
                                const m = await getMovieById(idNum);
                                if (m) {
                                        setEditData({
                                                ...editData,
                                                description: m.description || '',
                                                posterUrl: editData?.posterUrl || m.cover_image || '',
                                                genresText:
                                                        editData?.genresText ??
                                                        (Array.isArray(editData?.genres) && editData.genres.length
                                                                ? editData.genres.join(', ')
                                                                : Array.isArray(m.genres)
                                                                        ? m.genres.join(', ')
                                                                        : ''),
                                                genres:
                                                        Array.isArray(editData?.genres) && editData.genres.length
                                                                ? editData.genres
                                                                : Array.isArray(m.genres)
                                                                        ? m.genres
                                                                        : [],
                                                rating: editData?.rating ?? m.rating ?? null,
                                                duration:
                                                        editData?.duration !== undefined && editData?.duration !== null
                                                                ? editData.duration
                                                                : (m.duration_min ?? ''),
                                                release_date: editData?.release_date ?? m.release_date ?? null,
                                                branch_id: editData?.branch_id ?? m.branch_id ?? null,
                                                branch_ids: editData?.branch_ids ?? parseBranchIdsFromApi(m.branch_ids ?? m.branch_id),
                                                is_active: editData?.is_active ?? m.is_active ?? true
                                        });
                                }
                        } catch { }
                };
                run();
                // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [isEditOpen, editType, editData?.id]);

        async function fileToCompressedDataURL(
                file: File,
                opts?: { maxW?: number; maxH?: number; quality?: number; type?: string }
        ) {
                const maxW = opts?.maxW ?? 1280;
                const maxH = opts?.maxH ?? 1280;
                const quality = opts?.quality ?? 0.75;
                const type = opts?.type ?? 'image/webp';
                const blobUrl = URL.createObjectURL(file);
                const img = await new Promise<HTMLImageElement>((resolve, reject) => {
                        const i = new Image();
                        i.onload = () => resolve(i);
                        i.onerror = reject;
                        i.src = blobUrl;
                });
                const ratio = Math.min(maxW / img.width, maxH / img.height, 1);
                const w = Math.max(1, Math.round(img.width * ratio));
                const h = Math.max(1, Math.round(img.height * ratio));
                const canvas = document.createElement('canvas');
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d')!;
                ctx.drawImage(img, 0, 0, w, h);
                const dataUrl = canvas.toDataURL(type, quality);
                URL.revokeObjectURL(blobUrl);
                return dataUrl;
        }

        async function refetch(type: 'movie' | 'toy') {
                if (type === 'movie') {
                        if (props.onRefresh) {
                                await props.onRefresh();
                        }
                }
                if (type === 'toy') {
                        const { items } = await getToys({ page: currentPage, pageSize });
                        setToys(
                                items.map((t: any) => ({
                                        id: t.id,
                                        name: t.name,
                                        category: t.category,
                                        price: Number(t.price),
                                        stock: t.stock,
                                        status: t.status,
                                        image_url: t.image_url
                                }))
                        );
                }
        }

        async function titleExists(title: string, excludeId?: number | string) {
                const norm = (s: string) => s.trim().toLowerCase();
                const localHit =
                        moviesLocal?.some(
                                (m: any) => norm(m.title) === norm(title) && (excludeId == null || String(m.id) !== String(excludeId))
                        ) || false;
                if (localHit) return true;
                const { items } = await getMoviesAdmin({
                        page: 1,
                        pageSize: 10,
                        q: title
                });
                return items.some(
                        (m: any) => norm(m.title) === norm(title) && (excludeId == null || String(m.id) !== String(excludeId))
                );
        }

        return (
                <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                        <DialogContent className="max-h-[90vh] w-[90vw] max-w-[900px] overflow-y-auto [&>button]:hidden">
                                <DialogHeader className="flex flex-row items-center gap-3 space-y-0 pb-4 border-b">
                                        <DialogTitle className="text-lg font-bold text-slate-800">
                                                {editType === 'user'
                                                        ? 'Chỉnh sửa người dùng'
                                                        : editType === 'movie'
                                                                ? 'Chỉnh sửa phim'
                                                                : editType === 'toy'
                                                                        ? 'Chỉnh sửa đồ chơi'
                                                                        : ''}
                                                {isDirty && (
                                                        <span className="w-2 h-2 rounded-full bg-amber-400 inline-block ml-2" title="Có thay đổi chưa lưu" />
                                                )}
                                        </DialogTitle>
                                        {editType === 'movie' && editData?.id && (
                                                <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => props.onViewDetails?.(Number(editData.id))}
                                                        className="h-7 rounded-full gap-1.5 border-slate-200 hover:bg-blue-50 hover:text-blue-600 group transition-all px-3"
                                                >
                                                        <Eye className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-500" />
                                                        <span className="text-[10px] font-bold uppercase tracking-wider">Xem chi tiết</span>
                                                </Button>
                                        )}

                                        <div className="flex-1" />
                                        <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={handleClose}
                                                className="h-8 w-8 rounded-full hover:bg-red-100 hover:text-red-600 text-slate-400 transition-all active:scale-95 -m-2 p-2"
                                                title="Đóng"
                                        >
                                                <X className="w-5 h-5" />
                                        </Button>
                                </DialogHeader>

                                {editType === 'user' && (
                                        <div className="flex flex-col h-full overflow-hidden bg-white">
                                                {/* VÙNG CUỘN (SCROLLABLE AREA) */}
                                                <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
                                                        {/* Group 1: Thông tin cơ bản */}
                                                        <div>
                                                                <div className="flex items-center gap-2 mb-3">
                                                                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Thông tin cơ bản</span>
                                                                        <div className="flex-1 h-px bg-slate-200" />
                                                                </div>
                                                                <div className="space-y-4">
                                                                        <div>
                                                                                <Label className="text-sm font-medium text-gray-900 mb-2 block" htmlFor="user-name">
                                                                                        Họ tên
                                                                                </Label>
                                                                                <Input
                                                                                        id="user-name"
                                                                                        value={editData?.name || ''}
                                                                                        onChange={(e) => {
                                                                                                setEditData({ ...editData, name: e.target.value });
                                                                                                setIsDirty(true);
                                                                                        }}
                                                                                        className="h-10 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10 outline-none transition-all"
                                                                                />
                                                                        </div>
                                                                        <div>
                                                                                <Label className="text-sm font-medium text-gray-900 mb-2 block" htmlFor="user-email">
                                                                                        Email
                                                                                </Label>
                                                                                <Input
                                                                                        id="user-email"
                                                                                        type="email"
                                                                                        value={editData?.email || ''}
                                                                                        onChange={(e) => {
                                                                                                setEditData({ ...editData, email: e.target.value });
                                                                                                setIsDirty(true);
                                                                                        }}
                                                                                        className="h-10 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10 outline-none transition-all"
                                                                                />
                                                                        </div>
                                                                        <div>
                                                                                <Label className="text-sm font-medium text-gray-900 mb-2 block" htmlFor="user-phone">
                                                                                        SĐT
                                                                                </Label>
                                                                                <Input
                                                                                        id="user-phone"
                                                                                        value={editData?.phone || ''}
                                                                                        onChange={(e) => {
                                                                                                setEditData({ ...editData, phone: e.target.value });
                                                                                                setIsDirty(true);
                                                                                        }}
                                                                                        className="h-10 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10 outline-none transition-all"
                                                                                />
                                                                        </div>
                                                                </div>
                                                        </div>
                                                </div>

                                                {/* VÙNG NÚT BẤM CỐ ĐỊNH */}
                                                <div className="px-6 py-4 border-t bg-white flex justify-end items-center gap-3 shrink-0">
                                                        <Button
                                                                variant="ghost"
                                                                onClick={handleClose}
                                                                disabled={isSaving}
                                                                className="h-10 border border-gray-300 text-gray-700 hover:bg-gray-50 hover:text-gray-900"
                                                        >
                                                                Hủy bỏ
                                                        </Button>
                                                        <Button
                                                                disabled={isSaving}
                                                                className="h-10 bg-blue-600 hover:bg-blue-700 min-w-[140px] rounded-lg shadow-lg shadow-blue-500/20 transition-all active:scale-95"
                                                                onClick={async () => {
                                                                        try {
                                                                                setIsSaving(true);
                                                                                setUsers((prev) => prev.map((u) => (u.id === editData.id ? { ...u, ...editData } : u)));
                                                                                toast.success('Thành công', {
                                                                                        description: 'Cập nhật người dùng thành công'
                                                                                });
                                                                                setIsEditOpen(false);
                                                                                setIsDirty(false);
                                                                        } catch (e: any) {
                                                                                toast.error('Lỗi', {
                                                                                        description: e?.message || 'Có lỗi xảy ra'
                                                                                });
                                                                        } finally {
                                                                                setIsSaving(false);
                                                                        }
                                                                }}
                                                        >
                                                                {isSaving ? (
                                                                        <span className="flex items-center gap-2">
                                                                                <Loader2 className="h-4 w-4 animate-spin" /> Đang lưu...
                                                                        </span>
                                                                ) : (
                                                                        'Lưu'
                                                                )}
                                                        </Button>
                                                </div>
                                        </div>
                                )}

                                {editType === 'movie' && (
                                        <div className="flex flex-col h-full overflow-hidden bg-white">
                                                {/* VÙNG CUỘN (SCROLLABLE AREA) */}
                                                <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
                                                        <div className="grid grid-cols-12 gap-4 md:gap-6">
                                                                {/* Cột trái: Poster (Cố định hoặc cuộn theo tùy màn hình) */}
                                                                <div className="col-span-12 lg:col-span-4 space-y-4">
                                                                        <label htmlFor="poster-input" className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm block cursor-pointer group hover:border-blue-400 transition-all">
                                                                                <span className="text-sm font-medium text-gray-900 mb-2 block">
                                                                                        Poster phim
                                                                                </span>

                                                                                <div
                                                                                        className={`aspect-[2/3] relative border-2 border-dashed rounded-xl overflow-hidden bg-slate-50 transition-colors ${isDragging ? 'border-blue-500 bg-blue-50' : 'group-hover:border-blue-200'
                                                                                                }`}
                                                                                        onDragOver={handleDragOver}
                                                                                        onDragLeave={handleDragLeave}
                                                                                        onDrop={handleDrop}
                                                                                >
                                                                                        {editData?.posterUrl ? (
                                                                                                <>
                                                                                                        <img src={editData.posterUrl} className="w-full h-full object-cover" alt="Poster preview" />
                                                                                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                                                                                <span className="text-white text-xs font-medium bg-black/50 px-3 py-1.5 rounded-full backdrop-blur-sm">
                                                                                                                        Thay đổi ảnh
                                                                                                                </span>
                                                                                                        </div>
                                                                                                </>
                                                                                        ) : (
                                                                                                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
                                                                                                        <div className="p-3 rounded-full bg-slate-100 mb-2 group-hover:bg-blue-50 group-hover:text-blue-500 transition-colors">
                                                                                                                <Plus size={24} />
                                                                                                        </div>
                                                                                                        <span className="text-xs font-medium">Tải ảnh lên</span>
                                                                                                </div>
                                                                                        )}

                                                                                        <input
                                                                                                id="poster-input"
                                                                                                type="file"
                                                                                                accept="image/*"
                                                                                                className="hidden"
                                                                                                onChange={(e) => {
                                                                                                        const file = e.target.files?.[0];
                                                                                                        if (file) {
                                                                                                                validateField('posterFile', file);
                                                                                                                const url = URL.createObjectURL(file);
                                                                                                                setEditData({
                                                                                                                        ...editData,
                                                                                                                        posterUrl: url,
                                                                                                                        posterFile: file
                                                                                                                });
                                                                                                        }
                                                                                                }}
                                                                                        />
                                                                                        {fieldErrors.poster && (
                                                                                                <p className="text-xs text-red-500 mt-1">{fieldErrors.poster}</p>
                                                                                        )}
                                                                                </div>

                                                                                <p className="text-[10px] text-slate-400 mt-3 text-center italic">
                                                                                        Hỗ trợ: JPG, PNG, WEBP (Tối đa 15MB)
                                                                                </p>
                                                                        </label>
                                                                </div>

                                                                {/* Cột phải: Thông tin chi tiết */}
                                                                <div className="col-span-12 lg:col-span-8 space-y-6">
                                                                        {/* Group 1: Thông tin cơ bản */}
                                                                        <div>
                                                                                <div className="flex items-center gap-2 mb-3">
                                                                                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Thông tin cơ bản</span>
                                                                                        <div className="flex-1 h-px bg-slate-200" />
                                                                                </div>
                                                                                <div className="grid grid-cols-12 gap-4">
                                                                                        {editData?.id ? (
                                                                                                <div className="col-span-12 lg:col-span-4">
                                                                                                        <Label className="text-sm font-medium text-gray-900 mb-2 block">
                                                                                                                ID hệ thống
                                                                                                        </Label>
                                                                                                        <div className="relative group">
                                                                                                                <Input
                                                                                                                        readOnly
                                                                                                                        value={`#${editData.id}`}
                                                                                                                        className="bg-slate-50/80 border-dashed border-slate-200 font-mono text-blue-600 cursor-not-allowed shadow-none"
                                                                                                                />
                                                                                                                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300">
                                                                                                                        <Lock size={12} />
                                                                                                                </div>
                                                                                                        </div>
                                                                                                </div>
                                                                                        ) : null}

                                                                                        <div className={`${editData?.id ? 'col-span-12 lg:col-span-8' : 'col-span-12'}`}>
                                                                                                <Label className="text-sm font-medium text-gray-900 mb-2 block">Tên phim</Label>
                                                                                                <Input
                                                                                                        placeholder="Ví dụ: Đào, Phở và Piano"
                                                                                                        value={editData?.title || ''}
                                                                                                        onChange={(e) => {
                                                                                                                setEditData({ ...editData, title: e.target.value });
                                                                                                                validateField('title', e.target.value);
                                                                                                        }}
                                                                                                        className={`h-10 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-600/10 outline-none transition-all placeholder:text-gray-400 ${fieldErrors.title ? 'border-red-500' : 'border-gray-300 focus:border-blue-600'}`}
                                                                                                />
                                                                                                {fieldErrors.title && (
                                                                                                        <p className="text-xs text-red-500 mt-1">{fieldErrors.title}</p>
                                                                                                )}
                                                                                        </div>
                                                                                </div>
                                                                        </div>

                                                                        {/* Group 2: Nội dung */}
                                                                        <div>
                                                                                <div className="flex items-center gap-2 mb-3">
                                                                                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Nội dung</span>
                                                                                        <div className="flex-1 h-px bg-slate-200" />
                                                                                </div>
                                                                                <div className="space-y-4">
                                                                                        <div className="space-y-2">
                                                                                                <div className="flex justify-between items-center">
                                                                                                        <Label className="text-sm font-medium text-gray-900 block">
                                                                                                                Mô tả nội dung
                                                                                                        </Label>
                                                                                                        <span className="text-xs text-slate-400">
                                                                                                                {editData?.description?.length || 0} ký tự
                                                                                                        </span>
                                                                                                </div>
                                                                                                <textarea
                                                                                                        value={editData?.description || ''}
                                                                                                        onChange={(e) =>
                                                                                                                setEditData({
                                                                                                                        ...editData,
                                                                                                                        description: e.target.value
                                                                                                                })
                                                                                                        }
                                                                                                        placeholder="Nhập tóm tắt nội dung phim..."
                                                                                                        className="w-full min-h-[100px] max-h-[150px] border border-gray-300 rounded-lg px-3 py-2 text-sm leading-relaxed focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10 outline-none resize-y transition-all placeholder:text-gray-400"
                                                                                                />
                                                                                        </div>

                                                                                        <div className="space-y-2">
                                                                                                <Label className="text-sm font-medium text-gray-900 block">
                                                                                                        Thể loại (Ví dụ: Hành động, Tình cảm)
                                                                                                </Label>
                                                                                                <Input
                                                                                                        placeholder="Nhập các thể loại, ngăn cách bằng dấu phẩy"
                                                                                                        value={editData?.genresText ?? (editData?.genres || []).join(', ')}
                                                                                                        onChange={(e) =>
                                                                                                                setEditData({
                                                                                                                        ...editData,
                                                                                                                        genresText: e.target.value,
                                                                                                                        genres: e.target.value
                                                                                                                                .split(/[,;|\n]| {2,}/)
                                                                                                                                .map((x) => x.trim())
                                                                                                                                .filter(Boolean)
                                                                                                                })
                                                                                                        }
                                                                                                        className="h-10 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10 outline-none transition-all placeholder:text-gray-400"
                                                                                                />
                                                                                        </div>
                                                                                </div>
                                                                        </div>

                                                                        {/* Group 3: Cài đặt */}
                                                                        <div>
                                                                                <div className="flex items-center gap-2 mb-3">
                                                                                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Cài đặt</span>
                                                                                        <div className="flex-1 h-px bg-slate-200" />
                                                                                </div>
                                                                                <div className="space-y-4">
                                                                                        {/* Row 1: Chi nhánh | Thời lượng | Đánh giá */}
                                                                                        <div className="grid grid-cols-12 gap-4">
                                                                                                <div className="col-span-12 lg:col-span-6">
                                                                                                        <Label className="text-sm font-medium text-gray-900 mb-2 block">Chi nhánh</Label>
                                                                                                        {branches && branches.length > 0 ? (
                                                                                                                <BranchMultiSelect
                                                                                                                        branches={branches}
                                                                                                                        value={normalizeBranchIdsInput(editData?.branch_ids, editData?.branch_id)}
                                                                                                                        onChange={(branch_ids) =>
                                                                                                                                setEditData({
                                                                                                                                        ...editData,
                                                                                                                                        branch_ids,
                                                                                                                                        branch_id: branch_ids && branch_ids.length === 1 ? branch_ids[0] : null
                                                                                                                                })
                                                                                                                        }
                                                                                                                />
                                                                                                        ) : (
                                                                                                                <div className="h-10 bg-slate-100 rounded-lg animate-pulse" />
                                                                                                        )}
                                                                                                </div>

                                                                                                <div className="col-span-12 lg:col-span-3">
                                                                                                        <Label className="text-sm font-medium text-gray-900 mb-2 block">
                                                                                                                Thời lượng (Phút)
                                                                                                        </Label>
                                                                                                        <Input
                                                                                                                type="number"
                                                                                                                placeholder="120"
                                                                                                                value={editData?.duration || ''}
                                                                                                                onChange={(e) => {
                                                                                                                        setEditData({
                                                                                                                                ...editData,
                                                                                                                                duration: e.target.value === '' ? '' : Number(e.target.value)
                                                                                                                        });
                                                                                                                        validateField('duration', e.target.value);
                                                                                                                }}
                                                                                                                className={`h-10 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-600/10 outline-none transition-all placeholder:text-gray-400 ${fieldErrors.duration ? 'border-red-500' : 'border-gray-300 focus:border-blue-600'}`}
                                                                                                        />
                                                                                                        {fieldErrors.duration && (
                                                                                                                <p className="text-xs text-red-500 mt-1">{fieldErrors.duration}</p>
                                                                                                        )}
                                                                                                </div>

                                                                                                <div className="col-span-12 lg:col-span-3">
                                                                                                        <Label className="text-sm font-medium text-gray-900 mb-2 block">
                                                                                                                Đánh giá (0-10)
                                                                                                        </Label>
                                                                                                        <Input
                                                                                                                type="number"
                                                                                                                step="0.1"
                                                                                                                placeholder="8.5"
                                                                                                                value={editData?.rating ?? ''}
                                                                                                                onChange={(e) => {
                                                                                                                        setEditData({
                                                                                                                                ...editData,
                                                                                                                                rating: e.target.value ? Number(e.target.value) : undefined
                                                                                                                        });
                                                                                                                        validateField('rating', e.target.value);
                                                                                                                }}
                                                                                                                className={`h-10 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-600/10 outline-none transition-all placeholder:text-gray-400 ${fieldErrors.rating ? 'border-red-500' : 'border-gray-300 focus:border-blue-600'}`}
                                                                                                        />
                                                                                                        {fieldErrors.rating && (
                                                                                                                <p className="text-xs text-red-500 mt-1">{fieldErrors.rating}</p>
                                                                                                        )}
                                                                                                </div>
                                                                                        </div>

                                                                                        {/* Row 2: Ngày phát hành | Trạng thái */}
                                                                                        <div className="grid grid-cols-12 gap-4">
                                                                                                <div className="col-span-12 lg:col-span-6">
                                                                                                        <Label className="text-sm font-medium text-gray-900 mb-2 block">
                                                                                                                Ngày phát hành
                                                                                                        </Label>
                                                                                                        <input
                                                                                                                type="datetime-local"
                                                                                                                value={
                                                                                                                        editData?.release_date
                                                                                                                                ? format(new Date(editData.release_date), "yyyy-MM-dd'T'HH:mm")
                                                                                                                                : ''
                                                                                                                }
                                                                                                                onChange={(e) =>
                                                                                                                        setEditData({
                                                                                                                                ...editData,
                                                                                                                                release_date: e.target.value ? new Date(e.target.value).toISOString() : undefined
                                                                                                                        })
                                                                                                                }
                                                                                                                className="w-full h-10 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10 outline-none transition-all"
                                                                                                        />
                                                                                                </div>
                                                                                        </div>
                                                                                </div>
                                                                        </div>
                                                                </div>
                                                        </div>
                                                </div>

                                                {/* VÙNG NÚT BẤM CỐ ĐỊNH */}
                                                <div className="px-6 py-4 border-t bg-white flex justify-end items-center gap-3 shrink-0">
                                                        <Button
                                                                variant="ghost"
                                                                onClick={handleClose}
                                                                disabled={isSaving}
                                                                className="h-10 border border-gray-300 text-gray-700 hover:bg-gray-50 hover:text-gray-900"
                                                        >
                                                                Hủy bỏ
                                                        </Button>
                                                        <Button
                                                                disabled={isSaving}
                                                                className="h-10 bg-blue-600 hover:bg-blue-700 min-w-[140px] rounded-lg shadow-lg shadow-blue-500/20 transition-all active:scale-95"
                                                                onClick={async () => {
                                                                        // --- VALIDATION LOGIC ---
                                                                        if (!editData.title?.trim()) {
                                                                                toast.error('Lỗi', {
                                                                                        description: 'Vui lòng nhập tên phim'
                                                                                });
                                                                                return;
                                                                        }
                                                                        if (!editData.duration || Number(editData.duration) <= 0) {
                                                                                toast.error('Lỗi', {
                                                                                        description: 'Thời lượng phim không hợp lệ'
                                                                                });
                                                                                return;
                                                                        }

                                                                        try {
                                                                                setIsSaving(true);

                                                                                // Xử lý nén ảnh Base64
                                                                                let coverBase64: string | undefined = undefined;
                                                                                if (editData.posterFile) {
                                                                                        const f = editData.posterFile as File;
                                                                                        const q = f.size > 15_000_000 ? 0.5 : f.size > 8_000_000 ? 0.6 : 0.75;
                                                                                        coverBase64 = await fileToCompressedDataURL(f, {
                                                                                                maxW: 1280,
                                                                                                maxH: 1280,
                                                                                                quality: q,
                                                                                                type: 'image/webp'
                                                                                        });
                                                                                }

                                                                                const branch_ids = normalizeBranchIdsInput(editData.branch_ids, editData.branch_id);
                                                                                if (Array.isArray(branch_ids) && branch_ids.length === 0) {
                                                                                        toast.error('Lỗi', {
                                                                                                description: 'Vui lòng chọn ít nhất một chi nhánh hoặc "Tất cả chi nhánh"'
                                                                                        });
                                                                                        return;
                                                                                }

                                                                                const payload = {
                                                                                        title: editData.title,
                                                                                        description: editData.description,
                                                                                        cover_image: editData.posterUrl,
                                                                                        cover_image_base64: coverBase64,
                                                                                        genres: editData.genres,
                                                                                        rating: Number(editData.rating) || 0,
                                                                                        duration_min: Number(editData.duration),
                                                                                        branch_ids,
                                                                                        is_active: editData.is_active !== false,
                                                                                        release_date: editData.release_date
                                                                                };

                                                                                if (editData.id) {
                                                                                        await updateMovieApi(Number(editData.id), payload);
                                                                                } else {
                                                                                        await createMovieApi(payload as any);
                                                                                }

                                                                                await refetch('movie');
                                                                                toast.success('Thành công', {
                                                                                        description: editData.id ? 'Đã cập nhật thông tin phim' : 'Đã thêm phim mới'
                                                                                });
                                                                                setIsEditOpen(false);
                                                                                setIsDirty(false);
                                                                        } catch (err: any) {
                                                                                toast.error('Lỗi hệ thống', {
                                                                                        description: err?.message || 'Không thể lưu dữ liệu'
                                                                                });
                                                                        } finally {
                                                                                setIsSaving(false);
                                                                        }
                                                                }}
                                                        >
                                                                {isSaving ? (
                                                                        <div className="flex items-center gap-2">
                                                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                                                <span>Đang xử lý</span>
                                                                        </div>
                                                                ) : (
                                                                        <span>{editData.id ? 'Lưu thay đổi' : 'Tạo phim mới'}</span>
                                                                )}
                                                        </Button>
                                                </div>
                                        </div>
                                )}

                                {editType === 'toy' && (
                                        <div className="flex flex-col h-full overflow-hidden bg-white">
                                                {/* VÙNG CUỘN (SCROLLABLE AREA) */}
                                                <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
                                                        {/* Group 1: Thông tin cơ bản */}
                                                        <div>
                                                                <div className="flex items-center gap-2 mb-3">
                                                                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Thông tin cơ bản</span>
                                                                        <div className="flex-1 h-px bg-slate-200" />
                                                                </div>
                                                                <div className="space-y-4">
                                                                        <div>
                                                                                <Label className="text-sm font-medium text-gray-900 mb-2 block" htmlFor="toy-image">
                                                                                        Ảnh
                                                                                </Label>
                                                                                <Input
                                                                                        id="toy-image"
                                                                                        type="file"
                                                                                        accept="image/*"
                                                                                        onChange={(e) => {
                                                                                                const file = e.target.files?.[0];
                                                                                                if (file) {
                                                                                                        const url = URL.createObjectURL(file);
                                                                                                        setEditData({
                                                                                                                ...editData,
                                                                                                                image_url: url,
                                                                                                                imageFile: file
                                                                                                        });
                                                                                                        setIsDirty(true);
                                                                                                }
                                                                                        }}
                                                                                        className="h-10 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10 outline-none transition-all"
                                                                                />
                                                                                {editData?.image_url && (
                                                                                        <div className="mt-2">
                                                                                                <img
                                                                                                        src={editData?.image_url}
                                                                                                        className="w-full max-h-40 object-cover rounded"
                                                                                                        alt="Preview"
                                                                                                        onError={(e) => { e.currentTarget.src = 'https://placehold.co/400x300?text=No+Image'; }}
                                                                                                />
                                                                                        </div>
                                                                                )}
                                                                        </div>
                                                                        <div>
                                                                                <Label className="text-sm font-medium text-gray-900 mb-2 block" htmlFor="toy-name">
                                                                                        Tên đồ chơi
                                                                                </Label>
                                                                                <Input
                                                                                        id="toy-name"
                                                                                        value={editData?.name || ''}
                                                                                        onChange={(e) => {
                                                                                                setEditData({ ...editData, name: e.target.value });
                                                                                                setIsDirty(true);
                                                                                        }}
                                                                                        className="h-10 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10 outline-none transition-all"
                                                                                />
                                                                        </div>
                                                                        <div>
                                                                                <Label className="text-sm font-medium text-gray-900 mb-2 block" htmlFor="toy-category">
                                                                                        Danh mục
                                                                                </Label>
                                                                                <Input
                                                                                        id="toy-category"
                                                                                        value={editData?.category || ''}
                                                                                        onChange={(e) => {
                                                                                                setEditData({ ...editData, category: e.target.value });
                                                                                                setIsDirty(true);
                                                                                        }}
                                                                                        className="h-10 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10 outline-none transition-all"
                                                                                />
                                                                        </div>
                                                                        <div className="grid grid-cols-2 gap-4">
                                                                                <div>
                                                                                        <Label className="text-sm font-medium text-gray-900 mb-2 block" htmlFor="toy-price">
                                                                                                Giá
                                                                                        </Label>
                                                                                        <Input
                                                                                                id="toy-price"
                                                                                                type="number"
                                                                                                min="0"
                                                                                                step="1"
                                                                                                value={editData.price !== undefined && editData.price !== null ? editData.price : ''}
                                                                                                onChange={(e) => {
                                                                                                        const val = e.target.value;
                                                                                                        setEditData({
                                                                                                                ...editData,
                                                                                                                price: val === '' ? '' : Number(val)
                                                                                                        });
                                                                                                        setIsDirty(true);
                                                                                                }}
                                                                                                className="h-10 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10 outline-none transition-all"
                                                                                        />
                                                                                </div>
                                                                                <div>
                                                                                        <Label className="text-sm font-medium text-gray-900 mb-2 block" htmlFor="toy-stock">
                                                                                                Tồn kho
                                                                                        </Label>
                                                                                        <Input
                                                                                                id="toy-stock"
                                                                                                type="number"
                                                                                                min="0"
                                                                                                step="1"
                                                                                                value={editData.stock !== undefined && editData.stock !== null ? editData.stock : ''}
                                                                                                onChange={(e) => {
                                                                                                        const val = e.target.value;
                                                                                                        setEditData({
                                                                                                                ...editData,
                                                                                                                stock: val === '' ? '' : Number(val)
                                                                                                        });
                                                                                                        setIsDirty(true);
                                                                                                }}
                                                                                                className="h-10 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10 outline-none transition-all"
                                                                                        />
                                                                                </div>
                                                                        </div>
                                                                        <div>
                                                                                <Label className="text-sm font-medium text-gray-900 mb-2 block" htmlFor="toy-status">
                                                                                        Trạng thái
                                                                                </Label>
                                                                                <select
                                                                                        id="toy-status"
                                                                                        value={editData?.status || 'active'}
                                                                                        onChange={(e) => {
                                                                                                setEditData({ ...editData, status: e.target.value });
                                                                                                setIsDirty(true);
                                                                                        }}
                                                                                        className="w-full h-10 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10 outline-none transition-all"
                                                                                >
                                                                                        <option value="active">Hoạt động</option>
                                                                                        <option value="inactive">Đã ẩn</option>
                                                                                </select>
                                                                        </div>
                                                                </div>
                                                        </div>
                                                </div>

                                                {/* VÙNG NÚT BẤM CỐ ĐỊNH */}
                                                <div className="px-6 py-4 border-t bg-white flex justify-end items-center gap-3 shrink-0">
                                                        <Button
                                                                variant="ghost"
                                                                onClick={handleClose}
                                                                disabled={isSaving}
                                                                className="h-10 border border-gray-300 text-gray-700 hover:bg-gray-50 hover:text-gray-900"
                                                        >
                                                                Hủy bỏ
                                                        </Button>
                                                        <Button
                                                                disabled={isSaving}
                                                                className="h-10 bg-blue-600 hover:bg-blue-700 min-w-[140px] rounded-lg shadow-lg shadow-blue-500/20 transition-all active:scale-95"
                                                                onClick={async () => {
                                                                        try {
                                                                                setIsSaving(true);
                                                                                if (!editData.id || editData.id === 0) {
                                                                                        let imageBase64: string | undefined = undefined;
                                                                                        if (editData.imageFile) {
                                                                                                const file = editData.imageFile as File;
                                                                                                imageBase64 = await new Promise<string>((resolve) => {
                                                                                                        const r = new FileReader();
                                                                                                        r.onload = () => resolve(String(r.result));
                                                                                                        r.readAsDataURL(file);
                                                                                                });
                                                                                        }
                                                                                        await createToyApi({
                                                                                                name: editData.name,
                                                                                                category: editData.category,
                                                                                                price: Number(editData.price || 0),
                                                                                                stock: Number(editData.stock || 0),
                                                                                                status: editData.status,
                                                                                                image_url: editData.image_url,
                                                                                                image_base64: imageBase64
                                                                                        });
                                                                                } else {
                                                                                        let imageBase64: string | undefined = undefined;
                                                                                        if (editData.imageFile) {
                                                                                                const file = editData.imageFile as File;
                                                                                                imageBase64 = await new Promise<string>((resolve) => {
                                                                                                        const r = new FileReader();
                                                                                                        r.onload = () => resolve(String(r.result));
                                                                                                        r.readAsDataURL(file);
                                                                                                });
                                                                                        }
                                                                                        await updateToyApi(Number(editData.id), {
                                                                                                name: editData.name,
                                                                                                category: editData.category,
                                                                                                price: Number(editData.price || 0),
                                                                                                stock: Number(editData.stock || 0),
                                                                                                status: editData.status,
                                                                                                image_url: editData.image_url,
                                                                                                image_base64: imageBase64
                                                                                        });
                                                                                }
                                                                                await refetch('toy');
                                                                                toast.success('Thành công', {
                                                                                        description: editData.id ? 'Cập nhật đồ chơi thành công' : 'Thêm đồ chơi mới thành công'
                                                                                });
                                                                                setIsDirty(false);
                                                                                setIsEditOpen(false);
                                                                        } finally {
                                                                                setIsSaving(false);
                                                                        }
                                                                }}
                                                        >
                                                                {isSaving ? (
                                                                        <span className="flex items-center gap-2">
                                                                                <Loader2 className="h-4 w-4 animate-spin" /> Đang lưu...
                                                                        </span>
                                                                ) : (
                                                                        'Lưu'
                                                                )}
                                                        </Button>
                                                </div>
                                        </div>
                                )}
                        </DialogContent>
                </Dialog >
        );
};

export default AdminEditModal;
