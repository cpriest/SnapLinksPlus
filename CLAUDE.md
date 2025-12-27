# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Snap Links Plus is a browser extension (Firefox & Chrome) that allows users to lasso links, checkboxes, and other elements on web pages to perform batch actions. Built using WebExtension APIs with a content script architecture.

## Build System

The project uses **Gulp** as its build system with Handlebars templates for generating browser-specific manifests.

### Common Commands

```bash
# Build for both Firefox and Chrome
npm run build
# or
gulp

# Watch mode (auto-rebuilds on file changes, includes Dev* files)
gulp watch

# Run Firefox with extension loaded
npm run run-ff

# Lint JavaScript
npm run lint

# Fix lint issues automatically
npm run lint-fix

# Run tests
npm test
```

### Build Process

1. `buildTmp()` - Copies source files to `./build/tmp/` (excludes test files, JetBrains files, Dev files, Playground files)
2. `buildChrome()` / `buildFirefox()` - Copies from tmp to browser-specific build directory and generates manifest.json from Handlebars template
3. Output directories:
   - Chrome: `./build/chrome/`
   - Firefox: `./build/ff/`
   - Artifacts: `./artifacts/chrome/` and `./artifacts/ff/`

### Browser-Specific Building

The manifest template (`src/templates/manifest.hbs`) uses Handlebars conditionals (`{{#Chrome}}`, `{{#Firefox}}`, `{{#DevBuild}}`) to generate browser-specific configurations. Chrome requires a `browser-polyfill.js` for WebExtension API compatibility.

**Important:** The `!**/Dev*` exclusion in gulpfile.js is removed for `gulp watch`, allowing development-only files to be included in watch builds.

## Architecture

### Content Script Architecture

The extension uses a **content script** architecture that runs in every web page. Content scripts are loaded in this order (see `src/templates/manifest.hbs`):

1. `browser-polyfill.js` (Chrome only)
2. `StoragePrefs.js` - Preference management with sync/local storage
3. `CSP.js` - Custom Pub/Sub system for inter-component communication
4. `globals.js` - Global constants, default preferences, and utilities
5. `Utility.js` - Helper functions
6. `SelectionRect.js` - Visual selection rectangle rendering
7. `ElementIndexer.js` - Spatial indexing of DOM elements
8. `SvgOverlay.js` - SVG overlay management for visual feedback
9. `CategorizedCollection.js` - Grouping selected elements by type
10. `ActionMgr.js` - Handles actions on selected elements
11. `EventHandler.js` - Main event coordination (mousedown, mousemove, etc.)

### Background Script

Located in `src/background-scripts/background.js`, handles:
- Opening URLs in tabs with configurable behavior (TABS_OPEN_END, TABS_OPEN_RIGHT, TABS_OPEN_NATURAL)
- Clipboard operations
- Extension reload (DevMode only)

### Pub/Sub Event System (CSP.js)

Components communicate via a lightweight publish/subscribe system defined in `CSP.js`:

- `pub(channel, message)` - Publish message to channel
- `sub(channel, handler)` - Subscribe to channel, returns cancellation controller

**Key channels** (defined in `globals.js`):
- `DragRectChanged`, `DragCompleted`, `DragStarted` - Published by EventHandler
- `DocSizeChanged`, `ElementPositionsChanged` - Document layout changes
- `ContainerElementCreated` - Published by SelectionRect
- `ElementsSelected` - Published by ElementIndexer

### Global State

Key globals defined in `globals.js`:
- `Prefs` - StoragePrefs instance with all user preferences
- `DOMReady` - Promise that resolves when prefs are loaded
- Mouse button constants: `LMB`, `RMB`, `MMB`
- Modifier key constants: `NONE`, `CTRL`, `ALT`, `SHIFT`
- Action constants: `OPEN_URLS_IN_TABS`, `COPY_TO_CLIPBOARD`, `RELOAD_EXTENSION`

Global references in `EventHandler.js`:
- `SnapLinks` - The main EventHandler instance
- `ElemDocRects` - RectMapper cache for element positions
- `SvgOverlay` - SvgOverlayMgr for visual overlays
- `LastModifierKeys` - Bitmask of last modifier keys pressed

### Preference Management

`StoragePrefs.js` provides a reactive preference system that:
- Overlays browser storage (sync or local) on top of defaults
- Auto-detects storage API availability (falls back from sync to local)
- Provides `onChanged()` callbacks for preference updates
- Preference migrations handled in `globals.js` via `MigratePrefs()`

## Code Conventions

- All JavaScript is ES6+ (`ecmaVersion: 2020`)
- Uses jQuery ESLint config extended with custom rules in `./eslint/index.js`
- JSDoc type annotations used throughout (see `@typedef` in globals.js)
- Strict mode (`'use strict';`) in all files
- Global variables `_` and `__` reserved for general purpose use
- Uses WebExtension Polyfill for Chrome compatibility (`webextension-polyfill` package)

## Testing

- Jest for unit tests (config: `jest.config.js`)
- Tests located in `./tests/` directory
- Manual test HTML files in `./test/` directory (e.g., `test_links.html`)
- Integration tests in `./tests/integration/`

## Development Notes

- `DevNotes.md` contains active feature plans, bugs, and todos
- DevMode features (Ctrl+Alt+RMB to reload extension) only available in watch builds
- Selection uses spatial indexing with configurable buckets (`IndexBuckets` pref)
- Element visibility detection checks for obscured elements
- SVG-based visual feedback system for selection and highlights
