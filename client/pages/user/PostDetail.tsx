import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import UserLayout from '@/user/layouts/UserLayout';
import { getPostById, getPublicPosts } from '@/lib/api/posts';
import { ArrowLeft, Link2, Share2, Clock3, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

type PostDetail = {
  id: number;
  title: string;
  content: string;
  excerpt?: string;
  featured_image?: string;
  status: string;
  published_at?: string;
  created_at?: string;
  view_count?: number;
  alt?: string;
};

type RecentViewedPost = {
  id: number;
  title: string;
  viewed_at: string;
};

function timeAgo(dateInput?: string) {
  if (!dateInput) return '';
  const t = new Date(dateInput).getTime();
  if (Number.isNaN(t)) return '';
  const diffSec = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (diffSec < 60) return 'Vừa xong';
  const mins = Math.floor(diffSec / 60);
  if (mins < 60) return `${mins} phút trước`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} ngày trước`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} tháng trước`;
  const years = Math.floor(months / 12);
  return `${years} năm trước`;
}

export default function UserPostDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState<PostDetail | null>(null);
  const [relatedPosts, setRelatedPosts] = useState<PostDetail[]>([]);
  const [recentPosts, setRecentPosts] = useState<RecentViewedPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const processed = useMemo(() => {
    const raw = post?.content || '';
    // Wrap <img> tags that have a non-empty alt into <figure> + <figcaption>
    const html = raw.replace(
      /<img([^>]*)\salt="([^"]+)"([^>]*)>/gi,
      (_, before, alt, after) =>
        `<figure class="image"><img${before} alt="${alt}"${after}><figcaption>${alt}</figcaption></figure>`
    );
    return { html };
  }, [post?.content]);

  useEffect(() => {
    const run = async () => {
      if (!id) return;
      setLoading(true);
      try {
        const res = await getPostById(Number(id));
        const p = res?.post as PostDetail;
        // Public detail chỉ hiển thị bài published
        if (!p || p.status !== 'published') {
          setPost(null);
          return;
        }
        setPost(p);
      } catch {
        setPost(null);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [id]);

  useEffect(() => {
    const runRelated = async () => {
      if (!post?.id) return;
      try {
        const res = await getPublicPosts({ page: 1, pageSize: 12 });
        const list = (res.items || []) as PostDetail[];
        setRelatedPosts(list.filter((p) => p.status === 'published' && p.id !== post.id).slice(0, 3));
      } catch {
        setRelatedPosts([]);
      }
    };
    runRelated();
  }, [post?.id]);

  useEffect(() => {
    if (!post) return;
    try {
      const key = 'recent_viewed_post_titles';
      const raw = localStorage.getItem(key);
      const list = raw ? (JSON.parse(raw) as RecentViewedPost[]) : [];
      const nextItem: RecentViewedPost = {
        id: post.id,
        title: post.title,
        viewed_at: new Date().toISOString()
      };
      const next = [nextItem, ...list.filter((x) => x.id !== post.id)].slice(0, 10);
      localStorage.setItem(key, JSON.stringify(next));
      setRecentPosts(next.filter((x) => x.id !== post.id).slice(0, 10));
    } catch {
      setRecentPosts([]);
    }
  }, [post]);

  useEffect(() => {
    const previousTitle = document.title;
    const title = post?.title?.trim() ? `${post.title} | Cinesphere` : 'Bài viết | Cinesphere';
    document.title = title;

    const descriptionContent = post?.excerpt?.trim() || 'Bài viết điện ảnh và công nghệ từ Cinesphere.';
    let meta = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
    const created = !meta;
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'description');
      document.head.appendChild(meta);
    }
    const prevDesc = meta.getAttribute('content') || '';
    meta.setAttribute('content', descriptionContent);

    return () => {
      document.title = previousTitle;
      if (meta) {
        if (created) meta.remove();
        else meta.setAttribute('content', prevDesc);
      }
    };
  }, [post?.title, post?.excerpt]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
      toast.success('Đã sao chép liên kết bài viết');
    } catch {
      toast.error('Không thể sao chép liên kết');
    }
  };

  return (
    <UserLayout className="bg-gradient-dark">
      <main className="pb-16">
        {/* Back button */}
        <div className="container mx-auto px-4 md:px-6 lg:px-8 pt-20 md:pt-24">
          <Button
            variant="ghost"
            className="text-slate-300 hover:text-white hover:bg-white/10 bg-transparent focus-visible:ring-cyan-300/40"
            onClick={() => navigate('/posts')}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Quay lại danh sách bài viết
          </Button>
        </div>

        {loading ? (
          <div className="container mx-auto px-4 md:px-6 lg:px-8 mt-8 text-slate-300">Đang tải bài viết...</div>
        ) : !post ? (
          <div className="container mx-auto px-4 md:px-6 lg:px-8 mt-8">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-slate-300">
              Bài viết không tồn tại hoặc chưa được xuất bản.{' '}
              <Link to="/posts" className="text-cyan-300 underline">
                Về danh sách bài viết
              </Link>
              .
            </div>
          </div>
        ) : (
          <>
            {/* ── Hero Banner ── */}
            <section className="relative mt-4 w-full overflow-hidden" style={{ minHeight: '520px' }}>
              {/* Background image */}
              {post.featured_image ? (
                <img
                  src={post.featured_image}
                  alt={post.title}
                  className="absolute inset-0 w-full h-full object-cover object-center"
                />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-b from-slate-800 to-slate-950" />
              )}

              {/* Gradient overlays */}
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-black/20" />
              <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-transparent" />

              {/* Banner content */}
              <div className="relative z-10 container mx-auto px-4 md:px-6 lg:px-8 flex flex-col justify-end h-full" style={{ minHeight: '520px', paddingBottom: '3rem' }}>
                {/* Category + date badge */}
                <div className="flex items-center gap-3 mb-4">
                  <span className="bg-yellow-400 text-black text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-sm">
                    Bài Viết
                  </span>
                  <span className="text-slate-300 text-xs uppercase tracking-widest font-semibold">
                    {new Date(post.published_at || post.created_at || Date.now()).toLocaleDateString('vi-VN', {
                      month: 'long',
                      year: 'numeric'
                    })}
                  </span>
                </div>

                {/* Title */}
                <h1 className="text-white font-black leading-[1.05] tracking-tight text-4xl sm:text-5xl md:text-6xl lg:text-7xl max-w-5xl">
                  {post.title}
                </h1>

                {/* Excerpt */}
                {post.excerpt?.trim() && (
                  <p className="mt-5 text-slate-300 italic text-base md:text-lg max-w-3xl leading-relaxed">
                    "{post.excerpt.trim()}"
                  </p>
                )}

                {/* View count */}
                {(post.view_count ?? 0) > 0 && (
                  <div className="mt-4 inline-flex items-center gap-1.5 text-slate-400 text-xs">
                    <Eye className="w-3.5 h-3.5" />
                    {(post.view_count ?? 0).toLocaleString('vi-VN')} lượt xem
                  </div>
                )}
              </div>
            </section>

            {/* ── Article + Sidebar ── */}
            <div className="container mx-auto px-4 md:px-6 lg:px-8 mt-10">
              <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">

                {/* Article body */}
                <article className="lg:col-span-8">
                  <div className="rounded-2xl md:rounded-3xl neon-border bg-white/5 p-6 md:p-10">
                    <div
                      className="leading-7 text-slate-200 [&_h1]:text-white [&_h1]:font-black [&_h1]:text-3xl [&_h1]:mt-8 [&_h2]:text-white [&_h2]:font-extrabold [&_h2]:text-2xl [&_h2]:mt-8 [&_h3]:text-white [&_h3]:font-bold [&_h3]:text-xl [&_h3]:mt-6 [&_p]:text-slate-200 [&_p]:mb-4 [&_strong]:text-white [&_a]:text-cyan-300 [&_a]:underline [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:my-4 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:my-4 [&_li]:text-slate-200 [&_li]:mb-1 [&_img]:rounded-xl [&_img]:my-6 [&_img]:w-full [&_blockquote]:border-l-4 [&_blockquote]:border-cyan-400 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-slate-300 [&_blockquote]:my-4 [&_figure]:my-6 [&_figure]:text-center [&_figure_img]:rounded-xl [&_figure_img]:w-full [&_figure_img]:my-0 [&_figcaption]:mt-2 [&_figcaption]:text-xs [&_figcaption]:text-slate-400 [&_figcaption]:italic"
                      dangerouslySetInnerHTML={{ __html: processed.html || '' }}
                    />
                  </div>
                </article>

                {/* Sidebar */}
                <aside className="lg:col-span-4 space-y-4 xl:sticky xl:top-24 h-fit">
                  {/* Share */}
                  <div className="rounded-2xl neon-border bg-white/5 p-4 md:p-5">
                    <p className="text-cyan-300 text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2">
                      <Share2 className="w-3.5 h-3.5" /> Chia sẻ
                    </p>
                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full border-cyan-300/40 bg-transparent text-cyan-300 hover:bg-cyan-400/10 hover:text-cyan-200"
                        onClick={copyLink}
                      >
                        <Link2 className="w-3.5 h-3.5 mr-1.5" />
                        {copied ? 'Đã copy' : 'Copy link'}
                      </Button>
                      <a
                        href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center rounded-md border border-white/20 px-3 text-sm text-white hover:bg-white/10 h-9 w-full"
                      >
                        Facebook
                      </a>
                    </div>
                  </div>

                  {/* Recently viewed */}
                  <div className="rounded-2xl neon-border bg-white/5 p-4 md:p-5">
                    <p className="text-cyan-300 text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2">
                      <Clock3 className="w-3.5 h-3.5" /> Đã xem gần đây
                    </p>
                    {recentPosts.length === 0 ? (
                      <p className="text-slate-400 text-sm mt-3">Bạn chưa có lịch sử xem bài viết gần đây.</p>
                    ) : (
                      <div className="mt-3 space-y-3">
                        {recentPosts.map((item) => (
                          <Link key={item.id} to={`/posts/${item.id}`} className="block group">
                            <p className="text-slate-200 text-sm group-hover:text-cyan-300 transition-colors line-clamp-2">{item.title}</p>
                            <p className="text-slate-500 text-xs mt-1">{timeAgo(item.viewed_at)}</p>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                </aside>
              </div>
            </div>

            {/* ── Related Posts ── */}
            {relatedPosts.length > 0 && (
              <section className="container mx-auto px-4 md:px-6 lg:px-8 mt-12">
                <div className="max-w-6xl mx-auto">
                  <h3 className="text-white text-2xl font-black">Bài viết liên quan</h3>
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                    {relatedPosts.map((item) => (
                      <Link
                        key={item.id}
                        to={`/posts/${item.id}`}
                        className="rounded-2xl neon-border bg-white/5 hover:bg-white/[0.1] transition-colors p-4"
                      >
                        {item.featured_image && (
                          <img
                            src={item.featured_image}
                            alt={item.title}
                            className="w-full h-36 object-cover rounded-xl mb-3"
                          />
                        )}
                        <p className="text-white font-bold line-clamp-2">{item.title}</p>
                        <p className="text-slate-400 text-xs mt-2">
                          {new Date(item.published_at || item.created_at || Date.now()).toLocaleDateString('vi-VN')}
                        </p>
                      </Link>
                    ))}

                  </div>
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </UserLayout>
  );
}
