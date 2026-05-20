import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Eye } from 'lucide-react';
import UserLayout from '@/layouts/UserLayout';
import { getPostBySlugId, getPublicPosts } from '@/lib/api/posts';
import { buildPostHref } from '@/lib/utils';
import PostSidebar from './PostSidebar';

export const runtime = 'edge';
export const revalidate = 3600;

const SITE_URL = 'https://cinephere.com.vn';

export async function generateMetadata({
        params,
}: {
        params: { slug: string };
}): Promise<Metadata> {
        const post = await getPostBySlugId(params.slug).catch(() => null);

        if (!post || post.status !== 'published') {
                return {
                        title: 'Bài Viết Không Tồn Tại',
                        robots: { index: false, follow: false },
                };
        }

        const canonicalUrl = `${SITE_URL}${buildPostHref(post)}`;
        const description =
                post.excerpt?.trim() ||
                `Đọc bài viết "${post.title}" tại Cinesphere - Rạp chiếu phim công nghệ hiện đại.`;
        const ogImage = post.featured_image || `${SITE_URL}/logo.svg`;

        return {
                title: post.title,
                description,
                alternates: { canonical: canonicalUrl },
                openGraph: {
                        title: post.title,
                        description,
                        type: 'article',
                        url: canonicalUrl,
                        publishedTime: post.published_at,
                        modifiedTime: post.updated_at,
                        locale: 'vi_VN',
                        siteName: 'Cinesphere',
                        images: [{ url: ogImage, width: 1200, height: 630, alt: post.title }],
                },
                twitter: {
                        card: 'summary_large_image',
                        title: post.title,
                        description,
                        images: [ogImage],
                },
        };
}

export default async function PostDetailPage({
        params,
}: {
        params: { slug: string };
}) {
        const post = await getPostBySlugId(params.slug).catch(() => null);

        if (!post || post.status !== 'published') {
                notFound();
        }

        const relatedPosts = await getPublicPosts({ page: 1, pageSize: 12 })
                .then((r) =>
                        r.items
                                .filter((p) => p.status === 'published' && p.id !== post.id)
                                .slice(0, 3)
                )
                .catch(() => []);

        const postUrl = `${SITE_URL}${buildPostHref(post)}`;

        const jsonLd = {
                '@context': 'https://schema.org',
                '@type': 'Article',
                headline: post.title,
                description: post.excerpt?.trim() || '',
                image: post.featured_image || `${SITE_URL}/logo.svg`,
                datePublished: post.published_at || post.created_at,
                dateModified: post.updated_at || post.published_at || post.created_at,
                author: { '@type': 'Organization', name: 'Cinesphere', url: SITE_URL },
                publisher: {
                        '@type': 'Organization',
                        name: 'Cinesphere',
                        logo: { '@type': 'ImageObject', url: `${SITE_URL}/logo.svg` },
                },
                mainEntityOfPage: { '@type': 'WebPage', '@id': postUrl },
        };

        return (
                <UserLayout className="bg-gradient-dark">
                        <script
                                type="application/ld+json"
                                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
                        />
                        <main className="pb-16">
                                {/* Back button */}
                                <div className="container mx-auto px-4 md:px-6 lg:px-8 pt-20 md:pt-24">
                                        <Link
                                                href="/posts"
                                                className="inline-flex items-center gap-2 text-slate-300 hover:text-white hover:bg-white/10 bg-transparent px-3 py-2 rounded-md transition-colors text-sm"
                                        >
                                                <ArrowLeft className="w-4 h-4" />
                                                Quay lại danh sách bài viết
                                        </Link>
                                </div>

                                {/* ── Hero Banner ── */}
                                <section className="relative mt-4 w-full overflow-hidden" style={{ minHeight: '520px' }}>
                                        {post.featured_image ? (
                                                <img
                                                        src={post.featured_image}
                                                        alt={post.title}
                                                        className="absolute inset-0 w-full h-full object-cover object-center"
                                                />
                                        ) : (
                                                <div className="absolute inset-0 bg-gradient-to-b from-slate-800 to-slate-950" />
                                        )}
                                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-black/20" />
                                        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-transparent" />

                                        <div
                                                className="relative z-10 container mx-auto px-4 md:px-6 lg:px-8 flex flex-col justify-end h-full"
                                                style={{ minHeight: '520px', paddingBottom: '3rem' }}
                                        >
                                                <div className="flex items-center gap-3 mb-4">
                                                        <span className="bg-yellow-400 text-black text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-sm">
                                                                Bài Viết
                                                        </span>
                                                        <span className="text-slate-300 text-xs uppercase tracking-widest font-semibold">
                                                                {new Date(
                                                                        post.published_at || post.created_at || Date.now()
                                                                ).toLocaleDateString('vi-VN', {
                                                                        month: 'long',
                                                                        year: 'numeric',
                                                                })}
                                                        </span>
                                                </div>

                                                <h1 className="text-white font-black leading-[1.05] tracking-tight text-4xl sm:text-5xl md:text-6xl lg:text-7xl max-w-5xl">
                                                        {post.title}
                                                </h1>

                                                {post.excerpt?.trim() && (
                                                        <p className="mt-5 text-slate-300 italic text-base md:text-lg max-w-3xl leading-relaxed">
                                                                &ldquo;{post.excerpt.trim()}&rdquo;
                                                        </p>
                                                )}

                                                {(post.view_count ?? 0) >= 0 && (
                                                        <div className="mt-4 inline-flex items-center gap-1.5 text-slate-400 text-xs">
                                                                <Eye className="w-4 h-4 text-cyan-400" />
                                                                {(post.view_count ?? 0).toLocaleString('vi-VN')} lượt xem
                                                        </div>
                                                )}
                                        </div>
                                </section>

                                {/* ── Article + Sidebar ── */}
                                <div className="container mx-auto px-4 md:px-6 lg:px-8 mt-10">
                                        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
                                                <article className="lg:col-span-8">
                                                        <div className="rounded-2xl md:rounded-3xl neon-border bg-white/5 p-6 md:p-10">
                                                                <div
                                                                        className="leading-7 text-slate-200 [&_h1]:text-white [&_h1]:font-black [&_h1]:text-3xl [&_h1]:mt-8 [&_h2]:text-white [&_h2]:font-extrabold [&_h2]:text-2xl [&_h2]:mt-8 [&_h3]:text-white [&_h3]:font-bold [&_h3]:text-xl [&_h3]:mt-6 [&_p]:text-slate-200 [&_p]:mb-4 [&_strong]:text-white [&_a]:text-cyan-300 [&_a]:underline [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:my-4 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:my-4 [&_li]:text-slate-200 [&_li]:mb-1 [&_img]:rounded-xl [&_img]:my-6 [&_img]:w-full [&_blockquote]:border-l-4 [&_blockquote]:border-cyan-400 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-slate-300 [&_blockquote]:my-4 [&_figure]:my-6 [&_figure]:text-center [&_figure_img]:rounded-xl [&_figure_img]:w-full [&_figure_img]:my-0 [&_figcaption]:mt-2 [&_figcaption]:text-xs [&_figcaption]:text-slate-400 [&_figcaption]:italic"
                                                                        dangerouslySetInnerHTML={{
                                                                                __html: (post.content || '').replace(
                                                                                        /<img(?![^>]*\balt=)([^>]*)(\/?>)/gi,
                                                                                        `<img alt="${post.title}"$1$2`
                                                                                ),
                                                                        }}
                                                                />
                                                        </div>
                                                </article>

                                                <PostSidebar
                                                        postId={post.id}
                                                        postTitle={post.title}
                                                        postUrl={postUrl}
                                                />
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
                                                                                href={buildPostHref(item)}
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
                                                                                        {new Date(
                                                                                                item.published_at || item.created_at || Date.now()
                                                                                        ).toLocaleDateString('vi-VN')}
                                                                                </p>
                                                                        </Link>
                                                                ))}
                                                        </div>
                                                </div>
                                        </section>
                                )}
                        </main>
                </UserLayout>
        );
}
