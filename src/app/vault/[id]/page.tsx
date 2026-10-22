import { VaultApp } from "@/components/vault-app";
export default async function Page({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <VaultApp view="detail" examId={id}/>; }
