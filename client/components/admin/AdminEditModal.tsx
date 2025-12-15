import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";

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
}

const AdminEditModal: React.FC<AdminEditModalProps> = (props) => {
  const { toast } = useToast();
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
                : m.duration_min ?? "",
            release_date:
              editData?.release_date ?? m.release_date ?? null,
          });
        }
      } catch {}
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditOpen, editType, editData?.id]);

  async function fileToCompressedDataURL(file: File, opts?: { maxW?: number; maxH?: number; quality?: number; type?: string }) {
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
      const { items } = await getMoviesAdmin({ page: currentPage, pageSize });
      const mapped = items.map((m: any) => ({
        id: String(m.id),
        title: m.title,
        year: new Date(m.release_date || Date.now()).getFullYear(),
        duration: m?.duration_min ? `${Number(m.duration_min)}` : "",
        genres: Array.isArray(m.genres) ? m.genres : [],
        posterUrl: m.cover_image || "",
        release_date: m.release_date || null,
        rating: m.rating ?? null,
        is_active: m.is_active !== false,
      }));
      setMoviesLocal(mapped);
      setMovieStatus((prev) => ({
        ...prev,
        ...Object.fromEntries(mapped.map((x: any) => [x.id, x.is_active ? "active" : "inactive"])),
      }));
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
        <DialogHeader>
          <DialogTitle>
            {editType === "user"
              ? "Chỉnh sửa người dùng"
              : editType === "movie"
                ? "Chỉnh sửa phim"
                : editType === "toy"
                  ? "Chỉnh sửa đồ chơi"
                  : ""}
          </DialogTitle>
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
                    toast({
                      title: "Thành công",
                      description: "Cập nhật người dùng thành công",
                    });
                    setIsEditOpen(false);
                  } catch (e: any) {
                    toast({
                      title: "Lỗi",
                      description: e?.message || "Có lỗi xảy ra",
                      variant: "destructive",
                    });
                  } finally {
                    setIsSaving(false);
                  }
                }}
              >
                {isSaving ? (
                  <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Đang lưu...</span>
                ) : (
                  "Lưu"
                )}
              </Button>
            </div>
          </div>
        )}

        {editType === "movie" && (
          <div className="space-y-3">
            <div>
              <Label>Poster</Label>
              <Input
                type="file"
                accept="image/*"
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
              {editData?.posterUrl && (
                <div className="mt-2">
                  <img
                    src={editData?.posterUrl}
                    className="w-full max-h-40 object-cover rounded"
                  />
                </div>
              )}
            </div>
            <div>
              <Label>Tên phim</Label>
              <Input
                value={editData?.title || ""}
                onChange={(e) =>
                  setEditData({ ...editData, title: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Mô tả</Label>
              <textarea
                value={editData?.description || ""}
                onChange={(e) =>
                  setEditData({ ...editData, description: e.target.value })
                }
                className="w-full h-24 border rounded-md px-3 py-2"
              />
            </div>
            <div>
              <Label>Thể loại</Label>
              <Input
                value={editData?.genresText ?? (editData?.genres || []).join(", ")}
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
            <div>
              <Label>Thời lượng (phút)</Label>
              <Input
                type="number"
                min="0"
                step="1"
                value={editData?.duration || ""}
                onChange={(e) => {
                  let numericValue = e.target.value === "" ? "" : Number(e.target.value);
                  if (typeof numericValue === "number" && numericValue < 0) numericValue = 0;
                  setEditData({ ...editData, duration: numericValue })
                }}
              />
            </div>
            <div>
              <Label>Đánh giá (0–10)</Label>
              <Input
                type="number"
                min={0}
                max={10}
                step={0.1}
                value={editData?.rating ?? ""}
                onChange={(e) =>
                  setEditData({
                    ...editData,
                    rating: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
              />
            </div>
            <div>
              <Label>Ngày phát hành</Label>
              <Input
                type="datetime-local"
                value={
                  editData?.release_date
                    ? toLocalDateTimeString(new Date(editData.release_date))
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
              />
            </div>
            <div>
              <Label>Trạng thái</Label>
              <select
                value={editData?.is_active !== false ? "active" : "inactive"}
                onChange={(e) =>
                  setEditData({ ...editData, is_active: e.target.value === "active" })
                }
                className="w-full h-10 border rounded-md px-3"
              >
                <option value="active">Hoạt động</option>
                <option value="inactive">Tạm ẩn</option>
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsEditOpen(false)}>
                Hủy
              </Button>
              <Button
                disabled={isSaving}
                onClick={async () => {
                  // Validation for movies
                  if (!editData.title || editData.title.trim() === "") {
                    toast({
                      title: "Lỗi",
                      description: "Tên phim là bắt buộc",
                      variant: "destructive",
                    });
                    return;
                  }
                  if (editData.duration === undefined || editData.duration === null || editData.duration === "" || Number(editData.duration) <= 0) {
                    toast({
                      title: "Lỗi",
                      description: "Thời lượng là bắt buộc",
                      variant: "destructive",
                    });
                    return;
                  }
                  if (!editData.release_date) {
                    toast({
                      title: "Lỗi",
                      description: "Ngày phát hành là bắt buộc",
                      variant: "destructive",
                    });
                    return;
                  }
                  const dup = await titleExists(editData.title, editData.id || undefined);
                  if (dup) {
                    toast({
                      title: "Trùng tên phim",
                      description: "Tiêu đề phim đã tồn tại trên hệ thống",
                      variant: "destructive",
                    });
                    return;
                  }

                  try {
                    setIsSaving(true);
                    if (!editData.id) {
                      let coverBase64: string | undefined = undefined;
                      if (editData.posterFile) {
                        coverBase64 = await fileToCompressedDataURL(editData.posterFile as File, { maxW: 1280, maxH: 1280, quality: 0.75, type: "image/webp" });
                      }
                      const payload = {
                        title: editData.title,
                        description: editData.description,
                        cover_image: editData.posterUrl,
                        cover_image_base64: coverBase64,
                        detail_images: editData.detail_images,
                        genres: editData.genres,
                        rating: editData.rating
                          ? Number(editData.rating)
                          : undefined,
                        duration_min: editData.duration
                          ? Number(editData.duration)
                          : undefined,
                        is_active: (editData?.status || "active") === "active",
                        release_date: editData?.release_date,
                      };
                      await createMovieApi(payload as any);
                    } else {
                      let coverBase64: string | undefined = undefined;
                      if (editData.posterFile) {
                        coverBase64 = await fileToCompressedDataURL(editData.posterFile as File, { maxW: 1280, maxH: 1280, quality: 0.75, type: "image/webp" });
                      }
                      await updateMovieApi(Number(editData.id), {
                        title: editData.title,
                        description: editData.description,
                        cover_image: editData.posterUrl,
                        cover_image_base64: coverBase64,
                        genres: editData.genres,
                        rating: editData.rating
                          ? Number(editData.rating)
                          : undefined,
                        duration_min: editData.duration
                          ? Number(editData.duration)
                          : undefined,
                        is_active: editData?.is_active !== false,
                        release_date: editData?.release_date,
                      });
                    }
                    await refetch("movie");
                    toast({
                      title: "Thành công",
                      description: editData.id ? "Cập nhật phim thành công" : "Thêm phim mới thành công",
                    });
                  } catch (err: any) {
                    toast({
                      title: "Lỗi",
                      description: err?.message || "Có lỗi xảy ra",
                      variant: "destructive",
                    });
                    return;
                  } finally {
                    setIsSaving(false);
                    setIsEditOpen(false);
                  }
                }}
              >
                {isSaving ? (
                  <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Đang lưu...</span>
                ) : (
                  "Lưu"
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
                  value={editData.price !== undefined && editData.price !== null ? editData.price : ""}
                  onChange={(e) => {
                    let numericValue = e.target.value === "" ? 0 : Number(e.target.value);
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
                  value={editData.stock !== undefined && editData.stock !== null ? editData.stock : ""}
                  onChange={(e) => {
                    let numericValue = e.target.value === "" ? 0 : Number(e.target.value);
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
                    toast({
                      title: "Thành công",
                      description: editData.id ? "Cập nhật đồ chơi thành công" : "Thêm đồ chơi mới thành công",
                    });
                  } finally {
                    setIsSaving(false);
                    setIsEditOpen(false);
                  }
                }}
              >
                {isSaving ? (
                  <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Đang lưu...</span>
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
