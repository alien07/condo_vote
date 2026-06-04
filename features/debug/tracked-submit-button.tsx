"use client";

import {
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import { LoaderCircle } from "lucide-react";
import { useFormStatus } from "react-dom";

type TrackedSubmitButtonProps = ComponentProps<"button"> & {
  debugName?: string;
  pendingLabel?: string;
  pendingIcon?: ReactNode;
};

export function TrackedSubmitButton({
  debugName,
  children,
  disabled,
  onClick,
  pendingIcon,
  pendingLabel = "Working...",
  type = "submit",
  ...props
}: TrackedSubmitButtonProps) {
  const { pending } = useFormStatus();
  const [clicked, setClicked] = useState(false);
  const pendingRef = useRef(pending);
  const isBusy = pending || clicked;
  const isDisabled = disabled || isBusy;

  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);
  const scheduleClickReset = () => {
    window.setTimeout(() => {
      if (pendingRef.current) {
        scheduleClickReset();
        return;
      }

      setClicked(false);
    }, 700);
  };

  return (
    <button
      aria-busy={pending}
      aria-disabled={isDisabled}
      disabled={isDisabled}
      onClick={(event) => {
        if (debugName) {
          console.debug(`[condoVotes:debug] ${JSON.stringify({
            event: "ui.click",
            name: debugName,
            path: window.location.pathname,
          })}`);
        }

        onClick?.(event);

        if (!event.defaultPrevented && type === "submit") {
          setClicked(true);
          scheduleClickReset();
        }
      }}
      type={type}
      {...props}
    >
      {isBusy ? (
        <span className="inline-flex items-center justify-center gap-2">
          {pendingIcon ?? (
            <LoaderCircle
              aria-hidden="true"
              className="animate-spin"
              size={16}
            />
          )}
          {pendingLabel}
        </span>
      ) : (
        children
      )}
    </button>
  );
}

export const PendingSubmitButton = TrackedSubmitButton;
