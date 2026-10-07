import { Play } from "@/components/play";

export default async function PlayPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ mode?: string }>;
}) {
  const { slug } = await params;
  const { mode } = await searchParams;
  return <Play slug={slug} mode={mode === "owner" ? "owner" : "challenger"} />;
}
