---
name: code-reviewer
description: Audits code changes, detects security vulnerabilities, verifies type safety, and enforces idiomatic patterns.
---

# Code Reviewer Skill

## Directives
- Audit all diffs for potential regressions, security risks, memory leaks, and unhandled edge cases.
- Enforce strict TypeScript type safety without unnecessary `any` or loose casting.
- Check Supabase Row Level Security (RLS) policies and ensure database operations do not expose sensitive user data.
- Ensure proper cleanup of event listeners, intervals, and audio contexts in React `useEffect` hooks.
- Validate that all public-facing endpoints and forms sanitize inputs and display clear user feedback.
