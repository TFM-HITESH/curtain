# Curtain

**Guest mode for ChatGPT, Claude and Gemini.**

Curtain is a browser extension that lets you hand over your AI chat, or share your screen, without showing your history. Turn on Guest mode and the site looks like a fresh account: your past chats, projects and saved content step out of view, while everything you create in the session works and saves as usual. Turn it off (optionally with a PIN) and everything is back, including what was made in the meantime.

> [!NOTE]
> Curtain is in early development and not yet available in browser stores. Follow the repository for the first release.

## Why

AI chat apps title every conversation from its content and keep them all in the sidebar. A screen share, a live demo or a borrowed laptop can show far more than you meant to. Logging out isn't a real answer: it means signing back in (often with 2FA), and the person you're helping loses access to your plan's features.

Curtain is built for moments like these:

- **Screen sharing and demos.** Show the chats you mean to show, nothing else.
- **Handing over your device.** Let a friend use your account without browsing your history.
- **Sharing a subscription for a while.** Lend your paid plan at a hackathon, then pick up where you left off, with the new chats included.

## How it will work

- **One click to turn on, a PIN to turn off.** The PIN is optional.
- **Only the session is visible.** New chats appear normally. Older chats, projects, libraries, memory and account settings aren't shown.
- **Show chats on purpose.** Mark the chats you want to keep visible in Guest mode ahead of time.
- **Looks like it belongs.** Controls are built into each site's own menus and styling, not bolted on.

## Principles

- **Private by design.** No network requests, no analytics, no remote code. Everything stays in your browser.
- **Minimal permissions.** Storage, plus access to chatgpt.com, claude.ai and gemini.google.com. Nothing else.
- **Fails safe.** If a site changes in a way Curtain doesn't recognise, content stays hidden rather than leaking.
- **Honest scope.** Curtain spares you awkward moments with people you trust. It isn't a security tool and won't stop someone determined.

## Supported platforms

|                               | Status         |
| ----------------------------- | -------------- |
| Chrome, Edge, Brave (desktop) | In development |
| Firefox                       | Planned        |
| ChatGPT · Claude · Gemini     | In development |

## Verifying a release

Every [release](https://github.com/TFM-HITESH/curtain/releases) is built by GitHub Actions from a tagged commit and attaches the extension zip, a `SHA256SUMS.txt` file and a signed build provenance attestation. The zip in each browser store is the same file.

To check that a zip was built from this repository's source, use the [GitHub CLI](https://cli.github.com):

```sh
gh attestation verify curtain-0.1.0-chrome.zip --repo TFM-HITESH/curtain
sha256sum --check --ignore-missing SHA256SUMS.txt
```

## License

[MIT](LICENSE)

Curtain is an independent project and is not affiliated with, endorsed by or sponsored by OpenAI, Anthropic or Google. ChatGPT, Claude and Gemini are trademarks of their respective owners.
