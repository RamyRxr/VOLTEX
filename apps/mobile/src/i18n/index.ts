import { fr, type TKey } from "./fr";

export type { TKey };

/** Looks up a French string and fills {placeholders}. */
export function t(key: TKey, params?: Readonly<Record<string, string | number>>): string {
  const template: string = fr[key];
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match));
}
