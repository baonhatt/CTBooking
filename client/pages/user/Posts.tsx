import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import UserLayout from '@/user/layouts/UserLayout';
import { getPublicPosts } from '@/lib/api/posts';
import { Input } from '@/components/ui/input';
import { Eye, Search, ArrowRight, ArrowUpRight } from 'lucide-react';
import { Helmet } from 'react-helmet-async';

type PostItem = {
  id: number;
  title: string;
  slug?: string;
  excerpt?: string;
  featured_image?: string;
  status: string;
  is_featured?: boolean;
  published_at?: string;
  created_at?: string;
  view_count?: number;
};

const formatDate = (dateString?: string) => {
  const d = new Date(dateString || Date.now());
  return `${d.getDate()} Tháng ${d.getMonth() + 1}, ${d.getFullYear()}`;
};

export default function UserPostsPage() {
  const [items, setItems] = useState<PostItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      try {
        const res = await getPublicPosts({ page: 1, pageSize: 50 });
        setItems((res.items || []).filter((p: PostItem) => p.status === 'published'));
      } finally {
        setLoading(false);
      }
    };
    run();
  }, []);

  const filtered = useMemo(() => {
    if (!q.trim()) return items;
    const key = q.toLowerCase();
    return items.filter((p) => (p.title || '').toLowerCase().includes(key) || (p.excerpt || '').toLowerCase().includes(key));
  }, [items, q]);

  const sortedItems = useMemo(
    () =>
      [...filtered].sort((a, b) => {
        const fa = a.is_featured ? 1 : 0;
        const fb = b.is_featured ? 1 : 0;
        if (fa !== fb) return fb - fa;
        return new Date(b.published_at || b.created_at || 0).getTime() - new Date(a.published_at || a.created_at || 0).getTime();
      }),
    [filtered]
  );

  const featuredItems = sortedItems.slice(0, 3);
  const otherPosts = sortedItems.slice(3);

  return (
    <UserLayout className="bg-[#0A192F]">
      <Helmet>
        <title>Bài Viết Nổi Bật | Cinesphere Blog</title>
        <meta name="description" content="Cập nhật tin tức phim ảnh, review đánh giá các siêu phẩm phòng vé và xu hướng công nghệ chiếu rạp mới nhất tại Cinesphere." />
        <meta property="og:title" content="Bài Viết Nổi Bật | Cinesphere Blog" />
        <meta property="og:description" content="Khám phá các tin tức điện ảnh độc quyền và review khách quan từ đội ngũ chuyên gia Cinesphere." />
        <meta property="og:type" content="website" />
      </Helmet>
      <main className="pt-20 md:pt-28 pb-12 md:pb-24 bg-[#0A192F] min-h-screen font-sans">

        {/* Header Section */}
        <section className="container my-6 mx-auto px-4 md:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between border-b border-white/10 pb-6 mb-10 relative">
            <div>
              <p className="text-[#7BB1FF] text-xs md:text-sm font-bold uppercase tracking-[0.15em] mb-2 lg:mb-3">
                Cinesphere Editorial
              </p>
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-white tracking-tight">
                Bài Viết Nổi Bật
              </h1>
            </div>

            <div className="mt-6 lg:mt-0 flex flex-col sm:flex-row items-stretch sm:items-center gap-4 lg:gap-8">
              <div className="relative w-full sm:w-64 lg:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Tìm tiêu đề bài viết..."
                  className="pl-10 bg-[#0A192F] border-white/20 text-white placeholder:text-slate-400 h-11 rounded-lg focus-visible:ring-[#00D2FF]"
                />
              </div>

            </div>
          </div>

          {/* Featured Grid */}
          {loading ? (
            <div className="text-slate-400 text-center py-20 animate-pulse">Đang tải bài viết...</div>
          ) : sortedItems.length === 0 ? (
            <div className="text-slate-400 text-center py-20 border border-white/10 rounded-2xl bg-white/5">
              Chưa có bài viết phù hợp.
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 xl:gap-8">

              {/* Left Large Post */}
              {featuredItems[0] && (
                <div className="xl:col-span-2 group block cursor-pointer">
                  <Link to={`/posts/${featuredItems[0].slug || featuredItems[0].id}`}>
                    <div className="relative aspect-[16/9] lg:aspect-[2/1] rounded-[1.25rem] overflow-hidden mb-6">
                      <img
                        src={featuredItems[0].featured_image || 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=1200'}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-in-out"
                        alt={featuredItems[0].title}
                      />
                      {featuredItems[0].is_featured && (
                        <div className="absolute top-4 left-4 bg-[#00D2FF] text-[#0A192F] text-[11px] sm:text-xs font-bold px-3 py-1.5 rounded uppercase tracking-wider shadow-lg shadow-cyan-500/20">
                          Nổi bật
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs sm:text-sm text-slate-400 mb-3">
                      <span className="text-[#00D2FF] font-semibold">Cinesphere News</span>
                      <span>•</span>
                      <span>{formatDate(featuredItems[0].published_at || featuredItems[0].created_at)}</span>
                    </div>
                    <h2 className="text-white text-2xl sm:text-3xl lg:text-4xl font-bold leading-tight mb-4 group-hover:text-[#7BB1FF] transition-colors duration-300">
                      {featuredItems[0].title}
                    </h2>
                    <p className="text-slate-300 line-clamp-2 md:line-clamp-3 mb-5 text-sm sm:text-base pr-4">
                      {featuredItems[0].excerpt || 'Bài viết không có tóm tắt chi tiết. Nhấp vào để đọc nội dung toàn diện và phân tích chuyên sâu từ đội ngũ.'}
                    </p>
                    <span className="text-[#00D2FF] font-semibold text-sm flex items-center gap-2 group-hover:underline w-fit transition-all group-hover:gap-3">
                      Xem chi tiết <ArrowUpRight className="w-4 h-4" />
                    </span>
                  </Link>
                </div>
              )}

              {/* Right Stacked Posts */}
              <div className="xl:col-span-1 flex flex-col gap-8 xl:gap-8 justify-between">
                {featuredItems.slice(1, 3).map(post => (
                  <div key={post.id} className="group block flex-1">
                    <Link to={`/posts/${post.slug || post.id}`} className="flex flex-col h-full">
                      <div className="relative aspect-[16/9] xl:aspect-[4/3] 2xl:aspect-[16/9] rounded-2xl overflow-hidden mb-4">
                        <img
                          src={post.featured_image || 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?q=80&w=800'}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-in-out"
                          alt={post.title}
                        />
                        {post.is_featured && (
                          <div className="absolute top-3 left-3 bg-[#00D2FF] text-[#0A192F] text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider">
                            Nổi bật
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-400 mb-2">
                        <span className="text-[#00D2FF] font-semibold">Tin Tức</span>
                        <span>•</span>
                        <span>{formatDate(post.published_at || post.created_at)}</span>
                      </div>
                      <h3 className="text-white text-lg sm:text-xl font-bold leading-snug mb-3 group-hover:text-[#7BB1FF] transition-colors duration-300 line-clamp-2 pr-2">
                        {post.title}
                      </h3>
                      <p className="text-slate-400 text-sm line-clamp-2">
                        {post.excerpt || 'Cập nhật diễn biến mới nhất tại hệ thống rạp Cinesphere và xu hướng làm phim hiện đại.'}
                      </p>
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Other Posts */}
        {otherPosts.length > 0 && (
          <section className="container mx-auto px-4 md:px-6 lg:px-8 mt-16 md:mt-24 pt-10 border-t border-white/10">
            <div className="mb-10">
              <h2 className="text-white text-2xl md:text-3xl font-bold tracking-tight">Góc Điện Ảnh Mới</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 lg:gap-8">
              {otherPosts.map(post => (
                <article key={post.id} className="group block">
                  <Link to={`/posts/${post.slug || post.id}`} className="block flex flex-col h-full">
                    <div className="relative aspect-[16/10] rounded-[1rem] overflow-hidden mb-4 shadow-sm">
                      <img
                        src={post.featured_image || 'https://images.unsplash.com/photo-1542204165-65bf26472b9b?q=80&w=800'}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-in-out"
                        alt={post.title}
                      />
                      {post.is_featured && (
                        <div className="absolute top-2 left-2 bg-[#00D2FF] text-[#0A192F] text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm uppercase tracking-wider">
                          Nổi bật
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-slate-400 mb-2">
                      <span className="text-[#7BB1FF] font-medium">Review</span>
                      <span>•</span>
                      <span>{formatDate(post.published_at || post.created_at)}</span>
                    </div>
                    <h3 className="text-white text-base md:text-lg font-bold leading-snug mb-2 group-hover:text-[#00D2FF] transition-colors duration-300 line-clamp-2">
                      {post.title}
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-slate-500 mt-auto pt-2">
                      {(post.view_count ?? 0) > 0 && (
                        <span className="inline-flex items-center gap-1.5">
                          <Eye className="w-3.5 h-3.5" />
                          {(post.view_count ?? 0).toLocaleString('vi-VN')} lượt xem
                        </span>
                      )}
                    </div>
                  </Link>
                </article>
              ))}
            </div>
          </section>
        )}
      </main>
    </UserLayout>
  );
}
