/**
 * Text shown inside the sites. These move to the extension's message files
 * once they exist, so they can be translated.
 */
export const COVER_TEXT = {
  heading: "This chat is hidden",
  body: "You're in Guest mode. Chats from before this session aren't shown.",
  newChat: "New chat",
  exit: "Exit guest mode",
  reveal: "Show this chat",
} as const;

export type CoverText = Readonly<Record<keyof typeof COVER_TEXT, string>>;

export const MENU_TEXT = {
  turnOn: "Guest mode",
  turnOff: "Exit guest mode",
} as const;
