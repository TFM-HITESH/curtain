import { COVER_ATTRIBUTE, type ResolvedTheme } from "@/engine";

const C = `[${COVER_ATTRIBUTE}]`;

/**
 * The cover's styles. Only attribute selectors are used, so nothing collides
 * with the site's own classes, and every colour and font comes from the site.
 */
export function coverCss(theme: ResolvedTheme): string {
  return `
${C} {
  --curtain-surface: ${theme.surface};
  --curtain-text: ${theme.text};
  --curtain-muted: ${theme.muted};
  --curtain-border: ${theme.border};
  position: absolute;
  inset: 0;
  z-index: 10;
  display: grid;
  place-items: center;
  padding: 24px;
  box-sizing: border-box;
  /* Nearly opaque, so nothing underneath can be read even without blur. */
  background: color-mix(in srgb, var(--curtain-surface) 94%, transparent);
  backdrop-filter: blur(24px) saturate(1.1);
  -webkit-backdrop-filter: blur(24px) saturate(1.1);
  color: var(--curtain-text);
  font-family: ${theme.font};
  animation: curtain-cover-in 150ms ease-out;
}
${C} [data-curtain-cover-panel] {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  max-width: 400px;
  text-align: center;
}
${C} [data-curtain-cover-icon] {
  width: 28px;
  height: 28px;
  margin-bottom: 4px;
  color: var(--curtain-muted);
}
${C} [data-curtain-cover-heading] {
  margin: 0;
  font-family: ${theme.headingFont};
  font-size: 20px;
  font-weight: 600;
  line-height: 1.3;
}
${C} [data-curtain-cover-body] {
  margin: 0;
  text-wrap: balance;
  font-size: 14px;
  line-height: 1.5;
  color: var(--curtain-muted);
}
${C} [data-curtain-cover-actions] {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
  margin-top: 8px;
}
${C} button {
  min-height: 36px;
  padding: 0 16px;
  border-radius: 9999px;
  border: 1px solid var(--curtain-border);
  background: transparent;
  color: var(--curtain-text);
  font: inherit;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}
${C} button[data-curtain-primary] {
  border-color: transparent;
  background: var(--curtain-text);
  color: var(--curtain-surface);
}
${C} button[data-curtain-link] {
  min-height: 32px;
  border-color: transparent;
  color: var(--curtain-muted);
  text-decoration: underline;
  text-underline-offset: 3px;
}
${C} button:hover {
  background: color-mix(in srgb, var(--curtain-text) 8%, transparent);
}
${C} button[data-curtain-primary]:hover {
  background: color-mix(in srgb, var(--curtain-text) 86%, var(--curtain-surface));
}
${C} button:focus-visible {
  outline: 2px solid var(--curtain-text);
  outline-offset: 2px;
}
@keyframes curtain-cover-in {
  from { opacity: 0; }
}
@media (prefers-reduced-motion: reduce) {
  ${C} { animation: none; }
}
`;
}
