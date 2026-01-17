# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

KOMANAVI (コマナビ) is a government document visualization application that simplifies complex administrative documents for citizens. The app takes government webpage URLs as input and generates easy-to-understand summaries, checklists, and optionally manga-style visual explanations.

## Technology Stack (Planned)

- **Frontend/Backend**: Next.js (App Router) with TypeScript
- **Hosting**: Vercel
- **Database**: Vercel Postgres
- **Cache**: Vercel KV (Redis)
- **LLM**: Claude API for document analysis and summarization
- **Styling**: Tailwind CSS
- **State Management**: Zustand or Jotai

## Architecture

The system processes government documents through this flow:
1. URL input → Page scraping → Intermediate representation (JSON) → Summary/Checklist generation
2. Results are cached by URL hash for 24-72 hours
3. Manga generation (Phase 2) will be async with job queue

### Key Data Structure

The intermediate representation is a structured JSON containing:
- `title`, `summary`: Document identification
- `target.conditions`, `target.exceptions`: Eligibility criteria
- `procedure.steps`, `procedure.required_documents`: Action items
- `sources`: References to original text for verification
- `personalization.questions`: Dynamic questions for customization

## Development Phases

- **Phase 1 (MVP)**: URL input, page analysis, summary generation, checklist, caching, personalization
- **Phase 2**: Manga generation (template-based), history, feedback collection
- **Phase 3**: Multi-language support, audio, SNS sharing, API publication

## Target Users (Priority Order)

1. **High Priority**: Single parents, elderly caregivers, foreign residents, disaster victims - requires simplest UI, large fonts (18px+), no jargon
2. **Medium Priority**: New parents, newcomers, unemployed - step-by-step guidance
3. **General**: Regular citizens - standard UI

## Key Design Principles

- Always show source references linking back to original government text
- Display disclaimer that this is reference information only
- Include last-updated timestamp prominently
- Prioritize accessibility (WCAG 2.1 Level AA target)
- Use "やさしい日本語" (easy Japanese) for first-priority users

## Development Workflow

各タスク完了後は以下の手順を実行すること:

1. **コードレビュー**: `npm run lint` でリントエラーがないことを確認
2. **動作確認**: `npm run build` でビルドが成功することを確認
3. **コミット**: 適切な粒度でコミットを作成

## Language

Primary development and user interface language is Japanese. Comments and documentation may be in Japanese.
