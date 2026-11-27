# Contributing to Curtain

Thanks for helping. Curtain depends on contributors: ChatGPT, Claude and Gemini change often, and every report and fix keeps Guest mode working for everyone.

## Ways to help

- **Report a site change.** If something hidden shows up, or a page looks broken in Guest mode, open an issue with the [site change form](https://github.com/TFM-HITESH/curtain/issues/new?template=site-change.yml).
- **Pick up an issue.** Issues labelled [`good first issue`](https://github.com/TFM-HITESH/curtain/labels/good%20first%20issue) are scoped for newcomers, and [`help wanted`](https://github.com/TFM-HITESH/curtain/labels/help%20wanted) marks work where help is especially welcome. Comment on an issue before starting, so nobody duplicates effort.
- **Improve the docs**, or help others in [Discussions](https://github.com/TFM-HITESH/curtain/discussions).

Please follow the [code of conduct](CODE_OF_CONDUCT.md) in all project spaces. Report security vulnerabilities privately, as described in the [security policy](SECURITY.md).

## Development setup

You need [Node.js](https://nodejs.org) 24 (see `.nvmrc`) and [pnpm](https://pnpm.io), which [Corepack](https://nodejs.org/api/corepack.html) installs at the pinned version.

```sh
git clone https://github.com/TFM-HITESH/curtain.git
cd curtain
corepack enable
pnpm install
pnpm dev
```

`pnpm dev` builds the extension and opens Chrome with it loaded, rebuilding as you edit.

| Command          | What it does                                             |
| ---------------- | -------------------------------------------------------- |
| `pnpm dev`       | Run the extension in a development browser               |
| `pnpm build`     | Build the production extension into `.output/`           |
| `pnpm test`      | Run the unit tests                                       |
| `pnpm lint`      | Lint, including architecture rules                       |
| `pnpm typecheck` | Type check                                               |
| `pnpm format`    | Format all files                                         |
| `pnpm check`     | Everything CI runs: lint, format, types, tests and build |

## Project structure

```
src/
├── core/         Pure logic: what's visible, session rules, PIN, state. No DOM or browser APIs.
├── platform/     Thin wrappers around browser APIs.
├── engine/       Site-agnostic page machinery: hiding, observing, menus, covers.
├── ui/           Curtain's own interface: in-page components and extension pages.
├── sites/        One folder per supported site, describing it as data.
└── entrypoints/  Extension entry points that wire everything together.
```

Modules depend only inward (`core` → `platform` → `engine` → `ui` → `entrypoints`), and sites never import each other. Other modules are imported only through their alias, such as `@/core`. ESLint enforces these rules, so `pnpm lint` tells you if an import crosses a boundary.

A few principles guide every change:

- **Fail closed.** If Curtain can't tell whether something belongs to the current session, it stays hidden.
- **Never break the host site.** Errors are contained; the site must stay usable.
- **Stable hooks only.** Sites are described with URLs, `data-*` attributes and ARIA roles, never generated class names or visible text.
- **No network, no dependencies.** Curtain makes no network requests and ships no runtime dependencies.

## Commits and pull requests

1. Fork the repository and create a branch from `main`.
2. Make focused changes with tests. Run `pnpm check` before pushing.
3. Open a pull request using the template and link the issue it resolves.

Pull request titles follow [Conventional Commits](https://www.conventionalcommits.org), because each pull request is squashed into one commit on `main` and its title becomes the commit message and the changelog entry:

```
feat(popup): show the number of chats in this session
fix(claude): keep starred chats hidden in Guest mode
docs: explain how to refresh site fixtures
```

Use the site or area as the scope when it helps (`chatgpt`, `claude`, `gemini`, `engine`, `popup`). A CI check enforces the format. Commits on `main` must be signed, and GitHub signs squash merges automatically.

Every pull request runs lint, formatting, type checks, tests, a build, CodeQL and, for workflow changes, zizmor. All checks must pass before merging.

## Privacy in contributions

Never include real chat titles, chat content or personal data in issues, screenshots, test fixtures or commits. Use test accounts with placeholder content.

## License

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE).
