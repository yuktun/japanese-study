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

## Data structure

```text
data/
  course-map.json
  year1/
    lesson01/
      vocabulary.json
      grammar.json
schemas/
  vocabulary.schema.json
  grammar.schema.json
```

The structure is intentionally lesson-based so that the app can browse by school year while still supporting cross-year search.
