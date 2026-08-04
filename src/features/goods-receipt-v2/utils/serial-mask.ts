/** Converts WMS serial mask templates (e.g. `{STOCK}-{YY}{MM}-{N:6}`) into a RegExp. */

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function serialMaskToRegExp(
  maskTemplate: string,
  stockCode = "",
): RegExp {
  const stock = escapeRegex(stockCode.trim());
  // Normalize common alternate spellings: [STOCK], {N-6}
  const normalized = maskTemplate
    .replace(/\[STOCK\]/gi, "{STOCK}")
    .replace(/\{N-(\d+)\}/gi, "{N:$1}")
    .replace(/\{SEQ-(\d+)\}/gi, "{SEQ:$1}");
  let pattern = "";
  const token = /\{([A-Za-z]+)(?::(\d+))?\}|([^{]+)/g;
  let match: RegExpExecArray | null;
  while ((match = token.exec(normalized)) !== null) {
    if (match[3] != null) {
      pattern += escapeRegex(match[3]);
      continue;
    }
    const name = (match[1] ?? "").toUpperCase();
    const width = match[2] ? Number(match[2]) : undefined;
    switch (name) {
      case "STOCK":
        pattern += stock || ".+";
        break;
      case "YY":
        pattern += "\\d{2}";
        break;
      case "YYYY":
        pattern += "\\d{4}";
        break;
      case "MM":
      case "DD":
      case "HH":
        pattern += "\\d{2}";
        break;
      case "N":
      case "SEQ":
        pattern += `\\d{${width && width > 0 ? width : 1}}`;
        break;
      default:
        pattern += width && width > 0
          ? `[A-Z0-9]{${width}}`
          : "[A-Z0-9]+";
        break;
    }
  }
  return new RegExp(`^${pattern}$`, "i");
}

export function matchesSerialMask(
  serialNo: string,
  maskTemplate: string | null | undefined,
  options?: { stockCode?: string | null },
): boolean {
  const serial = serialNo.trim();
  if (!serial) return false;
  const mask = maskTemplate?.trim();
  if (!mask) return true;
  return serialMaskToRegExp(mask, options?.stockCode ?? "").test(serial);
}

export function maxSerialRowCount(quantity: number): number {
  if (!Number.isFinite(quantity) || quantity <= 0) return 0;
  return Math.floor(quantity);
}
