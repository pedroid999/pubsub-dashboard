# Self-hosted fonts (FR-025 — local-first, no runtime CDN)

The redesign's brand typefaces are **self-hosted** to honor the local-first /
no-third-party-CDN constraint (constitution Principle I, spec FR-025 / SC-008).
**No `<link>` to Google Fonts or any CDN is permitted at runtime.**

## Required typefaces

Drop the `.woff2` files for these families into this directory, then uncomment
the `@font-face` block at the top of `src/client/styles.css`:

| Family              | Role                                  | Weights            |
| ------------------- | ------------------------------------- | ------------------ |
| Space Grotesk       | UI / titles (`--font-ui`)             | 400, 500, 600, 700 |
| JetBrains Mono      | data / IDs / payloads (`--font-mono`) | 400, 500, 600, 700 |
| Zen Kaku Gothic New | Japanese accent labels (`--font-jp`)  | 500, 700           |

Suggested filenames: `space-grotesk-{400,500,600,700}.woff2`,
`jetbrains-mono-{400,500,600,700}.woff2`,
`zen-kaku-gothic-new-{500,700}.woff2`.

All three are OFL-licensed (SIL Open Font License) — redistribution with the app
is permitted; include the license text alongside the files.

## Current behavior (no binaries present)

`styles.css` currently declares the families with **system-font fallback stacks**
(`--font-ui`, `--font-mono`, `--font-jp`). This is fully local-first (system fonts
are local) and keeps the Vite build green without the binaries. Adding the
`.woff2` files + enabling the `@font-face` block upgrades to full visual fidelity
with **no other code change**.
