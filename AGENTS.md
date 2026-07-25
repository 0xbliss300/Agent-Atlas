# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

## Durable design decisions

- The application remains local-only and must not be deployed as a hosted service that carries user data. Its source code may be published and maintained at `https://github.com/0xbliss300/Agent-Atlas`.
- The global footer links to the official open-source repository and identifies the owner as `0xbliss300`.
- The product name is **Agent Atlas**. Its brand mark combines an editorial index book, a subtle A-shaped negative space, and a central compass/node point in cobalt blue on warm paper; the generated source and optimized application icon live under `public/`.
- Use a two-level information architecture: the homepage is a concise overview of all Agent projects; selecting a project opens its dedicated detail view.
- The selected visual target is the light editorial “Research Project Index” concept: warm paper background, cobalt blue accents, serif Chinese display type, monospaced metadata, restrained borders, and a 2×2 grid of standalone project cards.
- The user currently has no real projects. The product should start with an honest empty state rather than presenting development fixtures as real projects.
- The project workflow is local-only: user-created projects persist in versioned browser storage and support create/edit/copy/delete plus JSON backup/restore without uploading data.
- Local navigation uses Hash routes so overview, notes, project details, missing routes, refresh, and browser history remain stable without a server rewrite rule.
- The top-level Research Notes entry is a dedicated view with project-scoped Markdown documents that developers can create, edit, and preview in-browser without a remote rendering service. Short development logs and full research notes remain distinct data; Markdown rendering uses `react-markdown` plus GFM, does not execute raw HTML or dangerous URLs, and loads only when a note reader/editor route is opened.
- Display preferences are versioned local settings: completed-project visibility, sorting, density, and recent-update visibility.
- The overview supports local search, status filtering, and persistent sorting. Project details include blockers, directly checkable next tasks, and a technical profile.
- Local status reading is user-initiated and read-only: JSON, Markdown, package.json, or an explicitly selected directory may update a project after preview; never scan unselected paths, upload contents, or persist file-system handles.
- Creating a project from local sources uses the same explicit, read-only authorization boundary: infer a draft from whitelisted files, label detected/uncertain/missing fields, require editable confirmation, preserve source metadata in backups, and never retain handles or invent absolute paths.
- The approved roadmap through TODO-049 covers local Codex Markdown context packs, bounded note drafts/history, a global workbench, bounded project change events, safe project/note templates, project organization, and an in-app Markdown usage guide.
- All approved roadmap features remain local-first: generated Codex context is previewed then copied/downloaded by the user, drafts and histories have retention limits, timelines do not duplicate full note bodies, templates exclude local paths and history by default, and deleting organizational metadata never deletes project content.
- Projects may use bounded normalized tags, stable pinned-first sorting, and multiple custom collections. Collections use independent versioned local storage, can filter both the overview and workbench, participate in JSON backup/restore with conflict remapping, and are detached rather than deleting project content when removed.
- The product should include an in-app Chinese usage guide sourced from a standalone Markdown file and rendered through the existing safe Markdown pipeline. Its content must describe only verified current behavior, remain local/static rather than entering user backups, and stay synchronized with user-visible feature changes.
- The UI is split across `src/components/`, `src/pages/`, `src/hooks/`, and `src/utils/`; keep `App.jsx` focused on state and orchestration.
- Run `npm run check` for the full quality gate. As of 2026-07-25, it includes React-aware ESLint, Prettier, 89 Node unit tests, 41 Vitest component tests, and the Vite production build.

## Persistent task tracking

- Before any development work, read `PROJECT_TODO.md` and identify the task IDs in scope.
- Do not mark a task complete until its acceptance criteria have been verified.
- After completing or partially completing development work, update `PROJECT_TODO.md` with the current checkbox, progress, completion date, and validation result.
- Record newly discovered work in `PROJECT_TODO.md` with a new task ID so later Codex sessions can retrieve it.
