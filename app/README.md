# Leonida Ledger

A static, offline GTA VI trophy guide and tracker. No build, packages, remote requests, fonts, or image assets are required. The sunset, skyline, palms, and trophy emblems are CSS.

From the repository root:

```sh
node serve.ts
```

Open `http://localhost:8080`. ES modules and local JSON need an HTTP origin; opening `index.html` directly from the filesystem is not supported. After the first successful load, the service worker caches the app for offline reloads in supporting browsers. Serve a new version with a new cache name in `sw.js` when updating deployed assets.

## Data

`data/trophies.json` follows `../TROPHY_SOURCE_NOTES.txt` as supplied. All 55 names, tiers, conditions, and G values are retained, with rewritten guide steps and source-line references. Total rewards: 1 platinum, 2 gold, 6 silver, 46 bronze, and 1,000G. The platinum equivalent has no numerical G specified and uses `points: 0`.

The source explicitly labels only some descriptions as official. These use `descriptionType: "official"`; other descriptions use the supplied unlock condition and `descriptionType: "source-condition"`. Both are labeled accurately in the detail panel.

The source says approximately 28 trophies are hidden without identifying them individually. The 28 `hidden` / `secret` flags are editorial spoiler protection, disclosed in the UI and data metadata. They are not represented as a verified platform hidden list. The sole `missable` flag is a precaution for Positive Mental Attitude; the source leaves the Chapter 1 meditation requirement unconfirmed. Unknown unlock methods and conflicting venue names are preserved as caveats rather than invented solutions. Colors indicate tiers; player rarity percentages are not supplied.

## Progress

- Storage key: `leonida-ledger-v1`. The original `gta6-trophy-checklist` name-array format is migrated automatically.
- Export includes version, game, earned trophy IDs, individual reveals, display preferences, and timestamp.
- Import validates the entire file before offering Merge or Replace. Both options import earned and revealed sets; the current device's spoiler and display preferences are retained.
- Legacy name arrays and numeric-ID arrays are accepted. Invalid files never change current progress.
- Platinum is derived automatically from the other 54 trophies and is removed if any prerequisite is unchecked.
- Storage errors show a session-only notice and recommend export. Other tabs synchronize through the storage event.

## Navigation

Use the sidebar, five collection filters, tier totals, tier selector, roadmap stages, search, sorting, and grid/list toggle. Roadmap stages also filter the checklist. Clear filters resets search, tier, stage, and collection filter together.

Spoiler protection starts on. Hidden names and guides are excluded from search until earned, individually revealed, or globally unprotected. Individual reveals persist and can be hidden again from the guide. The global switch keeps earned and individually revealed trophies visible.

Press `/` to focus search, Tab to navigate, Space to check a trophy, and Escape to close a guide. Dialogs use native focus containment; checklist and roadmap focus are retained after updates. Reduced-motion preferences are respected.

Sources are displayed as offline citations with local source-line references. The application does not fetch or embed material from the cited sites. It contains no telemetry or account system.
