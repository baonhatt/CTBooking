'use client';

import { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import { type PostItem } from '@/lib/api/posts';
import Link from 'next/link';

export default function PostsSearchClient({ initialPosts }: { initialPosts: PostItem[] }) {
  const [q, setQ] = useState('');

  const filtered = useMemo(() => {
    if (!q.trim()) return [];
    const key = q.toLowerCase();
    return initialPosts.filter(
      (p) => (p.title ?? '').toLowerCase().includes(key) || (p.excerpt ?? '').toLowerCase().includes(key)
    );
  }, [initialPosts, q]);

  return (
    <div className="mt-6 lg:mt-0 flex flex-col sm:flex-row items-stretch sm:items-center gap-4 lg:gap-8 relative z-50">
      <div className="relative w-full sm:w-64 lg:w-80 group">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Tìm tiêu đề bài viết..."
          className="w-full pl-10 bg-[#0A192F] border border-white/20 text-white placeholder:text-slate-400 h-11 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#00D2FF]"
        />

        {/* Search Results Dropdown */}
        {q.trim() && (
          <div className="absolute top-12 left-0 right-0 bg-[#06101f] border border-white/10 rounded-lg shadow-xl shadow-cyan-500/10 overflow-hidden">
            {filtered.length === 0 ? (
              <div className="p-4 text-sm text-slate-400">Không có kết quả.</div>
            ) : (
              <div className="max-h-80 overflow-y-auto custom-scrollbar">
                {filtered.map((p) => (
                  <Link
                    key={p.id}
                    href={`/bai-viet/${p.slug ? `${p.slug}-` : ''}${p.id}`}
                    className="flex items-center gap-3 p-3 hover:bg-white/5 border-b border-white/5 last:border-none transition-colors"
                    onClick={() => setQ('')}
                  >
                    {p.featured_image && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.featured_image}
                        alt={p.title}
                        className="w-12 h-12 rounded object-cover flex-shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white line-clamp-1">{p.title}</p>
                      {p.excerpt && <p className="text-xs text-slate-400 line-clamp-1">{p.excerpt}</p>}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
