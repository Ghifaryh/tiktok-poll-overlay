type LayoutWithOptions = {
  sourceType: "comment" | "gift";
  options: { id: string; matchValue: string; aliases: string[]; giftId: string | null }[];
};

export function normalizeComment(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[\u{FE0F}\u{200D}]/gu, "")
    .replace(/[.,!?]+$/g, "");
}

export function matchOption(layout: LayoutWithOptions, type: "comment" | "gift", data: any) {
  if (type === "gift") {
    const giftId = String(data.giftId ?? data.giftDetails?.giftId ?? "");
    return layout.options.find((o) => o.giftId === giftId) ?? null;
  }

  const normalized = normalizeComment(data.comment ?? "");
  for (const option of layout.options) {
    if (option.matchValue.toLowerCase() === normalized) return option;
    if (option.aliases.some((a) => a.toLowerCase() === normalized)) return option;
  }
  return null;
}