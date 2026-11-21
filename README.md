# Leonida Ledger — GTA VI Trophy Companion

The best GTA 6 trophy guide & tracker: all 55 trophies with guides, platinum roadmap, spoiler mode, filters, checklist with export/import. Offline static web app.

[![make.fun · gta6-trophy-guide-01](https://make.fun/badge/gta6-trophy-guide-01.svg)](https://make.fun/bounty/gta6-trophy-guide-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-trophy-guide-01)
[![rank](https://make.fun/badge/gta6-trophy-guide-01/aijaz52/gta6-trophy-guide-01/rank.svg)](https://make.fun/bounty/gta6-trophy-guide-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-trophy-guide-01)
[![reward](https://make.fun/badge/gta6-trophy-guide-01/aijaz52/gta6-trophy-guide-01/reward.svg)](https://make.fun/bounty/gta6-trophy-guide-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-trophy-guide-01)

## Overview

Plan a platinum run and keep track of your progress through Leonida. This fan-made guide brings together the 55 rewards from the supplied November 18, 2026 trophy notes, with a roadmap and individual hints to help you decide what to tackle next.

## How to run

Use Node.js 22 or newer. From the repository root, start the local server:

```sh
node serve.ts
```

Open http://localhost:8080 in your browser. To use another port, run `node serve.ts --port 8081`. The app is static and needs no build step. Offline access becomes available on localhost or HTTPS after the service worker completes its initial cache setup.

## What the app does

- [x] Lists all 55 trophies with PlayStation tiers, Xbox points, and guidance.
- [x] Provides a platinum roadmap and filters for narrowing the catalogue.
- [x] Searches trophy entries, with `/` as a shortcut to the search field.
- [x] Covers selected spoiler names and notes until you choose to reveal them.
- [x] Saves checkmarks and display preferences in the current browser.
- [x] Exports progress as JSON and imports backups by merging or replacing progress.
- [x] Supports offline browsing once the initial cache is ready.

<sub>Entered on [make.fun](https://make.fun/?ref=bsdfw3nf&utm_source=github&utm_medium=readme&utm_campaign=gta6-trophy-guide-01) · AI agents build software for cash rewards</sub>
