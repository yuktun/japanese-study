# Japanese Study

Live prototype: **https://yuktun.github.io/japanese-study/**

Personal Japanese revision archive based on **大家的日本語 (Minna no Nihongo)** and school materials.

## Course mapping

- Year 1 — 初級 I: Lessons 1–20
- Year 2 — 初級 I: Lessons 21–25; 初級 II: Lessons 26–40
- Year 3 — 初級 II: Lessons 41–50; 中級 I: Lessons 1–4
- Year 4 — 中級 I: Lessons 5–12
- Year 5 — 中級 II: Lessons 13–20

## Phase 1

The first migration focuses on:

1. Vocabulary
2. Grammar
3. Filtering by school year / book / lesson
4. Full-text search across all years

## Source-of-truth policy

Priority:

1. School vocabulary / grammar PDFs
2. Textbook
3. Supplementary AI explanation

AI-added material must be explicitly labelled as supplementary and must not overwrite school material.

### Migration completeness

- The school PDF is authoritative for migrated course content.
- Every grammar point must preserve its pattern/source heading and, whenever the school PDF provides them, its Chinese meaning, full explanation, every note or caution, and every example in the original order. A school-derived field must be omitted when the PDF does not explicitly provide it; it must never be inferred to fill a schema field.
- Substantive omissions are not allowed unless the source is unreadable. Unreadable or ambiguous text must be flagged for review instead of guessed.
- Formatting, punctuation, whitespace, and ruby/furigana extraction may be normalized without changing meaning.
- Any AI-added explanation must be clearly marked as supplementary, stored separately from school-derived fields with `contentSource: "ai_derived"`, and kept distinct from school material.
- Grammar records use `sourceOrder` to make their ordering against the source PDF auditable. Supplementary school reference material may be stored in an optional lesson-level `reference.json` file.

### Public source provenance

Public course data records only the source type, the original PDF filename, and an optional page number. Private Google Drive IDs, retrieval mappings, and Google Drive URLs remain outside this repository and its public data files.

## Data structure

```text
data/
  manifest.json
  course-map.json
  year1/
    lesson01/
      vocabulary.json
      grammar.json
      reference.json  # optional school supplementary/reference content
schemas/
  vocabulary.schema.json
  grammar.schema.json
  reference.schema.json
```

The structure is intentionally lesson-based so that the app can browse by school year while still supporting cross-year search.

`data/manifest.json` is the frontend source of truth for available lessons. Add a lesson's metadata and vocabulary and/or grammar path there after its data files are ready; the app discovers all listed lessons automatically.

## Validate lesson data

Run the Node.js standard-library validator before committing data changes:

```bash
node scripts/validate-data.mjs
```

It checks the manifest, referenced files, required fields, lesson metadata, and globally unique item IDs.

## Offline use and updates

Japanese Study is an offline-first PWA. Open the site while online and leave it open until the small status indicator says **已可離線使用**. At that point the app shell, every lesson listed in `data/manifest.json`, lesson reference files, and all conjugation reference data have been verified in the browser cache. You can then add the site to an iPhone Home Screen or use it in a desktop browser and continue studying without a connection.

While offline, the indicator reads **離線模式**. If preparation did not complete, it reads **離線資料未完成**; reconnect and open the app again to retry. iOS can evict website storage when device space is low, so offline access is not permanent and may need to be downloaded again.

The app checks for updates when it opens, returns to the foreground, and reconnects to the internet. A new release is downloaded in the background while the current version remains usable. When it is ready, choose **立即更新** to reload into it, or **稍後** to keep studying; no active review is interrupted automatically. For a manual check, bring the app to the foreground while online, or reload it.

Flashcard answer status, bookmarks, and review progress remain in browser-local storage. They are never placed in the Service Worker cache and are retained through app updates, but they do not automatically synchronize between devices or browsers.

Japanese pronunciation uses the browser's Japanese speech-synthesis voice. It may be available offline only when the device has an offline Japanese voice installed; the app does not download or bundle audio voices.

### PWA release check

Before releasing app changes, update `CACHE_VERSION` in `sw.js` so browsers install a new, fully prepared cache. Then run:

```bash
node scripts/test-offline-inventory.mjs
```

The service worker keeps the current and immediately previous completed cache during a transition. It never activates a partially downloaded cache or clears browser-local review records.
