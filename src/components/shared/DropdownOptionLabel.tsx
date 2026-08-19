import type { ReactElement } from 'react';

interface DropdownOptionLabelProps {
  primary: string;
  secondary?: string | null;
}

/** Lookup satırı: isim 2 satıra kadar sarılır, kod/meta hiç kesilmez. */
export function DropdownOptionLabel({
  primary,
  secondary,
}: DropdownOptionLabelProps): ReactElement {
  return (
    <span className="min-w-0 flex-1">
      <span className="block whitespace-normal break-words [overflow-wrap:anywhere] line-clamp-2 leading-snug">
        {primary}
      </span>
      {secondary ? (
        <span className="mt-0.5 block whitespace-normal break-words font-mono text-[11px] font-semibold tracking-wide text-[var(--wms-app-text-muted)]">
          {secondary}
        </span>
      ) : null}
    </span>
  );
}

export const DROPDOWN_OVERLAY_WIDTH_CLASS =
  'w-[min(var(--radix-popover-trigger-width),calc(100vw-1.5rem))] max-w-[calc(100vw-1.5rem)]';
