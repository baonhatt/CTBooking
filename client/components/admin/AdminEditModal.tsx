import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import React, { useState } from "react";
import {
  createMovieApi,
  updateMovieApi,
  getMoviesAdmin,
  createToyApi,
  updateToyApi,
  getToys,
  createShowtimeApi,
  updateShowtimeApi,
  getShowtimes,
  createShowtimesBatchApi,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

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
  setUsers: React.Dispatch<React.SetStateAction<any[]>>;
  setMoviesLocal: React.Dispatch<React.SetStateAction<any[]>>;
  setMovieStatus: React.Dispatch<
    React.SetStateAction<Record<string, "active" | "inactive">>
  >;
  setToys: React.Dispatch<React.SetStateAction<any[]>>;
  setShowtimes: React.Dispatch<React.SetStateAction<any[]>>;
}

const AdminEditModal: React.FC<AdminEditModalProps> = (props) => {
  const { toast } = useToast();
  const [selectedMovieInfo, setSelectedMovieInfo] = useState<any>(null);
  const [isMovieInfoValid, setIsMovieInfoValid] = useState(false);
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
    setShowtimes,
    moviesLocal,
    toLocalDateTimeString,
    pageSize,
    currentPage,
  } = props;

  // Reset movie info when modal closes
  React.useEffect(() => {
    if (!isEditOpen) {
      setSelectedMovieInfo(null);
      setIsMovieInfoValid(false);
    }
  }, [isEditOpen]);

  async function refetch(type: "movie" | "toy" | "showtime") {
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
      }));
      setMoviesLocal(mapped);
      setMovieStatus((prev) => ({
        ...prev,
        ...Object.fromEntries(mapped.map((x: any) => [x.id, "active"])),
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
    if (type === "showtime") {
      const { items } = await getShowtimes({ page: currentPage, pageSize });
      setShowtimes(
        items.map((x: any) => ({
          id: x.id,
          movie_id: x.movie_id,
          movie_title: x.movie?.title || "",
          start_time: new Date(x.start_time).toISOString(),
          total_sold: Number(x.total_sold || 0),
        })),
      );
    }
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
                  : editType === "showtime"
                    ? "Chỉnh sửa lịch chiếu"
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
                onClick={async () => {
                  try {
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
                  }
                }}
              >
                Lưu
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
                value={(editData?.genres || []).join(", ")}
                onChange={(e) =>
                  setEditData({
                    ...editData,
                    genres: e.target.value
                      .split(",")
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

                  try {
                    if (!editData.id) {
                      let coverBase64: string | undefined = undefined;
                      if (editData.posterFile) {
                        const file = editData.posterFile as File;
                        coverBase64 = await new Promise<string>((resolve) => {
                          const r = new FileReader();
                          r.onload = () => resolve(String(r.result));
                          r.readAsDataURL(file);
                        });
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
                        const file = editData.posterFile as File;
                        coverBase64 = await new Promise<string>((resolve) => {
                          const r = new FileReader();
                          r.onload = () => resolve(String(r.result));
                          r.readAsDataURL(file);
                        });
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
                        is_active: (editData?.status || "active") === "active",
                        release_date: editData?.release_date,
                      });
                    }
                    await refetch("movie");
                    toast({
                      title: "Thành công",
                      description: editData.id ? "Cập nhật phim thành công" : "Thêm phim mới thành công",
                    });
                  } finally {
                    setIsEditOpen(false);
                  }
                }}
              >
                Lưu
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
                onClick={async () => {
                  try {
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
                    setIsEditOpen(false);
                  }
                }}
              >
                Lưu
              </Button>
            </div>
          </div>
        )}

        {editType === "showtime" && (
          <div className="space-y-3">
            <div>
              <Label>Phim</Label>
              <select
                value={String(editData?.movie_id ?? 0)}
                onChange={(e) => {
                  const movieId = Number(e.target.value);
                  setEditData({ ...editData, movie_id: movieId });
                  // Find and set selected movie info for create mode
                  if (!editData?.id || editData?.id === 0) {
                    if (movieId) {
                      const selectedMovie = moviesLocal.find(
                        (m) => String((m as any).id) === String(movieId)
                      );
                      if (selectedMovie) {
                        const movie = selectedMovie as any;
                        // Check if all required fields have data
                        const isValid = movie.release_date && movie.duration;

                        console.log("Selected Movie:", movie);
                        console.log("Is Valid:", isValid, { release_date: movie.release_date, duration: movie.duration });

                        setSelectedMovieInfo({
                          title: movie.title,
                          release_date: movie.release_date,
                          duration: movie.duration,
                          genres: movie.genres,
                        });
                        setIsMovieInfoValid(isValid);
                      } else {
                        setSelectedMovieInfo(null);
                        setIsMovieInfoValid(false);
                      }
                    } else {
                      setSelectedMovieInfo(null);
                      setIsMovieInfoValid(false);
                    }
                  }
                }}
                disabled={editData?.id && editData?.id !== 0}
                className="w-full h-10 border rounded-md px-3 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="0">Chọn phim</option>
                {moviesLocal.map((m) => (
                  <option
                    key={String((m as any).id ?? m.title)}
                    value={String((m as any).id ?? 0)}
                  >
                    {(m as any).title}
                  </option>
                ))}
                {editData?.movie_id &&
                  !moviesLocal.some(
                    (m) => String((m as any).id) === String(editData.movie_id),
                  ) && (
                    <option value={String(editData.movie_id)}>
                      {String(editData.movie_title || `#${editData.movie_id}`)}
                    </option>
                  )}
              </select>
            </div>

            {!editData?.id || editData?.id === 0 ? (
              <>
                {/* Show selected movie info in create mode */}
                {selectedMovieInfo && (
                  <div className={`border-2 rounded-lg p-4 space-y-2 ${!isMovieInfoValid ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'}`}>
                    <h4 className={`font-semibold ${!isMovieInfoValid ? 'text-red-900' : 'text-blue-900'}`}>
                      Thông tin phim {!isMovieInfoValid && '⚠️ (Chưa đủ thông tin)'}
                    </h4>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className={!isMovieInfoValid ? 'text-red-600 font-semibold' : 'text-gray-600'}>
                          Tên phim
                        </p>
                        <p className="font-medium">{selectedMovieInfo.title}</p>
                      </div>
                      <div>
                        <p className={!selectedMovieInfo.release_date ? 'text-red-600 font-semibold' : 'text-gray-600'}>
                          Ngày phát hành {!selectedMovieInfo.release_date && '❌'}
                        </p>
                        <p className="font-medium">
                          {selectedMovieInfo.release_date
                            ? new Date(selectedMovieInfo.release_date).toLocaleDateString("vi-VN")
                            : 'Chưa nhập'}
                        </p>
                      </div>
                      <div>
                        <p className={!selectedMovieInfo.duration ? 'text-red-600 font-semibold' : 'text-gray-600'}>
                          Thời lượng(phút) {!selectedMovieInfo.duration && '❌'}
                        </p>
                        <p className="font-medium">
                          {selectedMovieInfo.duration ? selectedMovieInfo.duration : 'Chưa nhập'}
                        </p>
                      </div>
                    </div>
                    {!isMovieInfoValid && (
                      <p className="text-sm text-red-700 mt-2">
                        ⚠️ Vui lòng hoàn thành thông tin phim (ngày phát hành, thời lượng) trước khi tạo suất chiếu
                      </p>
                    )}
                  </div>
                )}

                <div>
                  <Button
                    variant="outline"
                    disabled={!isMovieInfoValid}
                    onClick={() => {
                      const rows = Array.isArray(editData.rows)
                        ? editData.rows
                        : [];
                      if (rows.length >= 4) {
                        alert("Tối đa 4 dòng");
                        return;
                      }
                      setEditData({
                        ...editData,
                        rows: [
                          ...rows,
                          {
                            day: "",
                            time: "",
                          },
                        ],
                      });
                    }}
                    className={isMovieInfoValid ? '' : 'opacity-50 cursor-not-allowed'}
                  >
                    Thêm row
                  </Button>
                </div>
                <div className="space-y-3">
                  {(editData.rows || []).map((row: any, idx: number) => (
                    <div
                      key={idx}
                      className="border rounded-md p-3 grid grid-cols-1 md:grid-cols-4 gap-3 items-end"
                    >
                      <div>
                        <Label>Ngày</Label>
                        <Input
                          type="date"
                          value={row.day || ""}
                          onChange={(e) => {
                            const rows = [...(editData.rows || [])];
                            rows[idx] = { ...rows[idx], day: e.target.value };
                            setEditData({ ...editData, rows });
                          }}
                        />
                      </div>
                      <div>
                        <Label>Giờ</Label>
                        <Input
                          type="time"
                          step={60}
                          value={row.time || ""}
                          onChange={(e) => {
                            const rows = [...(editData.rows || [])];
                            rows[idx] = { ...rows[idx], time: e.target.value };
                            setEditData({ ...editData, rows });
                          }}
                        />
                      </div>
                      <div className="flex justify-end">
                        <Button
                          variant="destructive"
                          onClick={() => {
                            const rows = [...(editData.rows || [])];
                            rows.splice(idx, 1);
                            setEditData({ ...editData, rows });
                          }}
                        >
                          Xóa
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setIsEditOpen(false)}
                  >
                    Hủy
                  </Button>
                  <Button
                    onClick={async () => {
                      // Validation for new showtime
                      if (!editData.movie_id) {
                        toast({
                          title: "Lỗi",
                          description: "Vui lòng chọn phim",
                          variant: "destructive",
                        });
                        return;
                      }
                      if (!isMovieInfoValid) {
                        toast({
                          title: "Lỗi",
                          description: "Phim chưa có đủ thông tin (giá, ngày phát hành, thời lượng)",
                          variant: "destructive",
                        });
                        return;
                      }

                      try {
                        const rows: Array<{
                          day: string;
                          time: string;
                        }> = Array.isArray(editData.rows) ? editData.rows : [];
                        if (rows.length > 0) {
                          // Validate all rows
                          const invalidRows = rows.filter(r => !r.day || !r.time);
                          if (invalidRows.length > 0) {
                            toast({
                              title: "Lỗi",
                              description: "Vui lòng điền đầy đủ thông tin ngày, giờ cho tất cả các dòng",
                              variant: "destructive",
                            });
                            return;
                          }

                          const payload = {
                            movie_id: Number(editData.movie_id),
                            start_times: rows.map((r) => ({
                              start_time: `${r.day}T${r.time}`,
                            })),
                          };
                          const res = await createShowtimesBatchApi(payload);
                          const createdCount = (res.created || []).length;
                          const skippedCount = (res.skipped || []).length;

                          toast({
                            title: "Thành công",
                            description: `Tạo ${createdCount} lịch chiếu${skippedCount > 0 ? `, bỏ qua ${skippedCount}` : ""}`,
                          });
                        } else {
                          await createShowtimeApi({
                            movie_id: Number(editData.movie_id),
                            start_time: editData.start_time,
                          });
                          toast({
                            title: "Thành công",
                            description: "Thêm lịch chiếu mới thành công",
                          });
                        }
                        await refetch("showtime");
                      } catch (e: any) {
                        toast({
                          title: "Lỗi",
                          description: e?.message || "Có lỗi xảy ra",
                          variant: "destructive",
                        });
                      } finally {
                        setIsEditOpen(false);
                      }
                    }}
                  >
                    Lưu
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <Label>Ngày</Label>
                    <Input
                      type="date"
                      value={
                        editData?.start_time
                          ? toLocalDateTimeString(
                            new Date(editData.start_time),
                          ).split("T")[0]
                          : ""
                      }
                      onChange={(e) => {
                        const d = e.target.value;
                        const timeStr =
                          editData?.start_time
                            ? toLocalDateTimeString(
                              new Date(editData.start_time),
                            )
                              .split("T")[1]
                              ?.slice(0, 5)
                            : "00:00";
                        if (d) {
                          const localDateTime = new Date(`${d}T${timeStr}`);
                          setEditData({
                            ...editData,
                            start_time: localDateTime.toISOString(),
                          });
                        }
                      }}
                    />
                  </div>
                  <div>
                    <Label>Giờ</Label>
                    <Input
                      type="time"
                      step={60}
                      value={
                        editData?.start_time
                          ? toLocalDateTimeString(
                            new Date(editData.start_time),
                          )
                            .split("T")[1]
                            ?.slice(0, 5)
                          : ""
                      }
                      onChange={(e) => {
                        const t = e.target.value;
                        const dateStr =
                          editData?.start_time
                            ? toLocalDateTimeString(
                              new Date(editData.start_time),
                            ).split("T")[0]
                            : new Date().toISOString().slice(0, 10);
                        if (t) {
                          const localDateTime = new Date(`${dateStr}T${t}`);
                          setEditData({
                            ...editData,
                            start_time: localDateTime.toISOString(),
                          });
                        }
                      }}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setIsEditOpen(false)}
                  >
                    Hủy
                  </Button>
                  <Button
                    onClick={async () => {
                      // Validation for showtime edit
                      if (!editData.start_time) {
                        toast({
                          title: "Lỗi",
                          description: "Ngày và giờ là bắt buộc",
                          variant: "destructive",
                        });
                        return;
                      }

                      try {
                        await updateShowtimeApi(Number(editData.id), {
                          movie_id: Number(editData.movie_id),
                          start_time: editData.start_time,
                        });
                        await refetch("showtime");
                        toast({
                          title: "Thành công",
                          description: "Cập nhật lịch chiếu thành công",
                        });
                      } catch (e: any) {
                        toast({
                          title: "Lỗi",
                          description: e?.message || "Có lỗi xảy ra",
                          variant: "destructive",
                        });
                      } finally {
                        setIsEditOpen(false);
                      }
                    }}
                  >
                    Lưu
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default AdminEditModal;
