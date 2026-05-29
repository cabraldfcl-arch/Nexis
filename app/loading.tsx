import { RouteLoading } from "@/components/route-loading";

export default function Loading() {
  return (
    <RouteLoading
      description="Buscando os numeros do painel e os produtos que precisam de atencao."
      listLabel="Carregando painel"
      showBackAction={false}
      title="Hoje no negocio"
    />
  );
}
