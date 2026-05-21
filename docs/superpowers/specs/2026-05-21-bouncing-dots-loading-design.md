# Design Spec: Bouncing Dots Loading Animation

**Date:** 2026-05-21
**Status:** Draft
**Topic:** Replace spinning icon with bouncing dots for Supabase loading state.

## 1. Problem Statement
The current loading screen while waiting for the Supabase connection uses a spinning icon (`RefreshCw` from Lucide React). The user prefers a more modern, smooth "bouncing dots" animation.

## 2. Proposed Solution
We will implement a CSS-driven bouncing dots animation using Tailwind CSS utility classes and a custom animation delay added to the global CSS.

### 2.1 CSS Updates (`src/index.css` or `src/App.css`)
Tailwind includes `animate-bounce`, but we need staggered delays so the dots don't bounce all at the same time. We will add utility classes for animation delays.

- Add `.animation-delay-100` (100ms delay).
- Add `.animation-delay-200` (200ms delay).
- Add `.animation-delay-300` (300ms delay) if needed.

### 2.2 Component Updates (`src/App.jsx`)
Modify the `isLoading` conditional rendering block in `App.jsx`.

- Remove the `RefreshCw` icon.
- Create a container for the dots (e.g., `<div className="flex space-x-2 justify-center">`).
- Add 3 `<div>` elements representing the dots.
- Apply Tailwind classes: `w-4 h-4 bg-blue-600 rounded-full animate-bounce`.
- Apply the custom delay classes sequentially to the 2nd and 3rd dots.

## 3. Implementation Plan

### Phase 1: CSS Setup
1.  Open `src/index.css`.
2.  Add the custom animation delay classes.

### Phase 2: Component Refactor
1.  Open `src/App.jsx`.
2.  Locate the `if (isLoading)` block.
3.  Replace the current loading UI with the new bouncing dots HTML structure.

## 4. Success Criteria
- [ ] The loading screen displays three blue dots.
- [ ] The dots bounce sequentially, creating a wave-like effect.
- [ ] The previous spinning icon is removed.
