'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Share2, Link2, Clock3 } from 'lucide-react';
import { toast } from 'sonner';

type RecentViewedPost = {
<<<<<<< HEAD
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

interface PostSidebarProps {
        postId: number;
        postTitle: string;
        postUrl: string;
}

export default function PostSidebar({ postId, postTitle, postUrl }: PostSidebarProps) {
        const [copied, setCopied] = useState(false);
        const [recentPosts, setRecentPosts] = useState<RecentViewedPost[]>([]);

        useEffect(() => {
                try {
                        const key = 'recent_viewed_post_titles';
                        const raw = localStorage.getItem(key);
                        const list = raw ? (JSON.parse(raw) as RecentViewedPost[]) : [];
                        const nextItem: RecentViewedPost = {
                                id: postId,
                                title: postTitle,
                                viewed_at: new Date().toISOString(),
                        };
                        const next = [nextItem, ...list.filter((x) => x.id !== postId)].slice(0, 10);
                        localStorage.setItem(key, JSON.stringify(next));
                        setRecentPosts(next.filter((x) => x.id !== postId).slice(0, 10));
                } catch {
                        setRecentPosts([]);
                }
        }, [postId, postTitle]);

        const copyLink = async () => {
                try {
                        await navigator.clipboard.writeText(postUrl);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 1200);
                        toast.success('Đã sao chép liên kết bài viết');
                } catch {
                        toast.error('Không thể sao chép liên kết');
                }
        };

        return (
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
                                                href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(postUrl)}`}
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
                                                        <Link key={item.id} href={`/bai-viet/${item.id}`} className="block group">
                                                                <p className="text-slate-200 text-sm group-hover:text-cyan-300 transition-colors line-clamp-2">
                                                                        {item.title}
                                                                </p>
                                                                <p className="text-slate-500 text-xs mt-1">{timeAgo(item.viewed_at)}</p>
                                                        </Link>
                                                ))}
                                        </div>
                                )}
                        </div>
                </aside>
        );
=======
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

interface PostSidebarProps {
  postId: number;
  postTitle: string;
  postUrl: string;
}

export default function PostSidebar({ postId, postTitle, postUrl }: PostSidebarProps) {
  const [copied, setCopied] = useState(false);
  const [recentPosts, setRecentPosts] = useState<RecentViewedPost[]>([]);

  useEffect(() => {
    try {
      const key = 'recent_viewed_post_titles';
      const raw = localStorage.getItem(key);
      const list = raw ? (JSON.parse(raw) as RecentViewedPost[]) : [];
      const nextItem: RecentViewedPost = {
        id: postId,
        title: postTitle,
        viewed_at: new Date().toISOString()
      };
      const next = [nextItem, ...list.filter((x) => x.id !== postId)].slice(0, 10);
      localStorage.setItem(key, JSON.stringify(next));
      setRecentPosts(next.filter((x) => x.id !== postId).slice(0, 10));
    } catch {
      setRecentPosts([]);
    }
  }, [postId, postTitle]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(postUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
      toast.success('Đã sao chép liên kết bài viết');
    } catch {
      toast.error('Không thể sao chép liên kết');
    }
  };

  return (
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
            href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(postUrl)}`}
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
              <Link key={item.id} href={`/bai-viet/${item.id}`} className="block group">
                <p className="text-slate-200 text-sm group-hover:text-cyan-300 transition-colors line-clamp-2">
                  {item.title}
                </p>
                <p className="text-slate-500 text-xs mt-1">{timeAgo(item.viewed_at)}</p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
>>>>>>> preview
}
