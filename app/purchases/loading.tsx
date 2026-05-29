import { RouteLoading } from "@/components/route-loading";

export default function Loading() {
  return (
    <RouteLoading
      description="Carregando produtos ativos e compras recentes."
      listLabel="Carregando compras"
      title="Compras"
    />
  );
}
