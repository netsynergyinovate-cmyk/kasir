# Bouncing Dots Loading Animation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the spinning loading icon with a staggered "bouncing dots" animation.

**Architecture:** 
1. Add `.animation-delay-*` utility classes to the global stylesheet.
2. Replace the `RefreshCw` icon in `App.jsx` with three `div` elements styled with Tailwind's `animate-bounce` and the new delay classes.

**Tech Stack:** React 19, Tailwind CSS.

---

### Task 1: Add Animation Delay Utilities

**Files:**
- Modify: `src/index.css`

- [ ] **Step 1: Add CSS utility classes**
  - Append the custom animation delay classes at the end of the file.

```css
/* ... existing content ... */

.animation-delay-100 {
  animation-delay: 100ms;
}

.animation-delay-200 {
  animation-delay: 200ms;
}

.animation-delay-300 {
  animation-delay: 300ms;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/index.css
git commit -m "style: add animation delay utilities for bouncing dots"
```

### Task 2: Refactor Loading UI

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Update the isLoading block**
  - Locate the `if (isLoading)` block.
  - Remove `<RefreshCw />`.
  - Add the three bouncing dots.

```jsx
// Find this block:
  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 text-blue-600">
        <div className="flex space-x-2 mb-4">
          <div className="w-4 h-4 bg-blue-600 rounded-full animate-bounce"></div>
          <div className="w-4 h-4 bg-blue-600 rounded-full animate-bounce animation-delay-100"></div>
          <div className="w-4 h-4 bg-blue-600 rounded-full animate-bounce animation-delay-200"></div>
        </div>
        <p className="font-bold animate-pulse">Menghubungkan ke Supabase...</p>
      </div>
    );
  }

// Remove the import if it's no longer used anywhere else:
// import { Menu, Building2, RefreshCw } from 'lucide-react';
// Change to:
// import { Menu, Building2 } from 'lucide-react';
```

- [ ] **Step 2: Remove unused import**
  - If `RefreshCw` is no longer used, remove it from the `lucide-react` import statement.

- [ ] **Step 3: Commit**

```bash
git add src/App.jsx
git commit -m "feat: implement bouncing dots loading animation"
```
