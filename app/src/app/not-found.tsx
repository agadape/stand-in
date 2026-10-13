import { LinkButton } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="narrow space-y-6 py-10 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">Nobody lives here.</h1>
      <p className="text-muted">The link may be wrong, or this pet was never made.</p>
      <LinkButton href="/new">Make your pet</LinkButton>
    </div>
  );
}
