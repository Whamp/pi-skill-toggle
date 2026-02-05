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

## Execution Progress

| Task | Status | Notes |
|------|--------|-------|
| 1.1 Extend Type Definitions | ✅ done | Added DisableMode type, updated SkillInfo and SkillToggleResult |
| 1.2 Enhance Frontmatter Parsing | ✅ done | parseFrontmatter now returns disableModelInvocation boolean |
| 1.3 Add Frontmatter Writing Functions | ✅ done | Added setFrontmatterField, removeFrontmatterField, updateSkillFrontmatter |
| 1.4 Update Skill Discovery | ✅ done | loadAllSkills computes mode from both -path and frontmatter |
| 1.5 Update applyChanges Logic | ✅ done | Handles three states, writes to both settings.json and SKILL.md |
| 1.6 Update Theme | ✅ done | Added hidden color (yellow "33") |
| 1.7 Update UI Input Handling | ✅ done | Enter/Space toggles hidden, d toggles disabled |
| 1.8 Update UI Visual Display | ✅ done | Three icons (●/◐/○), updated footer and legend |
| 1.9 Update README | ✅ done | Documented modes, keybindings, updated visual indicators |
| 1.10 Update theme.example.json | ✅ done | Added hidden field |
| 1.11 Commit | ✅ done | Commit e61cb5a |

## Summary

All tasks completed. The extension now supports:
- **Enter/Space**: Toggle between enabled ↔ hidden
- **d**: Toggle between enabled ↔ disabled
- Visual indicators: ● (enabled), ◐ (hidden), ○ (disabled)

Changes require `/reload` or restart to take effect.
