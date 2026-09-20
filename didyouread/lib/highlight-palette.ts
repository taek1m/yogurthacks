import type { HighlightColor } from "@/types/agent";

/**
 * Colours beyond the five categories the analysis uses, for passages a reader
 * wants marked for their own reasons — chapter titles, things to ask about,
 * anything the document's own risk vocabulary has no word for.
 *
 * The classes are written out in full because Tailwind reads the source, not
 * the values: a class built at runtime would never be generated.
 */
export const PALETTE: Record<HighlightColor, { label: string; mark: string; chip: string; dot: string }> = {
  grey: {
    label: "Grey",
    mark: "bg-[#dfe3e0] text-[#2f3733] decoration-[#5d6a62]",
    chip: "border-[#c2ccc6] bg-[#eef1ef] text-[#495751]",
    dot: "bg-[#5d6a62]",
  },
  purple: {
    label: "Purple",
    mark: "bg-[#e4dbf5] text-[#332351] decoration-[#5f4794]",
    chip: "border-[#c6b7e4] bg-[#f1ecfa] text-[#513a83]",
    dot: "bg-[#5f4794]",
  },
  pink: {
    label: "Pink",
    mark: "bg-[#fadbe9] text-[#4d1533] decoration-[#a8447a]",
    chip: "border-[#e8b6cd] bg-[#fdeef4] text-[#8d3560]",
    dot: "bg-[#a8447a]",
  },
  teal: {
    label: "Teal",
    mark: "bg-[#cfe9e4] text-[#123c37] decoration-[#2a7a70]",
    chip: "border-[#a4cfc8] bg-[#e8f5f2] text-[#20665e]",
    dot: "bg-[#2a7a70]",
  },
  indigo: {
    label: "Indigo",
    mark: "bg-[#d7dcf5] text-[#1e2650] decoration-[#414f9c]",
    chip: "border-[#b3bce6] bg-[#eaedfb] text-[#37428a]",
    dot: "bg-[#414f9c]",
  },
  brown: {
    label: "Brown",
    mark: "bg-[#e8dcce] text-[#40301d] decoration-[#7d5c36]",
    chip: "border-[#d0bda4] bg-[#f4ece2] text-[#6b4e2c]",
    dot: "bg-[#7d5c36]",
  },
  lime: {
    label: "Lime",
    mark: "bg-[#e2efbf] text-[#33420f] decoration-[#5f7a25]",
    chip: "border-[#c5d99a] bg-[#f0f7dd] text-[#4f6a1c]",
    dot: "bg-[#5f7a25]",
  },
  aqua: {
    label: "Aqua",
    mark: "bg-[#cfe8f5] text-[#0f3646] decoration-[#236f8e]",
    chip: "border-[#a3cfe3] bg-[#e7f4fa] text-[#1c5c78]",
    dot: "bg-[#236f8e]",
  },
};

export const PALETTE_COLORS = Object.keys(PALETTE) as HighlightColor[];

export function isPaletteColor(value: unknown): value is HighlightColor {
  return typeof value === "string" && value in PALETTE;
}
