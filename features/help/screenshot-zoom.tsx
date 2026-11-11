"use client";

import Image from "next/image";
import { useRef } from "react";
import { X, ZoomIn } from "lucide-react";

type ScreenshotZoomProps = {
  alt: string;
  src: string;
  width: number;
  height: number;
  enlargeLabel: string;
  closeLabel: string;
};

// Help screenshot that opens full size on click or tap. Uses the native
// <dialog>: Esc, the close button, or a click anywhere closes it.
export function ScreenshotZoom({
  alt,
  src,
  width,
  height,
  enlargeLabel,
  closeLabel,
}: ScreenshotZoomProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        aria-label={`${enlargeLabel}: ${alt}`}
        className="group relative mx-auto block w-full max-w-[220px] cursor-zoom-in rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
        onClick={() => dialogRef.current?.showModal()}
        type="button"
      >
        <Image
          alt={alt}
          className="w-full rounded-xl border border-[var(--border)] shadow-sm transition group-hover:shadow-md"
          height={height}
          src={src}
          width={width}
        />
        <span
          aria-hidden
          className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-black/70 px-2 py-1 text-xs text-white"
        >
          <ZoomIn size={14} />
          {enlargeLabel}
        </span>
      </button>
      <dialog
        aria-label={alt}
        className="m-auto max-h-none max-w-none cursor-zoom-out bg-transparent p-0 backdrop:bg-black/80"
        onClick={() => dialogRef.current?.close()}
        ref={dialogRef}
      >
        <div className="relative">
          <Image
            alt={alt}
            className="h-auto max-h-[92vh] w-auto max-w-[95vw] rounded-xl"
            height={height}
            sizes="(max-width: 640px) 95vw, 390px"
            src={src}
            width={width}
          />
          <button
            aria-label={closeLabel}
            className="absolute right-2 top-2 inline-flex min-h-11 min-w-11 items-center justify-center rounded-full bg-black/70 text-white"
            onClick={() => dialogRef.current?.close()}
            type="button"
          >
            <X aria-hidden size={20} />
          </button>
        </div>
      </dialog>
    </>
  );
}
