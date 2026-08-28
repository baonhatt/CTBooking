import { request } from './http';

export async function getPosts(options?: {
  page?: number;
  pageSize?: number;
  q?: string;
  status?: string;
  signal?: AbortSignal;
}) {
  const params = new URLSearchParams();
  if (options?.page) params.set('page', String(options.page));
  if (options?.pageSize) params.set('pageSize', String(options.pageSize));
  if (options?.q) params.set('q', options.q);
  if (options?.status) params.set('status', options.status);

  return request<{ items: any[]; page: number; pageSize: number; total: number }>(
    `/api/admin/posts?${params.toString()}`,
    {
      signal: options?.signal
    }
  );
}

// Public list posts (default: published-only on server)
export async function getPublicPosts(options?: {
  page?: number;
  pageSize?: number;
  q?: string;
  status?: string; // optional override if server allows; defaults to published
  signal?: AbortSignal;
}) {
  const params = new URLSearchParams();
  if (options?.page) params.set('page', String(options.page));
  if (options?.pageSize) params.set('pageSize', String(options.pageSize));
  if (options?.q) params.set('q', options.q);
  if (options?.status) params.set('status', options.status);

  return request<{ items: any[]; page: number; pageSize: number; total: number }>(`/api/posts?${params.toString()}`, {
    signal: options?.signal
  });
}

export async function getPostById(id: number | string) {
  return request<{ post: any }>(`/api/admin/posts/${id}`);
}

export async function createPostApi(body: {
  title: string;
  content: string;
  excerpt?: string;
  featured_image?: string;
  image_base64?: string;
  author_id?: number;
  status?: string;
  is_featured?: boolean;
}) {
  return request<{ post: any }>('/api/posts', {
    method: 'POST',
    body: JSON.stringify(body)
  });
}

export async function updatePostApi(
  id: number,
  body: {
    title?: string;
    content?: string;
    excerpt?: string;
    featured_image?: string;
    image_base64?: string;
    status?: string;
    is_featured?: boolean;
  }
) {
  return request<{ post: any }>(`/api/posts/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body)
  });
}

export async function deletePostApi(id: number, hardDelete?: boolean) {
  return request<any>(`/api/posts/${id}${hardDelete ? '?hardDelete=true' : ''}`, {
    method: 'DELETE'
  });
}
