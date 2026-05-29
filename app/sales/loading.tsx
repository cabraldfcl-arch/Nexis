import { RouteLoading } from "@/components/route-loading";

export default function Loading() {
  return (
    <RouteLoading
      description="Carregando produtos ativos e vendas recentes."
      listLabel="Carregando vendas"
      title="Vendas"
    />
  );
}
