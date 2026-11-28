/**
 * Keeping a past chat's title out of the tab bar.
 *
 * Sites name the tab after the open chat, so even a covered chat would show
 * its title. While hidden, the tab shows a neutral title such as "ChatGPT".
 * Sites keep rewriting the title as they load, so any change is noted and the
 * neutral title put back. When the page may show again, the title the site
 * last asked for comes back.
 */

export interface TitleGuard {
  /** Shows `neutral` in the tab until `show` is called. */
  hide(neutral: string): void;
  /** Puts back the title the site wants. */
  show(): void;
  readonly hidden: boolean;
}

export function createTitleGuard(doc: Document = document): TitleGuard {
  let neutral: string | null = null;
  let siteTitle = doc.title;
  /** The title we last wrote, so it's never mistaken for the site's. */
  let written: string | null = null;
  let observer: MutationObserver | null = null;

  /** Sets the title, once there's a <head> to hold it. */
  function setTitle(value: string) {
    if (doc.querySelector("head") !== null) doc.title = value;
  }

  function enforce() {
    if (neutral === null || doc.title === neutral) return;
    if (doc.title !== written) siteTitle = doc.title;
    setTitle(neutral);
    written = neutral;
  }

  return {
    hide(title) {
      if (neutral === null) siteTitle = doc.title;
      neutral = title;
      enforce();
      if (!observer) {
        observer = new MutationObserver(enforce);
        // The <title> element can be replaced, edited or added later. Early
        // on, <head> may not exist yet.
        observer.observe(doc.querySelector("head") ?? doc.documentElement, {
          childList: true,
          subtree: true,
          characterData: true,
        });
      }
    },
    show() {
      if (neutral === null) return;
      observer?.disconnect();
      observer = null;
      neutral = null;
      written = null;
      setTitle(siteTitle);
    },
    get hidden() {
      return neutral !== null;
    },
  };
}
