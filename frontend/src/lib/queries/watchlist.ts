import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";

export interface WatchlistItem { id: number; user_id: number; symbol: string; added_at: string }

export function useWatchlist() {
  return useQuery<WatchlistItem[]>({
    queryKey: ["watchlist"],
    queryFn: async () => (await api.get<WatchlistItem[]>("/watchlist")).data,
    staleTime: 30_000,
  });
}

export function useAddWatchlistItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (symbol: string) =>
      (await api.post<WatchlistItem>("/watchlist", { symbol })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["watchlist"] }),
  });
}

export function useRemoveWatchlistItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => api.delete(`/watchlist/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["watchlist"] }),
  });
}