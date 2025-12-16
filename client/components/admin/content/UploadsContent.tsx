import React, { useRef, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { uploadAdminVideo, uploadDirectToCloudinary, createSiteMediaApi } from "@/lib/api/uploads";
 
export default function UploadsContent() {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [openConfirm, setOpenConfirm] = useState(false);
  const [compressProgressList, setCompressProgressList] = useState<number[]>([]);
  const [uploadProgressList, setUploadProgressList] = useState<number[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [section, setSection] = useState<"hero_section" | "technology_section1" | "technology_section2">("hero_section");
  const [statusLines, setStatusLines] = useState<string[]>([]);
  const [stage, setStage] = useState<"idle" | "compressing" | "uploading" | "done" | "error">("idle");
 
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
 
  const startUpload = async () => {
    if (!files.length) return;
    setOpenConfirm(false);
    setIsUploading(true);
    setStage("compressing");
    const initCompress = Array(files.length).fill(0);
    const initUpload = Array(files.length).fill(0);
    setCompressProgressList(initCompress);
    setUploadProgressList(initUpload);
    setStatusLines((prev) => [...prev, "Bắt đầu tải lên nhiều tệp..."]);
    try {
      const tasks = files.map(async (f, idx) => {
        const isVid = /^video\//.test(f.type);
        const isImg = /^image\//.test(f.type);
        if (!isVid && !isImg) throw new Error("Sai định dạng: chỉ chấp nhận video hoặc ảnh");
        let uploadFile = f;
        if (isVid) {
          setCompressProgressList((arr) => {
            const next = [...arr]; next[idx] = 100; return next;
          });
          setStatusLines((prev) => [...prev, `Bỏ qua nén video [${f.name}], đang upload trực tiếp...`]);
        } else if (isImg && f.size > 10_000_000) {
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
          uploadFile = await compressImage(f);
          setCompressProgressList((arr) => {
            const next = [...arr]; next[idx] = 100; return next;
          });
          setStatusLines((prev) => [...prev, `Đã nén ảnh [${f.name}] (${formatSize(uploadFile.size)} từ ${formatSize(f.size)}), đang upload...`]);
        } else {
          setCompressProgressList((arr) => {
            const next = [...arr]; next[idx] = 100; return next;
          });
        }
        setStage("uploading");
        const result = await (isVid
          ? uploadAdminVideo(uploadFile, (p) =>
              setUploadProgressList((arr) => { const next = [...arr]; next[idx] = p; return next; })
            )
          : uploadDirectToCloudinary(uploadFile, (p) =>
              setUploadProgressList((arr) => { const next = [...arr]; next[idx] = p; return next; })
            ));
        await createSiteMediaApi({
          section,
          type: isVid ? "video" : "image",
          url: result.url,
          public_id: result.public_id,
          format: result.format,
          width: result.width,
          height: result.height,
          duration: result.duration,
          display_order: 0,
          is_active: true,
        });
        setStatusLines((prev) => [...prev, `Đã upload [${f.name}] lên ${section} xong`]);
      });
      await Promise.all(tasks);
      setStage("done");
      setFiles([]);
      if (fileRef.current) fileRef.current.value = "";
    } catch (err: any) {
      setStage("error");
      setStatusLines((prev) => [...prev, `Upload thất bại: ${err?.message || "Có lỗi xảy ra"}`]);
    } finally {
      setIsUploading(false);
    }
  };
 
  return (
    <Card className="bg-gradient-to-br from-[#0e1b3d] to-[#15325f] text-white border border-white/10">
      <CardHeader>
        <CardTitle>Uploads</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Chọn video hoặc ảnh</Label>
          <Input
            ref={fileRef}
            type="file"
            accept="video/*,image/*"
            multiple
            onChange={onPickFile}
          />
          {files.length === 1 && files[0] && !/^video\//.test(files[0].type) && !/^image\//.test(files[0].type) && (
            <div className="text-xs text-red-300">Tệp đã chọn không phải video/ảnh hợp lệ</div>
          )}
        </div>
 
        <div className="flex gap-2">
          <Button
            disabled={!files.length || isUploading}
            onClick={() => setOpenConfirm(true)}
          >
            Upload
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              setFiles([]);
              if (fileRef.current) fileRef.current.value = "";
              setPreviewUrl(null);
              setCompressProgressList([]);
              setUploadProgressList([]);
              setStatusLines([]);
              setStage("idle");
            }}
          >
            Reset
          </Button>
        </div>
 
        <div className="space-y-2">
          <Label>Vị trí hiển thị</Label>
          <select
            className="w-full bg-[#0e1b3d] text-white border border-white/10 rounded-md px-3 py-2"
            value={section}
            onChange={(e) => setSection(e.target.value as any)}
            disabled={isUploading}
          >
            <option value="hero_section">Hero Section</option>
            <option value="technology_section1">Technology Section 1 (banner)</option>
            <option value="technology_section2">Technology Section 2 (danh sách)</option>
          </select>
          <div className="text-xs text-white/60">
            Chọn nơi sẽ hiển thị media sau khi upload
          </div>
        </div>
 
        {files.length === 1 && previewUrl && (
          <div className="mt-4 grid md:grid-cols-3 gap-4 items-start">
            <div className="md:col-span-2">
              {/^image\//.test(files[0].type) ? (
                <img
                  src={previewUrl}
                  alt={files[0].name}
                  className="w-full max-h-80 object-contain rounded-md border border-white/10 bg-black/20"
                />
              ) : (
                <video
                  src={previewUrl}
                  controls
                  className="w-full max-h-80 rounded-md border border-white/10 bg-black/20"
                />
              )}
            </div>
            <div className="space-y-2 text-sm text-white/80">
              <div className="font-medium text-white">Thông tin tệp</div>
              <div>Tên: {files[0].name}</div>
              <div>Loại: {files[0].type || "N/A"}</div>
              <div>Dung lượng: {formatSize(files[0].size || 0)}</div>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {!!files.length && (
            <div className="space-y-3">
              <Label>Tiến trình</Label>
              {files.map((f, idx) => (
                <div key={idx} className="space-y-2">
                  <div className="text-xs text-white/80">{f.name} • {formatSize(f.size)} • {/^video\//.test(f.type) ? "Video" : /^image\//.test(f.type) ? "Image" : "Unknown"}</div>
                  <div className="space-y-1">
                    <div className="text-xs text-white/60">Nén</div>
                    <Progress value={compressProgressList[idx] || 0} />
                    <div className="text-xs text-white/70">{compressProgressList[idx] || 0}%</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs text-white/60">Upload</div>
                    <Progress value={uploadProgressList[idx] || 0} />
                    <div className="text-xs text-white/70">{uploadProgressList[idx] || 0}%</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {!!statusLines.length && (
            <div className="text-sm text-white/80 space-y-1">
              {statusLines.map((ln, idx) => (
                <div key={idx}>{ln}</div>
              ))}
            </div>
          )}
        </div>
 
        <Dialog open={openConfirm} onOpenChange={setOpenConfirm}>
          <DialogContent className="bg-[#0e1b3d] text-white border border-white/10">
            <DialogHeader>
              <DialogTitle>Xác nhận tải lên</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="text-sm text-white/80">
                {files.length === 1 && /^image\//.test(files[0].type)
                  ? "Bạn có chắc muốn tải lên ảnh này?"
                  : "Bạn có chắc muốn tải lên các tệp đã chọn?"}
              </div>
              <div className="flex gap-2">
                <Button onClick={startUpload} disabled={isUploading}>Xác nhận</Button>
                <Button variant="secondary" onClick={() => setOpenConfirm(false)} disabled={isUploading}>
                  Hủy
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
