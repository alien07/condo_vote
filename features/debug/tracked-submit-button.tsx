"use client";

import type { ComponentProps } from "react";

type TrackedSubmitButtonProps = ComponentProps<"button"> & {
  debugName: string;
};

export function TrackedSubmitButton({
  debugName,
  onClick,
  type = "submit",
  ...props
}: TrackedSubmitButtonProps) {
  return (
    <button
      onClick={(event) => {
        console.debug(`[condoVotes:debug] ${JSON.stringify({
          event: "ui.click",
          name: debugName,
          path: window.location.pathname,
        })}`);
        onClick?.(event);
      }}
      type={type}
      {...props}
    />
  );
}
