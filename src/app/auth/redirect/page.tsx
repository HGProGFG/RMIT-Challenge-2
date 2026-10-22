"use client";
import { useEffect, useState } from "react";
import { useAuthCallback } from "@tidecloak/nextjs";
function Callback() {
  const { error } = useAuthCallback({
    onSuccess: () => window.location.replace("/vault"),
    onError: () => window.location.replace("/sign-in"),
    onMissingVerifierRedirectTo: "/sign-in",
  });
  return <p role="status">{error ? "Sign-in could not be completed. Return to sign-in." : "Completing Tide sign-in…"}</p>;
}
export default function AuthRedirect() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  return mounted ? <Callback/> : <p>Loading sign-in…</p>;
}
