"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useMyPet } from "@/lib/owner-client";

/**
 * Sends someone who already has a pet on this device straight to the world, which is
 * their home. The landing page stays for everyone else, and for an owner who asks for it
 * with `/?about=1`. Which pets a device has is only known in the browser, so this cannot
 * be a server redirect.
 */
export function GoHome({ stay }: { stay: boolean }) {
  const pet = useMyPet();
  const router = useRouter();
  useEffect(() => {
    if (pet && !stay) router.replace("/world");
  }, [pet, stay, router]);
  return null;
}
