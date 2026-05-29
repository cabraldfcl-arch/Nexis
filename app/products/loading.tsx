import { RouteLoading } from "@/components/route-loading";

export default function Loading() {
  return (
    <RouteLoading
      description="Preparando cadastro e lista inicial de produtos."
      listLabel="Carregando produtos"
      title="Produtos"
    />
  );
}
