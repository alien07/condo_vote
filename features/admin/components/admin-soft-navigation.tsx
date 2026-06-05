"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

function isPrimaryClick(event: MouseEvent) {
  return (
    event.button === 0 &&
    !event.altKey &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.shiftKey
  );
}

function isAdminUrl(url: URL) {
  return url.origin === window.location.origin && url.pathname.startsWith("/admin");
}

export function AdminSoftNavigation() {
  const router = useRouter();

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (!isPrimaryClick(event) || event.defaultPrevented) {
        return;
      }

      const anchor = (event.target as Element | null)?.closest("a[href]");

      if (!(anchor instanceof HTMLAnchorElement)) {
        return;
      }

      const url = new URL(anchor.href);

      if (!isAdminUrl(url)) {
        return;
      }

      event.preventDefault();
      router.replace(`${url.pathname}${url.search}${url.hash}`, { scroll: false });
    }

    function handleSubmit(event: SubmitEvent) {
      if (event.defaultPrevented) {
        return;
      }

      const form = event.target;

      if (!(form instanceof HTMLFormElement) || form.method.toLowerCase() === "post") {
        return;
      }

      const url = new URL(form.action || window.location.href);

      if (!isAdminUrl(url)) {
        return;
      }

      const formData = new FormData(form);
      const params = new URLSearchParams();

      for (const [key, value] of formData.entries()) {
        if (typeof value === "string" && value) {
          params.append(key, value);
        }
      }

      const query = params.toString();

      event.preventDefault();
      router.replace(query ? `${url.pathname}?${query}` : url.pathname, {
        scroll: false,
      });
    }

    document.addEventListener("click", handleClick);
    document.addEventListener("submit", handleSubmit);

    return () => {
      document.removeEventListener("click", handleClick);
      document.removeEventListener("submit", handleSubmit);
    };
  }, [router]);

  return null;
}
