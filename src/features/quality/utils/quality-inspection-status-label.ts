import { localizeEnumValue } from "@/lib/enum-localization";

export function localizeQualityInspectionStatus(
  status: string,
  translate: (key: string) => string,
): string {
  const key = `list.statuses.${status}`;
  const label = translate(key);
  return !label || label === key ? localizeEnumValue(status) : label;
}
