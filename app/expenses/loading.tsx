import { RouteLoading } from "@/components/route-loading";

export default function Loading() {
  return (
    <RouteLoading
      description="Preparando o formulario e as despesas recentes."
      listLabel="Carregando despesas"
      title="Despesas"
    />
  );
}
