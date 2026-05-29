import { BotMessageSquare, CircleDollarSign, PackagePlus, ReceiptText, ShoppingCart, type LucideIcon } from "lucide-react";
import { QuickActionButton } from "./quick-action-button";

type QuickAction = {
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
  className: string;
  iconClassName: string;
  disabled?: boolean;
};

const quickActions: QuickAction[] = [
  {
    label: "Cadastrar produto",
    description: "Adicionar item ao estoque",
    href: "/products",
    icon: CircleDollarSign,
    className: "border-emerald-700 bg-emerald-50 hover:bg-emerald-100",
    iconClassName: "bg-emerald-700 text-white",
  },
  {
    label: "Registrar venda",
    description: "Dar baixa no estoque",
    href: "/sales",
    icon: ShoppingCart,
    className: "border-sky-700 bg-sky-50 hover:bg-sky-100",
    iconClassName: "bg-sky-700 text-white",
  },
  {
    label: "Registrar compra",
    description: "Aumentar o estoque",
    href: "/purchases",
    icon: PackagePlus,
    className: "border-amber-700 bg-amber-50 hover:bg-amber-100",
    iconClassName: "bg-amber-700 text-white",
  },
  {
    label: "Registrar despesa",
    description: "Salvar gasto do negocio",
    href: "/expenses",
    icon: ReceiptText,
    className: "border-rose-700 bg-rose-50 hover:bg-rose-100",
    iconClassName: "bg-rose-700 text-white",
  },
  {
    label: "Falar com NEXIS",
    description: "Chat por texto simples",
    href: "/assistant",
    icon: BotMessageSquare,
    className: "border-zinc-800 bg-white hover:bg-zinc-100",
    iconClassName: "bg-zinc-900 text-white",
  },
];

export function QuickActions() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {quickActions.map((action) => (
        <QuickActionButton
          className={action.className}
          description={action.description}
          disabled={action.disabled}
          href={action.href}
          icon={action.icon}
          iconClassName={action.iconClassName}
          key={action.label}
          label={action.label}
        />
      ))}
    </div>
  );
}
