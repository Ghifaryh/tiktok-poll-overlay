const API_URL = import.meta.env.PUBLIC_API_URL;

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<T>;
}

export type Layout = {
  id: string;
  name: string;
  sourceType: "comment" | "gift";
  status: "draft" | "active" | "ended";
  overlayToken: string;
  options: { id: string; label: string }[];
};

export const api = {
  getLayouts: () => request<Layout[]>("/api/layouts"),
  createLayout: (data: unknown) => request<Layout>("/api/layouts", { method: "POST", body: JSON.stringify(data) }),
  activateLayout: (id: string) => request<Layout>(`/api/layouts/${id}/activate`, { method: "POST" }),
  endLayout: (id: string) => request<Layout>(`/api/layouts/${id}/end`, { method: "POST" }),
  getLayoutStats: (id: string) =>request<{ totalVotes: number; connected: boolean }>(`/api/layouts/${id}/stats`),
  getMe: () => request<{ id: string; email: string; tiktokUsername: string | null }>("/api/auth/me"),
};