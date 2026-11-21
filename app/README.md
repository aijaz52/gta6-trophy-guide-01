# The Leonida Ledger

A personal GTA VI field guide with a 55-entry checklist, six-stage platinum route, spoiler controls and portable progress. The interface is plain HTML, CSS and browser JavaScript. Its illustrated coast and trophy cups are drawn in CSS; the app needs no downloaded libraries, fonts or images.

Start the local server from the repository root with `node serve.ts`, then visit `http://localhost:8080`. Use an HTTP origin because the browser loads modules and the local JSON catalogue. A successful first visit installs a service worker where supported; wait for “OFFLINE READY” before closing the server. Deployment updates must change the versioned shell cache in `sw.js`.

## Using the checklist

Search by name, unlock condition or guide text. Combine the collection tabs with a tier and a roadmap stage. Sort by the suggested route, source position, name, tier, points or unearned status. Grid and list layouts show the same checklist. Clear filters restores the whole collection.

Open any visible trophy for its route, caveats and citations. Spoiler protection starts enabled and masks editorially hidden trophies, including their search terms. You can reveal one entry, hide it again in its guide, or switch protection off for the collection. Earned entries remain visible. The platinum checkmark follows the other 54 entries automatically.

The `/` key focuses search. Escape clears a search or closes a native dialog. Tab navigates controls and Space activates checkboxes. Arrow keys, Home and End move among displayed trophy checkboxes. Updates preserve the active checkbox or stage where possible. Responsive layouts and reduced motion are supported.

## Catalogue and source boundaries

`data/trophies.json` is a freshly authored catalogue based on `../TROPHY_SOURCE_NOTES.txt` dated November 18, 2026. It has 1 platinum, 2 gold, 6 silver and 46 bronze entries. The 54 numerical Xbox rewards total 1,000G; the Mythic equivalent of platinum has no supplied number and is represented by zero points. Descriptions are paraphrased unlock conditions, with explicit labels for the few entries whose requirements remain undisclosed.

Each trophy carries its source line range, original reward name, guide instructions and any unresolved detail. The notes attribute an approximately 200-hour estimate and replay limitations to GTABase. These are supplied claims, not independently checked game facts. Citations are presented locally and do not trigger external requests.

The source mentions approximately 28 hidden rewards without an individual list. This catalogue assigns exactly 28 editorial spoiler flags, which should not be read as platform metadata. Positive Mental Attitude is marked potentially missable because the early meditation requirement is uncertain. Unconfirmed methods and the bowling venue naming conflict remain visible caveats. No player rarity statistics are supplied.

## Keeping progress

The `leonida-ledger-v1` localStorage record holds earned IDs, individual reveals, preferences and an export timestamp. Existing records use the same stable trophy IDs. The older `gta6-trophy-checklist` array is migrated on load; imports also accept legacy names or one-based catalogue numbers.

Export downloads a version 1 JSON backup. Import validates the entire file and then offers merge or replace. Both modes apply checkmarks and reveals while keeping this device’s display preferences. Invalid input leaves the checklist intact. Storage failures produce an export reminder, and other tabs receive changes through browser storage events. Clearing browser storage removes the local copy.

## Packaging

`node main.ts` copies `app/` and `screenshots/` to the selected output directory and writes the canonical dossier with the existing vendored `buildDossier` function. Set `MAKEFUN_OUTPUT_DIR` to choose a local destination. The app itself requires no compilation.
