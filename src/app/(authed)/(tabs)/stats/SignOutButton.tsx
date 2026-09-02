"use client";

import { useRouter } from "next/navigation";
import { signOut } from "@/lib/actions";

export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        await signOut();
        router.push("/login");
      }}
      className="w-full py-2 text-center text-sm text-text-faint"
    >
      Sign out
    </button>
  );
}
