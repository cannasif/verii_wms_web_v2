function connectionErrorPattern(): RegExp {
  return /https?:\/\/\S+\s+bağlantı hatası:\s*.+?(?=\s*\||\s+Mal Kabul|$)/gi;
}

export function collapseRepeatedMessageSegments(text: string): string {
  let next = String(text ?? "").replace(/\s+/g, " ").trim();
  if (!next) return "";

  const connectionErrors = next.match(connectionErrorPattern()) ?? [];
  if (connectionErrors.length > 1) {
    let kept = false;
    next = next.replace(connectionErrorPattern(), (match) => {
      if (kept) return "";
      kept = true;
      return match;
    });
  }

  const parts = next
    .split(/\s*\|\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length > 1) {
    const kept: string[] = [];
    for (const part of parts) {
      const index = kept.findIndex((existing) => existing.includes(part) || part.includes(existing));
      if (index < 0) {
        kept.push(part);
        continue;
      }
      if (part.length > kept[index].length) kept[index] = part;
    }
    next = kept.join(" ");
  }

  return next.replace(/\s+/g, " ").trim();
}
