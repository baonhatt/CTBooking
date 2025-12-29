import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar, Eye, Loader2, Lock, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import React, { useEffect, useState } from "react";
import {
  createMovieApi,
  updateMovieApi,
  getMoviesAdmin,
  createToyApi,
  updateToyApi,
  getToys,
  getMovieById,
} from "@/lib/api";
import { toast } from "sonner";
import { format } from "date-fns";

interface AdminEditModalProps {
  isEditOpen: boolean;
  setIsEditOpen: (open: boolean) => void;
  editType: "user" | "movie" | "toy" | null;
  editData: any;
  setEditData: (data: any) => void;
  moviesLocal: any[];
  toLocalDateTimeString: (date: Date) => string;
  pageSize: number;
  currentPage: number;
  setUsers: React.Dispatch<React.SetStateAction<any[]>>;
  setMoviesLocal: React.Dispatch<React.SetStateAction<any[]>>;
  setMovieStatus: React.Dispatch<
    React.SetStateAction<Record<string, "active" | "inactive">>
  >;
  setToys: React.Dispatch<React.SetStateAction<any[]>>;
  onViewDetails?: (id: number) => void;
  onRefresh?: () => Promise<void>;
}

const AdminEditModal: React.FC<AdminEditModalProps> = (props) => {

  const [isSaving, setIsSaving] = useState(false);
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
  } = props;

  useEffect(() => {
    const run = async () => {
      if (!isEditOpen || editType !== "movie") return;
      const idNum = Number(editData?.id);
      if (!idNum || editData?.description) return;
      try {
        const m = await getMovieById(idNum);
        if (m) {
          setEditData({
            ...editData,
            description: m.description || "",
            posterUrl: editData?.posterUrl || m.cover_image || "",
            genresText:
              editData?.genresText ??
              (Array.isArray(editData?.genres) && editData.genres.length
                ? editData.genres.join(", ")
                : Array.isArray(m.genres)
                  ? m.genres.join(", ")
                  : ""),
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
                : (m.duration_min ?? ""),
            release_date: editData?.release_date ?? m.release_date ?? null,
            is_active: editData?.is_active ?? m.is_active ?? true,
          });
        }
      } catch {}
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditOpen, editType, editData?.id]);

  async function fileToCompressedDataURL(
    file: File,
    opts?: { maxW?: number; maxH?: number; quality?: number; type?: string },
  ) {
    const maxW = opts?.maxW ?? 1280;
    const maxH = opts?.maxH ?? 1280;
    const quality = opts?.quality ?? 0.75;
    const type = opts?.type ?? "image/webp";
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
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0, w, h);
    const dataUrl = canvas.toDataURL(type, quality);
    URL.revokeObjectURL(blobUrl);
    return dataUrl;
  }

  async function refetch(type: "movie" | "toy") {
    if (type === "movie") {
      if (props.onRefresh) {
        await props.onRefresh();
      }
    }
    if (type === "toy") {
      const { items } = await getToys({ page: currentPage, pageSize });
      setToys(
        items.map((t: any) => ({
          id: t.id,
          name: t.name,
          category: t.category,
          price: Number(t.price),
          stock: t.stock,
          status: t.status,
          image_url: t.image_url,
        })),
      );
    }
  }

  async function titleExists(title: string, excludeId?: number | string) {
    const norm = (s: string) => s.trim().toLowerCase();
    const localHit =
      moviesLocal?.some(
        (m: any) =>
          norm(m.title) === norm(title) &&
          (excludeId == null || String(m.id) !== String(excludeId)),
      ) || false;
    if (localHit) return true;
    const { items } = await getMoviesAdmin({
      page: 1,
      pageSize: 10,
      q: title,
    });
    return items.some(
      (m: any) =>
        norm(m.title) === norm(title) &&
        (excludeId == null || String(m.id) !== String(excludeId)),
    );
  }

  return (
    <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
      <DialogContent className="max-h-[90vh] w-[90vw] max-w-[900px] overflow-y-auto">
        <DialogHeader className="flex flex-row items-center gap-3 space-y-0 pb-4 border-b">
          <DialogTitle className="text-lg font-bold text-slate-800">
            {editType === "user"
              ? "Chỉnh sửa người dùng"
              : editType === "movie"
                ? "Chỉnh sửa phim"
                : editType === "toy"
                  ? "Chỉnh sửa đồ chơi"
                  : ""}
          </DialogTitle>
          {editType === "movie" && editData?.id && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => props.onViewDetails?.(Number(editData.id))}
              className="h-7 rounded-full gap-1.5 border-slate-200 hover:bg-blue-50 hover:text-blue-600 group transition-all px-3"
            >
              <Eye className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-500" />
              <span className="text-[10px] font-bold uppercase tracking-wider">
                Xem chi tiết
              </span>
            </Button>
          )}
        </DialogHeader>

        {editType === "user" && (
          <div className="space-y-3">
            <div>
              <Label>Họ tên</Label>
              <Input
                value={editData?.name || ""}
                onChange={(e) =>
                  setEditData({ ...editData, name: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                value={editData?.email || ""}
                onChange={(e) =>
                  setEditData({ ...editData, email: e.target.value })
                }
              />
            </div>
            <div>
              <Label>SĐT</Label>
              <Input
                value={editData?.phone || ""}
                onChange={(e) =>
                  setEditData({ ...editData, phone: e.target.value })
                }
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsEditOpen(false)}>
                Hủy
              </Button>
              <Button
                disabled={isSaving}
                onClick={async () => {
                  try {
                    setIsSaving(true);
                    setUsers((prev) =>
                      prev.map((u) =>
                        u.id === editData.id ? { ...u, ...editData } : u,
                      ),
                    );
                    toast.success("Thành công", {
                      description: "Cập nhật người dùng thành công",
                    });
                    setIsEditOpen(false);
                  } catch (e: any) {
                    toast.error("Lỗi", {
                      description: e?.message || "Có lỗi xảy ra",
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
                  "Lưu"
                )}
              </Button>
            </div>
          </div>
        )}

        {editType === "movie" && (
          <div className="flex flex-col h-full overflow-hidden bg-white">
            {/* VÙNG CUỘN (SCROLLABLE AREA) */}
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 bg-slate-50/30">
              <div className="grid grid-cols-12 gap-8">
                {/* Cột trái: Poster (Cố định hoặc cuộn theo tùy màn hình) */}
                <div className="col-span-12 md:col-span-4 lg:col-span-3 space-y-4">
                  <label className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm block cursor-pointer group hover:border-blue-400 transition-all">
                    <span className="text-[11px] font-bold uppercase text-slate-400 mb-3 block tracking-wider">
                      Poster Phim
                    </span>

                    <div className="aspect-[2/3] relative border-2 border-dashed rounded-xl overflow-hidden bg-slate-50 group-hover:border-blue-200 transition-colors">
                      {editData?.posterUrl ? (
                        <>
                          <img
                            src={editData.posterUrl}
                            className="w-full h-full object-cover"
                            alt="Poster preview"
                          />
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
                          <span className="text-xs font-medium">
                            Tải ảnh lên
                          </span>
                        </div>
                      )}

                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const url = URL.createObjectURL(file);
                            setEditData({
                              ...editData,
                              posterUrl: url,
                              posterFile: file,
                            });
                          }
                        }}
                      />
                    </div>

                    <p className="text-[10px] text-slate-400 mt-3 text-center italic">
                      Hỗ trợ: JPG, PNG, WEBP (Tối đa 15MB)
                    </p>
                  </label>
                </div>

                {/* Cột phải: Thông tin chi tiết */}
                <div className="col-span-12 md:col-span-8 lg:col-span-9 space-y-6">
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
                    {/* Hàng 1: ID & Tên phim */}
                    <div className="grid grid-cols-12 gap-4">
                      {editData?.id ? (
                        <div className="col-span-12 lg:col-span-3">
                          <Label className="text-[11px] font-bold uppercase text-slate-400 mb-1.5 block">
                            ID Hệ thống
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

                      <div
                        className={`${editData?.id ? "col-span-12 lg:col-span-9" : "col-span-12"}`}
                      >
                        <Label className="text-[11px] font-bold uppercase text-slate-400 mb-1.5 block">
                          Tên phim
                        </Label>
                        <Input
                          placeholder="Ví dụ: Đào, Phở và Piano"
                          value={editData?.title || ""}
                          onChange={(e) =>
                            setEditData({ ...editData, title: e.target.value })
                          }
                          className="focus-visible:ring-blue-500/20"
                        />
                      </div>
                    </div>

                    {/* Hàng 2: Mô tả */}
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-bold uppercase text-slate-400 mb-1.5 block">
                        Mô tả nội dung
                      </Label>
                      <textarea
                        value={editData?.description || ""}
                        onChange={(e) =>
                          setEditData({
                            ...editData,
                            description: e.target.value,
                          })
                        }
                        placeholder="Nhập tóm tắt nội dung phim..."
                        className="w-full h-32 border border-slate-200 rounded-xl px-3 py-2.5 text-sm leading-relaxed focus:border-blue-400 focus:ring-4 focus:ring-blue-500/5 outline-none resize-none transition-all placeholder:text-slate-300"
                      />
                    </div>

                    {/* Hàng 3: Thể loại */}
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-bold uppercase text-slate-400 mb-1.5 block">
                        Thể loại (Ví dụ: Hành động, Tình cảm)
                      </Label>
                      <Input
                        placeholder="Nhập các thể loại, ngăn cách bằng dấu phẩy"
                        value={
                          editData?.genresText ??
                          (editData?.genres || []).join(", ")
                        }
                        onChange={(e) =>
                          setEditData({
                            ...editData,
                            genresText: e.target.value,
                            genres: e.target.value
                              .split(/[,;|\n]| {2,}/)
                              .map((x) => x.trim())
                              .filter(Boolean),
                          })
                        }
                      />
                    </div>

                    {/* Hàng 4: Thời lượng, Đánh giá, Ngày & Trạng thái */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div>
                        <Label className="text-[11px] font-bold uppercase text-slate-400 mb-1.5 block">
                          Thời lượng (Phút)
                        </Label>
                        <Input
                          type="number"
                          placeholder="120"
                          value={editData?.duration || ""}
                          onChange={(e) =>
                            setEditData({
                              ...editData,
                              duration:
                                e.target.value === ""
                                  ? ""
                                  : Number(e.target.value),
                            })
                          }
                        />
                      </div>

                      <div>
                        <Label className="text-[11px] font-bold uppercase text-slate-400 mb-1.5 block">
                          Đánh giá (0-10)
                        </Label>
                        <Input
                          type="number"
                          step="0.1"
                          placeholder="8.5"
                          value={editData?.rating ?? ""}
                          onChange={(e) =>
                            setEditData({
                              ...editData,
                              rating: e.target.value
                                ? Number(e.target.value)
                                : undefined,
                            })
                          }
                        />
                      </div>

                      <div className="relative group">
                        <Label className="text-[11px] font-bold uppercase text-slate-400 mb-1.5 block">
                          Ngày phát hành
                        </Label>
                        <div className="relative h-10">
                          <input
                            type="datetime-local"
                            value={
                              editData?.release_date
                                ? format(
                                    new Date(editData.release_date),
                                    "yyyy-MM-dd'T'HH:mm",
                                  )
                                : ""
                            }
                            onChange={(e) =>
                              setEditData({
                                ...editData,
                                release_date: e.target.value
                                  ? new Date(e.target.value).toISOString()
                                  : undefined,
                              })
                            }
                            className="absolute inset-0 w-full h-full opacity-0 z-20 cursor-pointer"
                          />
                          <div className="absolute inset-0 w-full h-full border rounded-md px-3 flex items-center justify-between bg-white group-hover:border-blue-400 transition-all z-10">
                            <span className="text-sm truncate">
                              {editData?.release_date
                                ? format(
                                    new Date(editData.release_date),
                                    "dd/MM/yyyy HH:mm",
                                  )
                                : "Chọn ngày"}
                            </span>
                            <Calendar
                              size={16}
                              className="text-slate-400 shrink-0"
                            />
                          </div>
                        </div>
                      </div>

                      <div>
                        <Label className="text-[11px] font-bold uppercase text-slate-400 mb-1.5 block">
                          Trạng thái
                        </Label>
                        <select
                          value={
                            editData?.is_active !== false
                              ? "active"
                              : "inactive"
                          }
                          onChange={(e) =>
                            setEditData({
                              ...editData,
                              is_active: e.target.value === "active",
                            })
                          }
                          className="w-full h-10 border border-slate-200 rounded-md px-3 text-sm focus:border-blue-400 focus:ring-4 focus:ring-blue-500/5 outline-none transition-all"
                        >
                          <option value="active">🟢 Đang chiếu</option>
                          <option value="inactive">🔴 Đã ẩn</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* VÙNG NÚT BẤM CỐ ĐỊNH */}
            <div className="px-6 py-4 border-t bg-white flex justify-end items-center gap-3 shrink-0">
              <span className="text-[11px] text-slate-400 mr-auto italic font-sans">
                * Lưu ý: Mọi thay đổi sẽ ảnh hưởng trực tiếp đến lịch chiếu hiện
                tại.
              </span>
              <Button
                variant="ghost"
                onClick={() => setIsEditOpen(false)}
                disabled={isSaving}
                className="text-slate-500 hover:bg-slate-100"
              >
                Hủy bỏ
              </Button>
              <Button
                disabled={isSaving}
                className="bg-blue-600 hover:bg-blue-700 min-w-[140px] rounded-xl shadow-lg shadow-blue-500/20 transition-all active:scale-95"
                onClick={async () => {
                  // --- VALIDATION LOGIC ---
                  if (!editData.title?.trim()) {
                    toast.error("Lỗi", {
                      description: "Vui lòng nhập tên phim",
                    });
                    return;
                  }
                  if (!editData.duration || Number(editData.duration) <= 0) {
                    toast.error("Lỗi", {
                      description: "Thời lượng phim không hợp lệ",
                    });
                    return;
                  }

                  try {
                    setIsSaving(true);

                    // Xử lý nén ảnh Base64
                    let coverBase64: string | undefined = undefined;
                    if (editData.posterFile) {
                      const f = editData.posterFile as File;
                      const q =
                        f.size > 15_000_000
                          ? 0.5
                          : f.size > 8_000_000
                            ? 0.6
                            : 0.75;
                      coverBase64 = await fileToCompressedDataURL(f, {
                        maxW: 1280,
                        maxH: 1280,
                        quality: q,
                        type: "image/webp",
                      });
                    }

                    const payload = {
                      title: editData.title,
                      description: editData.description,
                      cover_image: editData.posterUrl,
                      cover_image_base64: coverBase64,
                      genres: editData.genres,
                      rating: Number(editData.rating) || 0,
                      duration_min: Number(editData.duration),
                      is_active: editData.is_active !== false,
                      release_date: editData.release_date,
                    };

                    if (editData.id) {
                      await updateMovieApi(Number(editData.id), payload);
                    } else {
                      await createMovieApi(payload as any);
                    }

                    await refetch("movie");
                    toast.success("Thành công", {
                      description: editData.id
                        ? "Đã cập nhật thông tin phim"
                        : "Đã thêm phim mới",
                    });
                    setIsEditOpen(false);
                  } catch (err: any) {
                    toast.error("Lỗi hệ thống", {
                      description: err?.message || "Không thể lưu dữ liệu",
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
                  <span>{editData.id ? "Lưu thay đổi" : "Tạo phim mới"}</span>
                )}
              </Button>
            </div>
          </div>
        )}

        {editType === "toy" && (
          <div className="space-y-3">
            <div>
              <Label>Ảnh</Label>
              <Input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const url = URL.createObjectURL(file);
                    setEditData({
                      ...editData,
                      image_url: url,
                      imageFile: file,
                    });
                  }
                }}
              />
              {editData?.image_url && (
                <div className="mt-2">
                  <img
                    src={editData?.image_url}
                    className="w-full max-h-40 object-cover rounded"
                  />
                </div>
              )}
            </div>
            <div>
              <Label>Tên đồ chơi</Label>
              <Input
                value={editData?.name || ""}
                onChange={(e) =>
                  setEditData({ ...editData, name: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Danh mục</Label>
              <Input
                value={editData?.category || ""}
                onChange={(e) =>
                  setEditData({ ...editData, category: e.target.value })
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Giá</Label>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={
                    editData.price !== undefined && editData.price !== null
                      ? editData.price
                      : ""
                  }
                  onChange={(e) => {
                    let numericValue =
                      e.target.value === "" ? 0 : Number(e.target.value);
                    if (numericValue < 0) numericValue = 0;
                    setEditData({
                      ...editData,
                      price: numericValue,
                    });
                  }}
                />
              </div>
              <div>
                <Label>Tồn kho</Label>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={
                    editData.stock !== undefined && editData.stock !== null
                      ? editData.stock
                      : ""
                  }
                  onChange={(e) => {
                    let numericValue =
                      e.target.value === "" ? 0 : Number(e.target.value);
                    if (numericValue < 0) numericValue = 0;
                    setEditData({
                      ...editData,
                      stock: numericValue,
                    });
                  }}
                />
              </div>
            </div>
            <div>
              <Label>Trạng thái</Label>
              <select
                value={editData?.status || "active"}
                onChange={(e) =>
                  setEditData({ ...editData, status: e.target.value })
                }
                className="w-full h-10 border rounded-md px-3"
              >
                <option value="active">Hoạt động</option>
                <option value="inactive">Đã ẩn</option>
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsEditOpen(false)}>
                Hủy
              </Button>
              <Button
                disabled={isSaving}
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
                        image_base64: imageBase64,
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
                        image_base64: imageBase64,
                      });
                    }
                    await refetch("toy");
                    toast.success("Thành công", {
                      description: editData.id
                        ? "Cập nhật đồ chơi thành công"
                        : "Thêm đồ chơi mới thành công",
                    });
                  } finally {
                    setIsSaving(false);
                    setIsEditOpen(false);
                  }
                }}
              >
                {isSaving ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Đang lưu...
                  </span>
                ) : (
                  "Lưu"
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default AdminEditModal;
