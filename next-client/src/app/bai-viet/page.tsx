import type { Metadata } from 'next';
export const runtime = 'edge';
import Link from 'next/link';
import { getPublicPosts, type PostItem } from '@/lib/api/posts';
import { buildPostHref, formatDate } from '@/lib/utils';
import UserLayout from '@/layouts/UserLayout';
import PostsSearchClient from '@/app/bai-viet/PostsSearchClient';

import { siteConfig } from '@/config/site';

const SITE_URL = siteConfig.domain;

export const metadata: Metadata = {
        title: 'Tin Tức Điện Ảnh | Cinesphere Blog',
        description:
                'Cập nhật tin tức phim ảnh, review đánh giá các siêu phẩm phòng vé và xu hướng công nghệ chiếu rạp mới nhất tại Cinesphere.',
        alternates: { canonical: `${SITE_URL}/bai-viet` },
        openGraph: {
                title: 'Tin Tức Điện Ảnh | Cinesphere Blog',
                description: 'Khám phá các tin tức điện ảnh độc quyền và review khách quan từ đội ngũ chuyên gia Cinesphere.',
                type: 'website',
                url: `${SITE_URL}/bai-viet`,
                locale: 'vi_VN',
                siteName: 'Cinesphere',
                images: [
                        {
                                url: '/og-default.jpg',
                                width: 1200,
                                height: 630,
                                alt: 'Cinesphere Blog - Tin Tức Điện Ảnh'
                        }
                ]
        },
        twitter: {
                card: 'summary_large_image',
                title: 'Tin Tức Điện Ảnh | Cinesphere Blog',
                description: 'Khám phá các tin tức điện ảnh độc quyền và review khách quan từ đội ngũ chuyên gia Cinesphere.',
                images: ['/og-default.jpg']
        }
};


// ⚡ Server Component – HTML đầy đủ tại Edge, Google index ngay lập tức
export default async function PostsPage() {
        let posts: PostItem[] = [];
        try {
                const res = await getPublicPosts({ page: 1, pageSize: 50 });
                posts = (res.items ?? [])
                        .filter((p) => p.status === 'published')
                        .sort((a, b) => {
                                const fa = a.is_featured ? 1 : 0;
                                const fb = b.is_featured ? 1 : 0;
                                if (fa !== fb) return fb - fa;
                                return (
                                        new Date(b.published_at ?? b.created_at ?? 0).getTime() -
                                        new Date(a.published_at ?? a.created_at ?? 0).getTime()
                                );
                        });
        } catch {
                // Render trang trống nếu Worker lỗi tạm thời
        }

        const featured = posts.slice(0, 3);
        const others = posts.slice(3);

        const listSchema = {
                '@context': 'https://schema.org',
                '@type': 'CollectionPage',
                name: 'Tin tức Cinesphere',
                description: 'Các bài viết, review phim và tin tức điện ảnh mới nhất tại Cinesphere.',
                url: `${SITE_URL}/bai-viet`,
                mainEntity: {
                        '@type': 'ItemList',
                        itemListElement: posts.map((post, index) => ({
                                '@type': 'ListItem',
                                position: index + 1,
                                url: `${SITE_URL}${buildPostHref(post)}`,
                                name: post.title
                        }))
                }
        };

        return (
                <UserLayout className="bg-[#0A192F]">
                        <main className="pt-28 md:pt-36 pb-12 md:pb-24 bg-[#0A192F] min-h-screen font-sans">
                                <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(listSchema) }} />
                                <section className="container my-6 mx-auto px-4 md:px-6 lg:px-8">
                                        {/* Header + Search */}
                                        <div className="flex flex-col lg:flex-row lg:items-end justify-between border-b border-white/10 pb-6 mb-10">
                                                <div>
                                                        <p className="text-[#7BB1FF] text-xs md:text-sm font-bold uppercase tracking-[0.15em] mb-2">
                                                                Cinesphere Editorial
                                                        </p>
                                                        <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-white tracking-tight">
                                                                Tin Tức Nổi Bật
                                                        </h1>
                                                </div>
                                                {/* Search: tách "use client" riêng để giữ phần còn lại là Server */}
                                                <PostsSearchClient initialPosts={posts} />
                                        </div>

                                        {/* Featured Grid – Server rendered */}
                                        {posts.length === 0 ? (
                                                <div className="text-slate-400 text-center py-20 border border-white/10 rounded-2xl bg-white/5">
                                                        Chưa có bài viết.
                                                </div>
                                        ) : (
                                                <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 xl:gap-8">
                                                        {/* Left Large Post */}
                                                        {featured[0] && (
                                                                <div className="xl:col-span-2 group block cursor-pointer">
                                                                        <Link href={buildPostHref(featured[0])}>
                                                                                <div className="relative aspect-[16/9] lg:aspect-[2/1] rounded-[1.25rem] overflow-hidden mb-6">
                                                                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                                                                        <img
                                                                                                src={
                                                                                                        featured[0].featured_image ??
                                                                                                        'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=1200'
                                                                                                }
                                                                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-in-out"
                                                                                                alt={featured[0].title}
                                                                                        />
                                                                                        {featured[0].is_featured && (
                                                                                                <div className="absolute top-4 left-4 bg-[#00D2FF] text-[#0A192F] text-[11px] font-bold px-3 py-1.5 rounded uppercase tracking-wider">
                                                                                                        Nổi bật
                                                                                                </div>
                                                                                        )}
                                                                                </div>
                                                                                <div className="flex items-center gap-3 text-xs sm:text-sm text-slate-400 mb-3">
                                                                                        <span className="text-[#00D2FF] font-semibold">Cinesphere News</span>
                                                                                        <span>•</span>
                                                                                        <span>{formatDate(featured[0].published_at ?? featured[0].created_at)}</span>
                                                                                </div>
                                                                                <h2 className="text-white text-2xl sm:text-3xl lg:text-4xl font-bold leading-tight mb-4 group-hover:text-[#7BB1FF] transition-colors duration-300">
                                                                                        {featured[0].title}
                                                                                </h2>
                                                                                <p className="text-slate-300 line-clamp-3 mb-5 text-sm sm:text-base">
                                                                                        {featured[0].excerpt ?? 'Nhấp vào để đọc nội dung toàn diện từ đội ngũ Cinesphere.'}
                                                                                </p>
                                                                                <span className="text-[#00D2FF] font-semibold text-sm flex items-center gap-2 group-hover:underline">
                                                                                        Xem chi tiết →
                                                                                </span>
                                                                        </Link>
                                                                </div>
                                                        )}

                                                        {/* Right Stacked Posts */}
                                                        <div className="xl:col-span-1 flex flex-col gap-8 justify-between">
                                                                {featured.slice(1, 3).map((post) => (
                                                                        <div key={post.id} className="group block flex-1">
                                                                                <Link href={buildPostHref(post)} className="flex flex-col h-full">
                                                                                        <div className="relative aspect-[16/9] xl:aspect-[4/3] 2xl:aspect-[16/9] rounded-2xl overflow-hidden mb-4">
                                                                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                                                                <img
                                                                                                        src={
                                                                                                                post.featured_image ??
                                                                                                                'https://images.unsplash.com/photo-1536440136628-849c177e76a1?q=80&w=800'
                                                                                                        }
                                                                                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-in-out"
                                                                                                        alt={post.title}
                                                                                                />
                                                                                        </div>
                                                                                        <div className="flex items-center gap-2 text-xs text-slate-400 mb-2">
                                                                                                <span className="text-[#00D2FF] font-semibold">Tin Tức</span>
                                                                                                <span>•</span>
                                                                                                <span>{formatDate(post.published_at ?? post.created_at)}</span>
                                                                                        </div>
                                                                                        <h3 className="text-white text-lg sm:text-xl font-bold leading-snug mb-3 group-hover:text-[#7BB1FF] transition-colors duration-300 line-clamp-2">
                                                                                                {post.title}
                                                                                        </h3>
                                                                                        <p className="text-slate-400 text-sm line-clamp-2">
                                                                                                {post.excerpt ?? 'Cập nhật diễn biến mới nhất tại hệ thống rạp Cinesphere.'}
                                                                                        </p>
                                                                                </Link>
                                                                        </div>
                                                                ))}
                                                        </div>
                                                </div>
                                        )}
                                </section>

                                {/* Other Posts */}
                                {others.length > 0 && (
                                        <section className="container mx-auto px-4 md:px-6 lg:px-8 mt-16 md:mt-24 pt-10 border-t border-white/10">
                                                <div className="mb-10">
                                                        <h2 className="text-white text-2xl md:text-3xl font-bold tracking-tight">Góc Điện Ảnh Mới</h2>
                                                </div>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 lg:gap-8">
                                                        {others.map((post) => (
                                                                <article key={post.id} className="group block">
                                                                        <Link href={buildPostHref(post)} className="flex flex-col h-full">
                                                                                <div className="relative aspect-[16/10] rounded-[1rem] overflow-hidden mb-4">
                                                                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                                                                        <img
                                                                                                src={
                                                                                                        post.featured_image ?? 'https://images.unsplash.com/photo-1542204165-65bf26472b9b?q=80&w=800'
                                                                                                }
                                                                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-in-out"
                                                                                                alt={post.title}
                                                                                        />
                                                                                </div>
                                                                                <div className="flex items-center gap-2 text-[11px] text-slate-400 mb-2">
                                                                                        <span className="text-[#7BB1FF] font-medium">Review</span>
                                                                                        <span>•</span>
                                                                                        <span>{formatDate(post.published_at ?? post.created_at)}</span>
                                                                                </div>
                                                                                <h3 className="text-white text-base md:text-lg font-bold leading-snug mb-2 group-hover:text-[#00D2FF] transition-colors duration-300 line-clamp-2">
                                                                                        {post.title}
                                                                                </h3>
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
