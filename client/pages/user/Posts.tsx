import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import UserLayout from '@/user/layouts/UserLayout';
import { getPublicPosts } from '@/lib/api/posts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CalendarDays, Eye, Search } from 'lucide-react';

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

  return (
    <UserLayout className="bg-gradient-dark">
      <main className="pt-20 mt-10 md:pt-24 pb-12 md:pb-16">
        <section className="container mx-auto px-4 md:px-6 lg:px-8">
          <div className="rounded-2xl md:rounded-3xl neon-border glass-tile neon-noise bg-white/5 p-5 md:p-10">
            <p className="text-cyan-300 text-xs font-black uppercase tracking-[0.25em]">Cinesphere Blog</p>
            <h1 className="mt-3 text-2xl sm:text-3xl md:text-5xl font-black text-white leading-tight">Bài viết & Góc điện ảnh</h1>
            <p className="mt-3 md:mt-4 text-sm md:text-base text-slate-300 max-w-2xl">
              Cập nhật tin tức phim, xu hướng công nghệ chiếu rạp và các bài viết chuyên sâu từ đội ngũ Cinesphere.
            </p>
            <div className="mt-6 relative max-w-xl">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Tìm tiêu đề hoặc nội dung tóm tắt..."
                className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-slate-300 h-11 rounded-xl"
              />
            </div>
          </div>
        </section>

        <section className="container mx-auto px-4 md:px-6 lg:px-8 mt-8">
          {loading ? (
            <div className="text-slate-300">Đang tải bài viết...</div>
          ) : sortedItems.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-slate-300">Chưa có bài viết phù hợp.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {sortedItems.map((post) => (
                <article
                  key={post.id}
                  className="group rounded-2xl neon-border bg-white/5 hover:bg-white/[0.1] transition-all duration-300 overflow-hidden"
                >
                  <Link to={`/posts/${post.id}`} className="block">
                    <div className="aspect-[16/9] bg-[#0b1327] overflow-hidden">
                      {post.featured_image ? (
                        <img
                          src={post.featured_image}
                          alt={post.title}
                          className="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-500"
                        />
                      ) : null}
                    </div>
                    <div className="p-5">
                      {post.is_featured ? (
                        <span className="inline-flex mb-2 items-center rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider">
                          Nổi bật
                        </span>
                      ) : null}
                      <h3 className="text-white font-extrabold text-lg line-clamp-2">{post.title}</h3>
                      <p className="mt-2 text-slate-300 text-sm line-clamp-3">{post.excerpt?.trim() || 'Bài viết không có tóm tắt.'}</p>
                      <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
                        <div className="flex items-center gap-3">
                          <span className="inline-flex items-center gap-1.5">
                            <CalendarDays className="w-3.5 h-3.5" />
                            {new Date(post.published_at || post.created_at || Date.now()).toLocaleDateString('vi-VN')}
                          </span>
                          {(post.view_count ?? 0) > 0 && (
                            <span className="inline-flex items-center gap-1">
                              <Eye className="w-3.5 h-3.5" />
                              {(post.view_count ?? 0).toLocaleString('vi-VN')}
                            </span>
                          )}
                        </div>
                        <Button variant="ghost" className="text-cyan-300 hover:text-cyan-200 hover:bg-transparent p-0 h-auto">
                          Xem chi tiết
                        </Button>
                      </div>
                    </div>
                  </Link>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </UserLayout>
  );
}
