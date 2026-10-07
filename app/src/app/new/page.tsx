import type { Metadata } from "next";
import { CreateTwin } from "@/components/create-twin";

export const metadata: Metadata = { title: "Make your twin" };

export default function NewTwinPage() {
  return <CreateTwin />;
}
