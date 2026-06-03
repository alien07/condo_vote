"use client";

import Link from "next/link";
import type { ComponentProps } from "react";

type TrackedLinkProps = ComponentProps<typeof Link> & {
  debugName: string;
};

export function TrackedLink({
  debugName,
  href,
  onClick,
  ...props
}: TrackedLinkProps) {
  return (
    <Link
      href={href}
      onClick={(event) => {
        console.debug(`[condoVotes:debug] ${JSON.stringify({
          event: "ui.click",
          name: debugName,
          href: String(href),
          path: window.location.pathname,
        })}`);
        onClick?.(event);
      }}
      {...props}
    />
  );
}
