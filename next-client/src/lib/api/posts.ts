import { siteConfig } from '@/config/site';

const API = process.env.NEXT_PUBLIC_API_URL ?? '';

export type PostItem = {
        id: number;
        title: string;
        slug?: string;
        excerpt?: string;
        featured_image?: string;
        status: string;
        is_featured?: boolean;
        published_at?: string;
        created_at?: string;
        updated_at?: string;
        view_count?: number;
        content?: string;
        meta_description?: string;
        meta_keywords?: string;
};

export type PostsResponse = {
        items: PostItem[];
        page: number;
        pageSize: number;
        total: number;
};

/** Lấy danh sách bài viết public – ISR cache 1h */
export async function getPublicPosts(options?: {
        page?: number;
        pageSize?: number;
        q?: string;
}): Promise<PostsResponse> {
        const params = new URLSearchParams();
        if (options?.page) params.set('page', String(options.page));
        if (options?.pageSize) params.set('pageSize', String(options.pageSize));
        if (options?.q) params.set('q', options.q);

        const res = await fetch(`${API}/api/posts?${params.toString()}`, {
                next: { revalidate: 3600 }, // ISR: tái tạo cache sau 1h
                headers: {
                        // Thêm headers để giúp SEO bot nhận diện request server-side
                        ...(typeof window === "undefined" && { "User-Agent": `Mozilla/5.0 (compatible; CinesphereBot/1.0; +${siteConfig.domain})` }),
                },
        });

        if (!res.ok) throw new Error(`Failed to fetch posts: ${res.status}`);
        return res.json();
}

/** Lấy chi tiết bài viết theo slug-id pattern (vd: "ten-bai-viet-123") */
export async function getPostBySlugId(slugId: string): Promise<PostItem | null> {
        const res = await fetch(`${API}/api/posts/${slugId}`, {
                next: { revalidate: 3600 },
                headers: {
                        // Thêm headers để giúp SEO bot nhận diện request server-side
                        ...(typeof window === "undefined" && { "User-Agent": `Mozilla/5.0 (compatible; CinesphereBot/1.0; +${siteConfig.domain})` }),
                },
        });
        if (res.status === 404) return null;
        if (!res.ok) throw new Error(`Failed to fetch post: ${res.status}`);
        const data = await res.json() as { post?: PostItem } | PostItem;
        // Worker có thể trả về { post: ... } hoặc trực tiếp object
        return (data as any)?.post ?? data as PostItem;
}
