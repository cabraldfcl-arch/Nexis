import type { AssistantAnswer } from "@/lib/ai/answer-question";

type AnswerCardProps = {
  answer: AssistantAnswer;
};

const toneStyles: Record<AssistantAnswer["tone"], string> = {
  revenue: "border-emerald-200 bg-emerald-50 text-emerald-950",
  profit: "border-sky-200 bg-sky-50 text-sky-950",
  expense: "border-rose-200 bg-rose-50 text-rose-950",
  stock: "border-amber-200 bg-amber-50 text-amber-950",
  neutral: "border-zinc-200 bg-white text-zinc-950",
};

export function AnswerCard({ answer }: AnswerCardProps) {
  return (
    <article className={`rounded-lg border p-4 shadow-sm ${toneStyles[answer.tone]}`}>
      <p className="text-sm font-semibold text-black/65">{answer.title}</p>
      <p className="mt-2 text-2xl font-semibold tracking-normal">{answer.value}</p>
      <p className="mt-3 text-sm leading-6 text-black/70">{answer.body}</p>
    </article>
  );
}
