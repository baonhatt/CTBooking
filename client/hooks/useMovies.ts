import { useQuery } from "@tanstack/react-query";
import { getMovies2025 } from "@/lib/api";
import type { Movie } from "@shared/api";

export function useMovies2025() {
  return useQuery<Movie[]>({
    queryKey: ["movies", 2025],
    queryFn: async ({ signal }) => {
      const res = await getMovies2025({ signal });
      return res.items;
    },
  });
}