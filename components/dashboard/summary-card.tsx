export type SummaryTone = "revenue" | "profit" | "expense" | "stock" | "neutral";

export type SummaryCardData = {
  label: string;
  value: string;
  tone: SummaryTone;
  helper?: string;
};

const toneStyles: Record<SummaryCardData["tone"], string> = {
  revenue: "border-emerald-200 bg-emerald-50 text-emerald-950",
  profit: "border-sky-200 bg-sky-50 text-sky-950",
  expense: "border-rose-200 bg-rose-50 text-rose-950",
  stock: "border-amber-200 bg-amber-50 text-amber-950",
  neutral: "border-zinc-200 bg-white text-zinc-950",
};

type SummaryCardProps = {
  card: SummaryCardData;
};

export function SummaryCard({ card }: SummaryCardProps) {
  return (
    <article className={`min-h-32 rounded-lg border p-4 shadow-sm ${toneStyles[card.tone]}`}>
      <p className="text-sm font-medium text-black/65">{card.label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-normal">{card.value}</p>
      {card.helper ? <p className="mt-2 text-xs font-medium text-black/55">{card.helper}</p> : null}
    </article>
  );
}
