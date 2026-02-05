# Tasks: Add Hidden/Disabled Modes to pi-skill-toggle

## Overview

Enhance pi-skill-toggle to support two disable modes:
- **Hidden**: `disable-model-invocation: true` in frontmatter - skill hidden from system prompt but available via `/skill:name`
- **Fully Disabled**: `-path` in settings.json - skill completely removed from context

## Use Cases

| Mode | When to Use |
|------|-------------|
| **Hidden** | You still want to call the skill manually via `/skill:name` but don't want day-to-day context pollution |
| **Fully Disabled** | You want to clean up your slash command menu so less-used skills don't overwhelm your UI/UX |

---

## Task 1.1: Extend Type Definitions
**Status:** ✅ done
**Notes:** Added DisableMode type, updated SkillInfo and SkillToggleResult

---

## Task 1.2: Enhance Frontmatter Parsing
**Status:** ✅ done
**Notes:** parseFrontmatter now returns disableModelInvocation boolean

---

## Task 1.3: Add Frontmatter Writing Functions
**Status:** ✅ done
**Notes:** Added setFrontmatterField, removeFrontmatterField, updateSkillFrontmatter

---

## Task 1.4: Update Skill Discovery
**Status:** ✅ done
**Notes:** loadAllSkills computes mode from both -path and frontmatter

---

## Task 1.5: Update applyChanges Logic
**Status:** ✅ done
**Notes:** Handles three states, writes to both settings.json and SKILL.md

---

## Task 1.6: Update Theme
**Status:** ✅ done
**Notes:** Added hidden color (yellow "33")

---

## Task 1.7: Update UI Component - Input Handling
**Status:** ✅ done
**Notes:** Enter/Space toggles hidden, d/Ctrl+D toggles disabled

---

## Task 1.8: Update UI Component - Visual Display
**Status:** ✅ done
**Notes:** Three icons (●/◐/○), updated footer and legend

---

## Task 1.9: Update README
**Status:** pending
**Description:** Document the new hidden/disabled modes with use cases
**Files:** README.md
**Criteria:**
- Explains difference between hidden and disabled
- Documents keybindings for each action
- Includes use case examples
- Updates any outdated information

---

## Task 1.10: Update theme.example.json
**Status:** pending
**Description:** Add hidden color to theme example
**Files:** theme.example.json
**Criteria:**
- Includes hidden field with example value

---

## Task 1.11: Test and Commit
**Status:** pending
**Description:** Final verification and commit
**Criteria:**
- TypeScript compiles (peer deps only)
- Git commit with meaningful message

---

## Execution Progress

| Task | Status | Worker | Attempts | Notes |
|------|--------|--------|----------|-------|
| 1.1  | ✅ done | orchestrator | 1 | |
| 1.2  | ✅ done | orchestrator | 1 | |
| 1.3  | ✅ done | orchestrator | 1 | |
| 1.4  | ✅ done | orchestrator | 1 | |
| 1.5  | ✅ done | orchestrator | 1 | |
| 1.6  | ✅ done | orchestrator | 1 | |
| 1.7  | ✅ done | orchestrator | 1 | |
| 1.8  | ✅ done | orchestrator | 1 | |
| 1.9  | ⬜ pending | - | 0 | |
| 1.10 | ⬜ pending | - | 0 | |
| 1.11 | ⬜ pending | - | 0 | |
