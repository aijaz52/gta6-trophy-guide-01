# Leonida Ledger

Leonida Ledger is a fan-made checklist and field guide for the 55 Grand Theft Auto VI trophies in the supplied November 18, 2026 source notes. The collection tracks PlayStation trophy tiers and the 1,000 G total for Xbox. Platinum follows automatically once all 54 other rewards have been checked off.

From the repository root, run `node serve.ts` and open [localhost:8080](http://localhost:8080). The app also runs on any static HTTP server. Offline access requires localhost or HTTPS and becomes available after the service worker finishes its first cache setup.

Use the roadmap and tier counters as filters. Press `/` to jump to search. Spoiler cover hides selected names and field notes until you reveal them or mark them collected. The tags reflect editorial choices based on the supplied notes. Read the Chapter 1 meditation note early if you’re planning a full run.

Progress and display settings are saved in this browser. **Export progress** downloads a JSON backup. **Import progress** lets you merge or replace checkmarks and reveals while keeping your current display settings. Existing Ledger v1 and v2 backups are supported.

The catalogue lives in `data/trophies.json`. Each note points to its lines in `TROPHY_SOURCE_NOTES.txt`. Change the cache version in `sw.js` when deploying updates to the offline files.
