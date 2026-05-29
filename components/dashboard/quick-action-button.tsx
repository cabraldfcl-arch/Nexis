import { ChevronRight, type LucideIcon } from "lucide-react";
import Link from "next/link";

type QuickActionButtonProps = {
  href?: string;
  icon: LucideIcon;
  label: string;
  description: string;
  className: string;
  iconClassName: string;
  disabled?: boolean;
};

const buttonClassName =
  "group flex min-h-20 touch-manipulation items-center gap-3 rounded-lg border-2 px-4 py-4 text-left shadow-sm transition active:translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700";

export function QuickActionButton({
  href,
  icon: Icon,
  label,
  description,
  className,
  iconClassName,
  disabled = false,
}: QuickActionButtonProps) {
  if (disabled || !href) {
    return (
      <button
        aria-label={`${label} indisponivel`}
        className={`${buttonClassName} cursor-not-allowed border-zinc-200 bg-white text-zinc-500 opacity-60`}
        disabled
        type="button"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-zinc-100">
          <Icon aria-hidden="true" className="h-5 w-5 shrink-0 text-zinc-500" />
        </span>
        <span className="min-w-0">
          <span className="block text-base font-semibold">{label}</span>
          <span className="mt-1 block text-sm font-medium">{description}</span>
        </span>
      </button>
    );
  }

  return (
    <Link
      aria-label={label}
      className={`${buttonClassName} cursor-pointer text-zinc-950 ${className}`}
      href={href}
      prefetch
    >
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${iconClassName}`}>
        <Icon aria-hidden="true" className="h-5 w-5 shrink-0" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-base font-semibold leading-6">{label}</span>
        <span className="mt-1 block text-sm font-medium leading-5 text-zinc-700">{description}</span>
      </span>
      <ChevronRight
        aria-hidden="true"
        className="h-5 w-5 shrink-0 text-zinc-500 transition group-hover:translate-x-0.5 group-hover:text-zinc-800"
      />
    </Link>
  );
}
