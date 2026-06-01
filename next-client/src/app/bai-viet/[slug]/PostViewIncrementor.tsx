'use client';

import { useEffect, useRef } from 'react';

interface PostViewIncrementorProps {
        postId: number;
}

export default function PostViewIncrementor({ postId }: PostViewIncrementorProps) {
        const hasIncremented = useRef(false);

        useEffect(() => {
                if (hasIncremented.current) return;
                hasIncremented.current = true;

                // Increment view count when page loads
                const API = process.env.NEXT_PUBLIC_SERVER_BASE_URL ?? '';
                fetch(`${API}/api/posts/${postId}/view`, {
                        method: 'POST'
                }).catch((err) => {
                        console.error('Failed to increment view count:', err);
                });
        }, [postId]);

        return null;
}
