import React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

interface MovieData { id: string; title: string; year: number; duration: string; genres: string[]; posterUrl: string; release_date: string | null; rating: number | null; price: number }
interface Props { data: MovieData[]; totalPages: number; currentPage: number; setPage: (p: number) => void; movieStatus: Record<string, "active" | "inactive">; onEdit: (type: "movie", data: any) => void; onCreate: () => void; moviesLength: number; formatLocalDateTime: (date: Date) => React.ReactNode }

export default function MoviesContent({ data, totalPages, currentPage, setPage, movieStatus, onEdit, onCreate, moviesLength, formatLocalDateTime }: Props) {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center"><h3 className="text-lg font-semibold">Tổng cộng: {moviesLength} phim</h3><Button onClick={onCreate}>+ Thêm phim mới</Button></div>
      <Card><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead>ID</TableHead><TableHead>Tên phim</TableHead><TableHead>Thể loại</TableHead><TableHead>Thời lượng</TableHead><TableHead>Giá vé TB</TableHead><TableHead>Rating</TableHead><TableHead>Ngày ra mắt</TableHead><TableHead>Trạng thái</TableHead><TableHead className="text-right">Hành động</TableHead></TableRow></TableHeader><TableBody>{data.map((movie) => (<TableRow key={movie.id}><TableCell className="font-medium w-16">{movie.id}</TableCell><TableCell className="flex items-center space-x-3">{movie.posterUrl && (<img src={movie.posterUrl} alt={movie.title} className="w-20 h-15 object-cover rounded shadow-md" loading="lazy" />)}<span className="font-medium">{movie.title}</span></TableCell><TableCell>{movie.genres.join(", ")}</TableCell><TableCell>{movie.duration}</TableCell><TableCell>{movie.price.toLocaleString('en-US')}</TableCell><TableCell>{movie.rating ?? ""}</TableCell><TableCell>{movie.release_date ? formatLocalDateTime(new Date(movie.release_date)) : "N/A"}</TableCell><TableCell><Badge variant={movieStatus[movie.id] === "active" ? "default" : "secondary"}>{movieStatus[movie.id] === "active" ? "Đang chiếu" : "Đã ẩn"}</Badge></TableCell><TableCell className="text-right"><Button variant="outline" size="sm" onClick={() => onEdit("movie", { ...movie, status: movieStatus[movie.id] || "active" })}>Sửa</Button></TableCell></TableRow>))}</TableBody></Table></CardContent></Card>
      <div className="flex gap-2"><Button variant="outline" onClick={() => setPage(Math.max(1, currentPage - 1))} disabled={currentPage === 1}>Trước</Button><div className="px-2">Trang {currentPage}/{totalPages}</div><Button variant="outline" onClick={() => setPage(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages}>Sau</Button></div>
    </div>
  )
}

