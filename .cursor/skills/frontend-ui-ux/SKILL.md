---
name: frontend-ui-ux
description: Designs production-ready frontend UI/UX for data-dense products with a polished, non-generic look. Use when building or refining trading, dashboard, analytics, or operational interfaces where readability, hierarchy, and trust are more important than decorative effects.
---

# Frontend UI/UX for Trading Products

Build interfaces that feel premium and intentional without looking overdesigned or "AI-generated."

Prioritize:
- clarity of information
- actionability
- consistency
- accessibility
- implementation realism

---

# Work Principles

1. Complete the requested scope; do not introduce unrelated visual experiments.
2. Keep the UI in a working state and verify behavior after changes.
3. Follow existing project patterns and design language unless explicitly redesigning.
4. Prefer reusable, maintainable component structure over one-off styling.
5. Explain decisions with concrete reasons (hierarchy, readability, conversion, accessibility).

---

# Design Process

Before coding, define:

1. **Screen goal**: What must the user decide or execute here?
2. **Primary actions**: Which 1-2 actions matter most?
3. **Information priority**: What must be visible first, second, third?
4. **Constraints**: Framework, performance, accessibility, localization, device.

Then produce implementation-ready UI specs and code that are:
- production-grade and functional
- visually refined but restrained
- consistent across states and breakpoints
- easy to scan in high-density contexts

Use React + Tailwind as default unless the user specifies otherwise.

---

# Product UI Guidelines

## Typography

- Favor highly readable fonts and stable rendering.
- Use a clear type scale (headline, title, body, caption) with consistent line-height.
- Avoid overly expressive display fonts in data-heavy screens.
- Numeric data should use tabular numerals when available.

## Color

- Use a restrained palette with a clear semantic system:
  - neutral for structure
  - one primary accent for key actions
  - semantic colors for success/warning/error
- Ensure contrast and legibility in both normal and dense tables/cards.
- Use gradients only when they communicate hierarchy, not decoration.

## Motion

- Keep motion purposeful and short (typically 120-220ms).
- Prefer subtle transitions for hover/focus/expand states.
- Avoid dramatic entrance animations in core workflows.
- Performance and clarity outrank visual novelty.

## Layout & Spacing

- Use predictable grid and spacing rhythm (8px base scale).
- Keep alignment strict across titles, filters, tables, and action bars.
- For complex pages: separate scan zones (controls, summary, details, logs).
- Preserve enough whitespace for readability without wasting vertical space.

## Data-Dense Components

- Tables/lists must optimize scan speed:
  - strong column labeling
  - consistent numeric alignment
  - meaningful default sorting
  - concise row actions
- States are required: loading, empty, error, partial-data, disabled.

---

# Anti-Patterns (Never)

- Decorative effects that reduce readability (heavy blur/glow/noise/mesh).
- Random visual experimentation not tied to task goals.
- Low-contrast text, ambiguous hierarchy, or unclear click targets.
- Inconsistent spacing/type scales across components.
- Over-animating critical workflows.

---

# Execution

Match implementation depth to user request:
- **Quick polish**: Improve hierarchy, spacing, states, and token usage.
- **Component redesign**: Provide spec + updated component implementation.
- **Screen redesign**: Deliver structure, interaction model, and responsive behavior.

When providing output, include:
1. Design intent (goal + primary user action)
2. Layout spec (sections + spacing rhythm)
3. Typography and color tokens
4. Component state definitions
5. Accessibility checks
6. Tailwind mapping notes (implementation guidance)

Default style: polished, modern, restrained, trustworthy.