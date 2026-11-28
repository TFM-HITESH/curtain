/**
 * Rules for the CSS selectors in site definitions.
 *
 * Sites ship new builds all the time. Generated class names change with every
 * build, and visible text changes with every language, so selectors may only
 * rely on things that are there for the app's own logic: element types,
 * `data-*` attributes, ARIA roles and states, and link URLs.
 */

/** Attributes that are stable across builds and languages. */
const ALLOWED_ATTRIBUTES = new Set(["role", "href", "id", "type"]);

/** ARIA attributes whose values are translated text, so they change by language. */
const TEXT_ATTRIBUTES = new Set([
  "aria-label",
  "aria-description",
  "aria-placeholder",
  "aria-roledescription",
  "aria-valuetext",
]);

/** Pseudo-classes that only look at document structure or state. */
const ALLOWED_PSEUDO_CLASSES = new Set([
  "not",
  "is",
  "where",
  "has",
  "first-child",
  "last-child",
  "only-child",
  "first-of-type",
  "last-of-type",
  "only-of-type",
  "nth-child",
  "nth-last-child",
  "nth-of-type",
  "nth-last-of-type",
  "empty",
  "scope",
]);

function isAllowedAttribute(name: string): boolean {
  if (name.startsWith("data-")) return true;
  if (name.startsWith("aria-")) return !TEXT_ATTRIBUTES.has(name);
  return ALLOWED_ATTRIBUTES.has(name);
}

/** Replaces quoted strings with empty ones, so their contents can't confuse the checks. */
function withoutStrings(selector: string): string {
  return selector.replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, '""');
}

/**
 * Lists what's wrong with a selector, or returns an empty list if it only uses
 * stable hooks.
 */
export function selectorProblems(selector: string): string[] {
  const problems: string[] = [];
  if (selector.trim() === "") return ["is empty"];

  const unquoted = withoutStrings(selector);

  for (const [, name = ""] of unquoted.matchAll(/\[\s*([^\s~|^$*=\]]+)/g)) {
    if (!isAllowedAttribute(name.toLowerCase())) {
      problems.push(`uses the "${name}" attribute`);
    }
  }

  // Everything outside attribute brackets.
  const outside = unquoted.replace(/\[[^\]]*\]/g, "");
  if (/\.[A-Za-z_-]/.test(outside)) problems.push("uses a class name");
  if (/#[A-Za-z_-]/.test(outside)) problems.push("uses an ID selector");

  for (const [, name = ""] of outside.matchAll(/(?<!:):([a-z-]+)/gi)) {
    if (!ALLOWED_PSEUDO_CLASSES.has(name.toLowerCase())) {
      problems.push(`uses the ":${name}" pseudo-class`);
    }
  }

  return problems;
}
