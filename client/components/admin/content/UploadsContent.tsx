import React, { useRef, useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { uploadAdminVideo, uploadDirectToCloudinary, createSiteMediaApi, getSiteMediaApi, updateSiteMediaApi, deleteSiteMediaApi } from "@/lib/api/uploads";
import { useToast } from "@/hooks/use-toast";

export default function UploadsContent() {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [openConfirm, setOpenConfirm] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState("");
  const [pendingTargetId, setPendingTargetId] = useState<number | null>(null);
  const [uploads, setUploads] = useState<
    {
      id: string;
      file: File;
      name: string;
      size: number;
      type: string;
      section: "hero_section" | "technology_section1" | "technology_section2";
      isVideo: boolean;
      isImage: boolean;
      compressProgress?: number | null;
      uploadProgress: number;
      status: "pending" | "uploading" | "done" | "error";
      error?: string;
      targetId?: number;
    }[]
  >([]);
  const runningRef = useRef(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [section, setSection] = useState<"hero_section" | "technology_section1" | "technology_section2">("hero_section");
  const [statusLines, setStatusLines] = useState<string[]>([]);
  const [stage, setStage] = useState<"idle" | "compressing" | "uploading" | "done" | "error">("idle");
  const [openMediaModal, setOpenMediaModal] = useState(false);
  const [mediaItems, setMediaItems] = useState<any[]>([]);
  const [mediaLoadingId, setMediaLoadingId] = useState<number | null>(null);

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const arr = Array.from(e.target.files || []);
    setFiles(arr);
  };

  const isValidVideo = (f: File | null) =>
    !!f && /^video\//.test(f.type);

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
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return fi;
      ctx.drawImage(img, 0, 0, w, h);
      let quality = 0.82;
      let blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", quality));
      for (let i = 0; i < 3 && blob && blob.size > 10_000_000; i++) {
        quality = Math.max(0.5, quality - 0.12);
        blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", quality));
      }
      if (blob && blob.size < fi.size) {
        return new File([blob], fi.name.replace(/\.(png|jpg|jpeg|bmp|gif)$/i, ".webp"), { type: "image/webp" });
      }
      return fi;
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  // Effect to manage queue processing
  useEffect(() => {
    const maxConcurrent = 4;
    const activeCount = uploads.filter((u) => u.status === "uploading").length;

    // If we have slots and pending items
    if (activeCount < maxConcurrent) {
      const nextItem = uploads.find((u) => u.status === "pending");
      if (nextItem) {
        // Mark as uploading immediately to prevent double processing in next render
        setUploads((prev) =>
          prev.map((u) => (u.id === nextItem.id ? { ...u, status: "uploading" } : u))
        );

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
              setStatusLines((prev) => [...prev, `Đã nén ảnh [${nextItem.name}] (${formatSize(finalFile.size)} từ ${formatSize(nextItem.size)}), đang upload...`]);
            }

            setStage("uploading");

            const result = await (nextItem.isVideo
              ? uploadAdminVideo(finalFile, (p) =>
                setUploads((arr) => {
                  const cp = [...arr];
                  const i = cp.findIndex((x) => x.id === nextItem.id);
                  if (i !== -1) cp[i] = { ...cp[i], uploadProgress: p };
                  return cp;
                })
              )
              : uploadDirectToCloudinary(finalFile, (p) =>
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
                type: nextItem.isVideo ? "video" : "image",
                url: result.url,
                public_id: result.public_id,
                format: result.format,
                width: result.width,
                height: result.height,
                duration: result.duration,
                is_active: true,
              });
              setStatusLines((prev) => [...prev, `Đã cập nhật [${nextItem.name}] vào ${nextItem.section} (ID: ${nextItem.targetId})`]);
            } else {
              await createSiteMediaApi({
                section: nextItem.section,
                type: nextItem.isVideo ? "video" : "image",
                url: result.url,
                public_id: result.public_id,
                format: result.format,
                width: result.width,
                height: result.height,
                duration: result.duration,
                display_order: 0,
                is_active: true,
              });
              setStatusLines((prev) => [...prev, `Đã tạo mới [${nextItem.name}] vào ${nextItem.section}`]);
            }

            setUploads((arr) => {
              const cp = [...arr];
              const i = cp.findIndex((x) => x.id === nextItem.id);
              if (i !== -1) cp[i] = { ...cp[i], status: "done", uploadProgress: 100 };
              return cp;
            });
          } catch (err: any) {
            setUploads((arr) => {
              const cp = [...arr];
              const i = cp.findIndex((x) => x.id === nextItem.id);
              if (i !== -1) cp[i] = { ...cp[i], status: "error", error: err?.message || "Upload lỗi" };
              return cp;
            });
            setStage("error");
            setStatusLines((prev) => [...prev, `Upload thất bại [${nextItem.name}]: ${err?.message || "Có lỗi xảy ra"}`]);
          }
        })();
      }
    }
  }, [uploads]);

  const checkAndPrepareUpload = async () => {
    if (!files.length) return;
    setConfirmMessage("");
    setPendingTargetId(null);

    try {
      // Fetch existing items to check constraints
      const res = await getSiteMediaApi({ section });
      const items = res.items || [];

      if (section === "technology_section2") {
        if (items.length >= 6) {
          // Sort by display_order to find the 6th one
          const sorted = [...items].sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
          // Target the 6th item (index 5) or the last one if fewer than 6 but logic says >=6
          const target = sorted[5] || sorted[items.length - 1];

          if (target) {
            setPendingTargetId(target.id);
            setConfirmMessage(`Mục ${section} đã đạt giới hạn 6 video. Hành động này sẽ GHI ĐÈ lên video thứ 6 (ID: ${target.id}).`);
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
      setConfirmMessage(files.length === 1 && /^image\//.test(files[0].type)
        ? "Bạn có chắc muốn tải lên ảnh này?"
        : "Bạn có chắc muốn tải lên các tệp đã chọn?");
      setOpenConfirm(true);
    } catch (err) {
      console.error("Check failed", err);
      setConfirmMessage("Không thể kiểm tra dữ liệu cũ. Bạn có muốn tiếp tục tải lên?");
      setOpenConfirm(true);
    }
  };

  const startUpload = async () => {
    if (!files.length) return;
    setOpenConfirm(false);
    setStage("compressing");
    setStatusLines((prev) => [...prev, "Đã thêm vào hàng đợi..."]);
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
      status: "pending" as const,
      targetId: pendingTargetId || undefined,
    }));
    setUploads((arr) => [...arr, ...toAdd]);
    setFiles([]);
    setPendingTargetId(null); // Reset
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <Card className="bg-gradient-to-br from-[#0e1b3d] to-[#15325f] text-white border border-white/10">
      <CardHeader className="pb-4">
        <CardTitle className="text-2xl font-bold">Uploads</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Upload Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Upload Controls */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-300">Chọn video hoặc ảnh</Label>
              <div className="relative">
                <Input
                  ref={fileRef}
                  type="file"
                  accept="video/*,image/*"
                  multiple
                  onChange={onPickFile}
                  className="bg-white/5 border-white/20 text-white file:bg-blue-600 file:text-white file:border-0 file:rounded file:px-3 file:py-1 file:mr-3 file:cursor-pointer hover:file:bg-blue-700 h-11"
                />
              </div>
              {files.length === 1 && files[0] && !/^video\//.test(files[0].type) && !/^image\//.test(files[0].type) && (
                <div className="text-xs text-red-400">Tệp đã chọn không phải video/ảnh hợp lệ</div>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-300">Vị trí hiển thị</Label>
              <select
                className="w-full bg-[#1a2744] text-white border border-white/20 rounded-md px-3 py-2.5 h-11 focus:outline-none focus:ring-2 focus:ring-blue-500 [&>option]:bg-[#1a2744] [&>option]:text-white"
                value={section}
                onChange={(e) => setSection(e.target.value as any)}
              >
                <option value="hero_section">Hero Section</option>
                <option value="technology_section1">Technology Section 1 (banner)</option>
                <option value="technology_section2">Technology Section 2 (danh sách)</option>
              </select>
              <div className="text-xs text-gray-500">
                Chọn nơi sẽ hiển thị media sau khi upload
              </div>
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <Button
                disabled={!files.length}
                onClick={checkAndPrepareUpload}
                className="bg-blue-600 hover:bg-blue-700 h-10 px-5"
              >
                Upload
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setFiles([]);
                  if (fileRef.current) fileRef.current.value = "";
                  setPreviewUrl(null);
                  setStatusLines([]);
                  setStage("idle");
                }}
                className="bg-white/10 hover:bg-white/20 text-white border-white/20 h-10 px-5"
              >
                Reset
              </Button>
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    const { items } = await getSiteMediaApi({});
                    setMediaItems(items);
                    setOpenMediaModal(true);
                  } catch (err: any) {
                    toast({ title: "Lỗi tải danh sách", description: err?.message || "Không thể tải site media" });
                  }
                }}
                className="ml-auto text-white bg-white/10 hover:bg-white/20 border-white/20 h-10 px-5"
              >
                Xem media
              </Button>
            </div>
          </div>

          {/* Right Column - Preview */}
          <div className="space-y-3">
            {files.length === 1 && previewUrl ? (
              <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-4">
                <div className="aspect-video rounded-lg overflow-hidden bg-black/30 flex items-center justify-center">
                  {/^image\//.test(files[0].type) ? (
                    <img
                      src={previewUrl}
                      alt={files[0].name}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <video
                      src={previewUrl}
                      controls
                      className="w-full h-full object-contain"
                    />
                  )}
                </div>
                <div className="space-y-2">
                  <div className="text-sm font-medium text-white">Thông tin tệp</div>
                  <div className="grid grid-cols-[80px_1fr] gap-y-1 text-sm">
                    <span className="text-gray-400">Tên:</span>
                    <span className="text-white truncate">{files[0].name}</span>
                    <span className="text-gray-400">Loại:</span>
                    <span className="text-white">{files[0].type || "Không xác định"}</span>
                    <span className="text-gray-400">Dung lượng:</span>
                    <span className="text-white">{formatSize(files[0].size || 0)}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-white/20 bg-white/5 p-8 flex flex-col items-center justify-center min-h-[200px]">
                <div className="text-gray-500 text-sm text-center">
                  <div className="mb-2">📁</div>
                  <div>Chọn file để xem preview</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Progress Section */}
        {(!!uploads.length || !!statusLines.length) && (
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-4">
            {!!uploads.length && (
              <div className="space-y-4">
                <div className="text-sm font-medium text-white">Tiến trình upload</div>
                {uploads.map((u) => (
                  <div key={u.id} className="rounded-lg bg-white/5 p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-white font-medium truncate max-w-[60%]">{u.name}</div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-gray-400">{formatSize(u.size)}</span>
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          u.status === "done" ? "bg-green-500/20 text-green-400" :
                          u.status === "error" ? "bg-red-500/20 text-red-400" :
                          u.status === "uploading" ? "bg-blue-500/20 text-blue-400" :
                          "bg-gray-500/20 text-gray-400"
                        }`}>
                          {u.status === "done" ? "Hoàn thành" :
                           u.status === "error" ? "Lỗi" :
                           u.status === "uploading" ? "Đang upload" : "Chờ"}
                        </span>
                      </div>
                    </div>
                    {u.isImage && u.status !== "done" && (
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-400">Nén ảnh</span>
                          <span className="text-gray-300">{u.compressProgress || 0}%</span>
                        </div>
                        <Progress value={u.compressProgress || 0} className="h-1.5" />
                      </div>
                    )}
                    {u.status !== "done" && (
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-400">Upload</span>
                          <span className="text-gray-300">{u.uploadProgress}%</span>
                        </div>
                        <Progress value={u.uploadProgress} className="h-1.5" />
                      </div>
                    )}
                    {u.error && <div className="text-xs text-red-400">{u.error}</div>}
                  </div>
                ))}
              </div>
            )}
            {!!statusLines.length && (
              <div className="space-y-2">
                <div className="text-sm font-medium text-white">Log</div>
                <div className="rounded-lg bg-black/20 p-3 max-h-32 overflow-y-auto">
                  {statusLines.map((ln, idx) => (
                    <div key={idx} className="text-xs text-gray-400 py-0.5">{ln}</div>
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
                {confirmMessage || (files.length === 1 && /^image\//.test(files[0].type)
                  ? "Bạn có chắc muốn tải lên ảnh này?"
                  : "Bạn có chắc muốn tải lên các tệp đã chọn?")}
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

        <Dialog open={openMediaModal} onOpenChange={setOpenMediaModal}>
          <DialogContent className="bg-white text-black border-gray-200 max-w-4xl w-[95vw]">
            <DialogHeader>
              <DialogTitle>Thư viện Site Media</DialogTitle>
            </DialogHeader>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left">
                    <th className="p-2">ID</th>
                    <th className="p-2">Section</th>
                    <th className="p-2">Type</th>
                    <th className="p-2">URL</th>
                    <th className="p-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {mediaItems.map((m) => (
                    <tr key={m.id} className="border-t border-gray-200">
                      <td className="p-2">{m.id}</td>
                      <td className="p-2">{m.section}</td>
                      <td className="p-2">{m.type}</td>
                      <td className="p-2">
                        <div className="max-w-[300px] truncate" title={m.url}>
                          {m.url}
                        </div>
                      </td>
                      <td className="p-2">
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={mediaLoadingId === m.id}
                          onClick={async () => {
                            const ok = window.confirm("Bạn có chắc chắn muốn xóa media này?");
                            if (!ok) return;
                            try {
                              setMediaLoadingId(m.id);
                              const r = await deleteSiteMediaApi(Number(m.id));
                              if (r.ok) {
                                toast({ title: "Đã xóa thành công", description: `Media #${m.id}` });
                                const { items } = await getSiteMediaApi({});
                                setMediaItems(items);
                              } else {
                                throw new Error("Xóa thất bại");
                              }
                            } catch (err: any) {
                              toast({ title: "Xóa thất bại", description: err?.message || "Không thể xóa media", variant: "destructive" });
                            } finally {
                              setMediaLoadingId(null);
                            }
                          }}
                        >
                          {mediaLoadingId === m.id ? "Đang xóa..." : "Xóa"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {mediaItems.length === 0 && (
                    <tr>
                      <td className="p-4 text-center text-gray-500" colSpan={6}>Chưa có media</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
