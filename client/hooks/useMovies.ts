import { useQuery } from "@tanstack/react-query";
import type { Movie } from "@shared/api";
import { getAllActiveMoviesToday } from "@/lib/api";

export function useMovies2025() {
  return useQuery<Movie[]>({
    queryKey: ["activeMovies", "today"],
    queryFn: async ({ signal }) => {
      const res = await getAllActiveMoviesToday({ signal });
      const items = res.activeMovies.map((m) => {
        let genres: string[] = [];
        try {
          const parsed = JSON.parse(m.genres);
          if (Array.isArray(parsed)) genres = parsed as string[];
        } catch {}
        const id = m.title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "");
        const year = new Date(m.release_date as any).getFullYear();
        return {
          id,
          title: m.title,
          year,
          duration: `${m.duration_min} phút`,
          genres,
          posterUrl: m.cover_image,
        } as Movie;
      });
      return items;
    },
  });
}
