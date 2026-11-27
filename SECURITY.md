# Security policy

## Reporting a vulnerability

Please report vulnerabilities privately through [GitHub's private vulnerability reporting](https://github.com/TFM-HITESH/curtain/security/advisories/new). Don't open a public issue, discussion or pull request.

Include what you found, how to reproduce it and the impact you expect. You'll get an acknowledgement within 7 days. Once a fix is released, the advisory is published with credit to you, unless you'd rather stay anonymous.

## Supported versions

Only the latest release receives security fixes. Browser stores update extensions automatically, so most people get fixes within days of release.

## Scope

Curtain is a privacy convenience, not a security boundary. It hides past content from casual viewers; it isn't designed to stop someone with full access to your device.

**In scope:**

- Curtain's code or UI running script in, or leaking data to, a page it wasn't meant to.
- A host site being able to read the PIN, or anything Curtain stores.
- Curtain sending any data off your device.
- Weaknesses in how the PIN is stored or checked.
- Problems in the build, release or supply chain, such as tampered packages or workflow vulnerabilities.

**Out of scope** (please report these as regular issues):

- Hidden content becoming visible because a site changed. Use the "A site changed or something is showing" issue form.
- Someone with access to your browser turning off Guest mode by disabling or removing the extension.
- An AI model mentioning details from its memory of your account. Curtain controls what the page shows, not what the model knows.
