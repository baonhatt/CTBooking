import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import React from "react";
// Import các API cần thiết từ file gốc
import { createMovieApi, updateMovieApi, getMoviesAdmin, createToyApi, updateToyApi, getToys, createShowtimeApi, updateShowtimeApi, getShowtimes } from "@/lib/api";

// Định nghĩa Props (Chứa các state, setters, và API function từ Admin.tsx)
interface AdminEditModalProps {
  isEditOpen: boolean;
  setIsEditOpen: (open: boolean) => void;
  editType: "user" | "movie" | "toy" | "showtime" | null;
  editData: any;
  setEditData: (data: any) => void;
  moviesLocal: any[];
  toLocalDateTimeString: (date: Date) => string;
  pageSize: number;
  currentPage: number;

  // Logic setters (được truyền từ Admin.tsx)
  setUsers: React.Dispatch<React.SetStateAction<any[]>>;
  setMoviesLocal: React.Dispatch<React.SetStateAction<any[]>>;
  setMovieStatus: React.Dispatch<React.SetStateAction<Record<string, "active" | "inactive">>>;
  setToys: React.Dispatch<React.SetStateAction<any[]>>;
  setShowtimes: React.Dispatch<React.SetStateAction<any[]>>;
}


const AdminEditModal: React.FC<AdminEditModalProps> = (props) => {
  const {
    isEditOpen, setIsEditOpen, editType, editData, setEditData,
    setUsers, setMoviesLocal, setMovieStatus, setToys, setShowtimes,
    moviesLocal, toLocalDateTimeString, pageSize, currentPage
  } = props;
  // Hàm tạo/cập nhật data tổng quát (nên giữ logic refetch trong Admin.tsx)
  const refetchData = async (type: string) => {
    // Vì logic refetch phức tạp, ta sẽ phải truyền logic này vào props, 
    // nhưng để code gọn, tôi sẽ giữ logic API call trực tiếp như trong file gốc 
    // và chỉ thay đổi nơi gọi hàm `set...`.
 
    if (type === 'movie') {
      const { items } = await getMoviesAdmin({ page: currentPage, pageSize: pageSize })
      const mapped = items.map((m: any) => ({
        id: String(m.id),
        title: m.title,
        year: new Date(m.release_date || Date.now()).getFullYear(),
        duration: m?.duration_min ? `${Number(m.duration_min)} phút` : "",
        genres: Array.isArray(m.genres) ? m.genres : [],
        posterUrl: m.cover_image || "",
        release_date: m.release_date || null,
        rating: m.rating ?? null,
        price: Number(m.price || 0),
      }))
      setMoviesLocal(mapped)
      setMovieStatus((prev) => ({ ...prev, ...Object.fromEntries(mapped.map((x: any) => [x.id, "active"])) }))
    }
    if (type === 'toy') {
      const { items } = await getToys({ page: currentPage, pageSize: pageSize });
      setToys(items.map((t: any) => ({ id: t.id, name: t.name, category: t.category, price: Number(t.price), stock: t.stock, status: t.status, image_url: t.image_url })));
    }
    if (type === 'showtime') {
      const { items } = await getShowtimes({ page: currentPage, pageSize: pageSize });
      setShowtimes(items.map((x: any) => ({ id: x.id, movie_id: x.movie_id, movie_title: x.movie?.title || "", start_time: new Date(x.start_time).toISOString(), price: Number(x.price), total_sold: Number(x.total_sold || 0) })))
    }
  }


  return (
    // Toàn bộ khối Dialog được chuyển vào đây
    <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editType === "user" ? "Chỉnh sửa người dùng" : editType === "movie" ? "Chỉnh sửa phim" : editType === "toy" ? "Chỉnh sửa đồ chơi" : editType === "showtime" ? "Chỉnh sửa lịch chiếu" : ""}</DialogTitle>
        </DialogHeader>

        {/* === LOGIC USER === */}
        {editType === "user" && (
          <div className="space-y-3">
            <div>
              <Label>Họ tên</Label>
              <Input value={editData?.name || ""} onChange={(e) => setEditData({ ...editData, name: e.target.value })} />
            </div>
            <div>
              <Label>Email</Label>
              <Input value={editData?.email || ""} onChange={(e) => setEditData({ ...editData, email: e.target.value })} />
            </div>
            <div>
              <Label>SĐT</Label>
              <Input value={editData?.phone || ""} onChange={(e) => setEditData({ ...editData, phone: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsEditOpen(false)}>Hủy</Button>
              <Button onClick={() => {
                setUsers((prev) => prev.map((u) => (u.id === editData.id ? { ...u, ...editData } : u)));
                setIsEditOpen(false);
              }}>Lưu</Button>
            </div>
          </div>
        )}
        {/* === LOGIC MOVIE === */}
        {editType === "movie" && (
          <div className="space-y-3">
            <div>
              <Label>Poster</Label>
              <Input type="file" accept="image/*" onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const url = URL.createObjectURL(file);
                  setEditData({ ...editData, posterUrl: url, posterFile: file });
                }
              }} />
              {editData?.posterUrl && (<div className="mt-2"><img src={editData?.posterUrl} className="w-full max-h-40 object-cover rounded" /></div>)}
            </div>
            <div>
              <Label>Tên phim</Label>
              <Input value={editData?.title || ""} onChange={(e) => setEditData({ ...editData, title: e.target.value })} />
            </div>
            <div>
              <Label>Mô tả</Label>
              <textarea value={editData?.description || ""} onChange={(e) => setEditData({ ...editData, description: e.target.value })} className="w-full h-24 border rounded-md px-3 py-2" />
            </div>
            <div>
              <Label>Giá</Label>
              <Input
                type="text"
                value={editData.price !== undefined && editData.price !== null
                  ? editData.price.toLocaleString('en-US')
                  : ''
                }
                onChange={(e) => {
                  const numericValue = Number(e.target.value.replace(/,/g, ''));
                  setEditData({ ...editData, price: isNaN(numericValue) ? 0 : numericValue });
                }}
              />
            </div>
            <div>
              <Label>Thể loại</Label>
              <Input value={(editData?.genres || []).join(", ")} onChange={(e) => setEditData({ ...editData, genres: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })} />
            </div>
            <div>
              <Label>Thời lượng</Label>
              <Input value={editData?.duration || ""} onChange={(e) => setEditData({ ...editData, duration: e.target.value })} />
            </div>
            <div>
              <Label>Đánh giá (0–10)</Label>
              <Input type="number" min={0} max={10} step={0.1} value={editData?.rating ?? ""} onChange={(e) => setEditData({ ...editData, rating: e.target.value ? Number(e.target.value) : undefined })} />
            </div>
            <div>
              <Label>Ngày phát hành</Label>
              <Input
                type="datetime-local"
                value={editData?.release_date ? toLocalDateTimeString(new Date(editData.release_date)) : ""}
                onChange={(e) => setEditData({
                  ...editData,
                  release_date: e.target.value ? new Date(e.target.value).toISOString() : undefined
                })}
              />

            </div>
            <div>
              <Label>Trạng thái</Label>
              <select
                value={editData?.status || "active"}
                onChange={(e) => setEditData({ ...editData, status: e.target.value })}
                className="w-full h-10 border rounded-md px-3"
              >
                <option value="active">Hoạt động</option>
                <option value="inactive">Đã ẩn</option>
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsEditOpen(false)}>Hủy</Button>
              <Button onClick={async () => {
                try {
                  if (!editData.id) {
                    let coverBase64: string | undefined = undefined
                    if (editData.posterFile) {
                      const file = editData.posterFile as File
                      coverBase64 = await new Promise<string>((resolve) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.readAsDataURL(file) })
                    }
                    const payload = {
                      title: editData.title,
                      description: editData.description,
                      cover_image: editData.posterUrl,
                      cover_image_base64: coverBase64,
                      detail_images: editData.detail_images,
                      genres: editData.genres,
                      rating: editData.rating ? Number(editData.rating) : undefined,
                      duration_min: editData.duration ? Number(editData.duration) : undefined,
                      price: Number(editData.price || 0),
                      is_active: (editData?.status || "active") === "active",
                      release_date: editData?.release_date,
                    };
                    await createMovieApi(payload as any);
                  } else {
                    let coverBase64: string | undefined = undefined
                    if (editData.posterFile) {
                      const file = editData.posterFile as File
                      coverBase64 = await new Promise<string>((resolve) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.readAsDataURL(file) })
                    }
                    await updateMovieApi(Number(editData.id), {
                      title: editData.title,
                      description: editData.description,
                      cover_image: editData.posterUrl,
                      cover_image_base64: coverBase64,
                      genres: editData.genres,
                      rating: editData.rating ? Number(editData.rating) : undefined,
                      duration_min: editData.duration ? Number(editData.duration) : undefined,
                      price: Number(editData.price || 0),
                      is_active: (editData?.status || "active") === "active",
                      release_date: editData?.release_date,
                    })
                  }
                  await refetchData('movie'); // Gọi hàm refetch local
                } finally {
                  setIsEditOpen(false);
                }
              }}>Lưu</Button>
            </div>
          </div>
        )}
        {/* === LOGIC TOY === */}
        {editType === "toy" && (
          <div className="space-y-3">
            <div>
              <Label>Ảnh</Label>
              <Input type="file" accept="image/*" onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const url = URL.createObjectURL(file);
                  setEditData({ ...editData, image_url: url, imageFile: file });
                }
              }} />
              {editData?.image_url && (<div className="mt-2"><img src={editData?.image_url} className="w-full max-h-40 object-cover rounded" /></div>)}
            </div>
            <div>
              <Label>Tên đồ chơi</Label>
              <Input value={editData?.name || ""} onChange={(e) => setEditData({ ...editData, name: e.target.value })} />
            </div>
            <div>
              <Label>Danh mục</Label>
              <Input value={editData?.category || ""} onChange={(e) => setEditData({ ...editData, category: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Giá</Label>
                <Input
                  type="text"
                  value={editData.price !== undefined && editData.price !== null
                    ? editData.price.toLocaleString('en-US')
                    : ''
                  }
                  onChange={(e) => {
                    const numericValue = Number(e.target.value.replace(/,/g, ''));
                    setEditData({ ...editData, price: isNaN(numericValue) ? 0 : numericValue });
                  }}
                />
              </div>
              <div>
                <Label>Tồn kho</Label>
                <Input
                  type="text"
                  value={editData.stock !== undefined && editData.stock !== null
                    ? editData.stock.toLocaleString('en-US')
                    : ''
                  }
                  onChange={(e) => {
                    const numericValue = Number(e.target.value.replace(/,/g, ''));
                    setEditData({ ...editData, stock: isNaN(numericValue) ? 0 : numericValue });
                  }}
                />
              </div>
            </div>
            <div>
              <Label>Trạng thái</Label>
              <select
                value={editData?.status || "active"}
                onChange={(e) => setEditData({ ...editData, status: e.target.value })}
                className="w-full h-10 border rounded-md px-3"
              >
                <option value="active">Hoạt động</option>
                <option value="inactive">Đã ẩn</option>
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsEditOpen(false)}>Hủy</Button>
              <Button onClick={async () => {
                try {
                  if (!editData.id || editData.id === 0) {
                    let imageBase64: string | undefined = undefined
                    if (editData.imageFile) {
                      const file = editData.imageFile as File
                      imageBase64 = await new Promise<string>((resolve) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.readAsDataURL(file) })
                    }
                    await createToyApi({ name: editData.name, category: editData.category, price: Number(editData.price || 0), stock: Number(editData.stock || 0), status: editData.status, image_url: editData.image_url, image_base64: imageBase64 });
                  } else {
                    let imageBase64: string | undefined = undefined
                    if (editData.imageFile) {
                      const file = editData.imageFile as File
                      imageBase64 = await new Promise<string>((resolve) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.readAsDataURL(file) })
                    }
                    await updateToyApi(Number(editData.id), { name: editData.name, category: editData.category, price: Number(editData.price || 0), stock: Number(editData.stock || 0), status: editData.status, image_url: editData.image_url, image_base64: imageBase64 });
                  }
                  await refetchData('toy'); // Gọi hàm refetch local
                } finally {
                  setIsEditOpen(false);
                }
              }}>Lưu</Button>
            </div>
          </div>
        )}
        {/* === LOGIC SHOWTIME === */}
        {editType === "showtime" && (
          <div className="space-y-3">
            <div>
              <Label>Phim</Label>
              <select
                value={String(editData?.movie_id ?? 0)}
                onChange={(e) => setEditData({ ...editData, movie_id: Number(e.target.value) })}
                className="w-full h-10 border rounded-md px-3"
              >
                <option value="0">Chọn phim</option>
                {moviesLocal.map((m) => (
                  <option key={String((m as any).id ?? m.title)} value={String((m as any).id ?? 0)}>{(m as any).title}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Chọn ngày</Label>
              <Input type="date" value={String(editData?.start_time || "").split("T")[0] || ""} onChange={(e) => { const d = e.target.value; const t = String(editData?.start_time || "").split("T")[1]?.slice(0, 5) || "00:00"; setEditData({ ...editData, start_time: d ? `${d}T${t}` : "" }); }} />
            </div>
            <div>
              <Label>Giờ bắt đầu</Label>
              <Input type="time" step={60} value={toLocalDateTimeString(new Date(editData?.start_time || "")).split("T")[1]?.slice(0, 5) || ""} onChange={(e) => { const t = e.target.value; const d = String(editData?.start_time || "").split("T")[0] || new Date().toISOString().slice(0, 10); setEditData({ ...editData, start_time: t ? `${d}T${t}` : d ? `${d}T00:00` : "" }); }} />
            </div>
            <div>
              <Label>Giá vé</Label>
              <Input
                type="text"
                value={editData.price !== undefined && editData.price !== null
                  ? editData.price.toLocaleString('en-US')
                  : ''
                }
                onChange={(e) => {
                  const numericValue = Number(e.target.value.replace(/,/g, ''));
                  setEditData({ ...editData, price: isNaN(numericValue) ? 0 : numericValue });
                }}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsEditOpen(false)}>Hủy</Button>
              <Button onClick={async () => {
                try {
                  if (!editData?.id || editData?.id === 0) {
                    await createShowtimeApi({ movie_id: Number(editData.movie_id), start_time: editData.start_time, price: Number(editData.price || 0) })
                  } else {
                    await updateShowtimeApi(Number(editData.id), { movie_id: Number(editData.movie_id), start_time: editData.start_time, price: Number(editData.price || 0) })
                  }
                  await refetchData('showtime'); // Gọi hàm refetch local
                } catch (e: any) {
                  alert(e?.message || "Lỗi")
                } finally {
                  setIsEditOpen(false)
                }
              }}>Lưu</Button>
            </div>
          </div>
        )}

      </DialogContent>
    </Dialog>
  );
};

export default AdminEditModal;