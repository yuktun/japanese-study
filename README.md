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
