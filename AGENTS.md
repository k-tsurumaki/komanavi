# KOMANAVI Agent Guidelines

This document provides instructions for AI agents working on the KOMANAVI codebase.

## 1. Project Overview

KOMANAVI is a Next.js application that simplifies administrative documents. It takes a URL, analyzes it using Vertex AI (Gemini), and generates summaries, checklists, and 4-panel manga explanations.

**Key Technologies:**

- **Framework:** Next.js 16.1 (App Router), React 19
- **Styling:** Tailwind CSS v4
- **Language:** TypeScript (Strict mode)
- **State Management:** Zustand
- **Auth:** NextAuth.js + Firebase Auth
- **AI:** Vertex AI (Gemini 3.0 Flash/Pro)
- **Database:** Firebase (Firestore/Auth)

## 2. Development Commands

### Build & Run

- **Start Development Server:** `npm run dev`
- **Production Build:** `npm run build`
  - _Note:_ Always run this before finishing a task to ensure type safety and build success.

### Linting & Formatting

- **Lint Code:** `npm run lint`
  - Uses ESLint with Next.js and Prettier configs.
- **Format Code:** `npm run format`
  - Uses Prettier.
- **Check Formatting:** `npm run format:check`

### Testing

- **Status:** There are currently **no automated tests** configured in `package.json`.
- **Action:** If adding tests, use a standard framework like Vitest or Jest, but ask the user for preference first. For now, rely on manual verification and `npm run build` / `npm run lint`.

## 3. Code Style & Conventions

### General

- **Strict TypeScript:** `tsconfig.json` has `"strict": true`. Do not use `any`. Define proper interfaces/types for all data structures, especially API responses and intermediate representations.
- **Imports:**
  - Use absolute path aliases: `@/lib/...`, `@/components/...` (configured in `tsconfig.json`).
  - Group imports: React/Next.js -> Third-party -> Local components -> Local utils/types.
- **Formatting:** Adhere to Prettier settings (`.prettierrc`).

### React & Next.js

- **Components:** Use Functional Components with Hooks.
- **Server vs Client:** Explicitly adhere to Next.js App Router patterns. Use `'use client'` directive only when necessary (state, effects, event listeners). Default to Server Components.
- **Styling:** Use Tailwind CSS utility classes. Avoid inline styles or separate CSS files unless necessary for complex animations.

### State Management

- Use **Zustand** for global client state (`src/stores/analyzeStore.ts`).
- Keep server state (data fetching) management simple or use Next.js built-in caching/fetching where appropriate.

### Naming Conventions

- **Files:** `camelCase.ts` or `kebab-case` (follow existing pattern in directory). React components usually `PascalCase.tsx`.
- **Variables/Functions:** `camelCase`.
- **Types/Interfaces:** `PascalCase`.
- **Environment Variables:** `UPPER_CASE` (e.g., `GCP_PROJECT_ID`).

### Error Handling

- **API Routes:** Wrap logic in `try-catch` blocks. Return appropriate HTTP status codes and JSON error messages.
- **UI:** Handle loading and error states gracefully. Use Skeleton loaders where appropriate.

## 4. Architecture & Data Flow

- **Scraping:** `src/lib/scraper.ts` (Cheerio)
- **AI Analysis:** `src/lib/gemini.ts` (Vertex AI SDK)
- **Data Types:** `src/lib/types/intermediate.ts` contains the core `AnalyzeResult` and `IntermediateRepresentation` types. **Refer to this file often.**
- **Authentication:** `src/lib/auth.ts` (NextAuth config).

## 5. Design Principles (from CLAUDE.md)

- **Source Attribution:** Always track and display the source of information.
- **Disclaimers:** Clearly state that AI-generated content may have errors.
- **"Easy Japanese" (やさしい日本語):** Output text should be simple, avoiding jargon, suitable for non-native speakers or elderly users.
- **Accessibility:** WCAG 2.1 Level AA compliance (18px+ font size).

## 6. Language

- **Primary Language:** Japanese (日本語).
- **Comments/Docs:** Japanese is preferred/acceptable for this project.

## 7. Operational Rules for Agents

- **Verify:** Run `npm run lint` and `npm run build` after making significant changes.
- **Safety:** Do not commit secrets. Verify environment variable usage against `.env.example`.
- **Context:** Read `CLAUDE.md` for high-level architectural understanding.
