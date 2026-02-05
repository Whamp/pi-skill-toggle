# Pi Skill Toggle

Enable/disable skills from loading into your pi context at startup. Helps reduce context pollution when you have many skills installed.

## Install

```bash
pi install git:github.com/Whamp/pi-skill-toggle
```

Restart pi to load the extension.

## Usage

```
/skills-toggle
```

This opens an interactive overlay where you can:
- **Navigate** with ↑/↓ arrows
- **Filter** by typing
- **Toggle** skills with Enter or Space
- **Save** changes with Ctrl+S
- **Cancel** with Escape

## How It Works

Skills are disabled by adding `-path` entries to the `skills` array in `~/.pi/agent/settings.json`. For example:

```json
{
  "skills": [
    "-skills/brainstorming",
    "-skills/cloud-compute"
  ]
}
```

This uses pi's built-in resource filtering mechanism. Disabled skills:
- Won't appear in your system prompt
- Won't load their frontmatter into context
- Are still visible in the `/skills-toggle` UI (shown as disabled)

**Changes require a restart** (or `/reload`) to take effect.

## Visual Indicators

| Icon | Meaning |
|------|---------|
| ● (green) | Skill is enabled |
| ○ (red) | Skill is disabled |
| * (yellow) | Pending change (not yet saved) |
| ² | Skill has multiple sources (duplicates) |

## Theming

Create `theme.json` in the extension directory to customize colors. Copy `theme.example.json` as a starting point:

```json
{
  "border": "2",
  "title": "2",
  "enabled": "32",
  "disabled": "31",
  "selected": "36",
  "selectedText": "36",
  "searchIcon": "2",
  "placeholder": "2;3",
  "description": "2",
  "hint": "2",
  "changed": "33"
}
```

Values are ANSI SGR codes (e.g., `"36"` for cyan, `"2;3"` for dim+italic).

## Skill Locations Scanned

The extension discovers skills from:
1. `~/.codex/skills/` (recursive)
2. `~/.claude/skills/` (one level deep)
3. `.claude/skills/` (project, one level deep)
4. `~/.pi/agent/skills/` (recursive)
5. `~/.pi/skills/` (recursive)
6. `.pi/skills/` (project, recursive)

## Comparison to pi-skill-palette

| Feature | pi-skill-palette | pi-skill-toggle |
|---------|-----------------|-----------------|
| Purpose | Select skill to inject with next message | Enable/disable skills from loading |
| Persistence | Session only | Persisted in settings.json |
| Effect | Skill content sent with next prompt | Skill removed from context entirely |
| When to use | "I want this skill now" | "I don't need this skill ever" |

Use both together:
- Use `/skills-toggle` to disable skills you rarely use
- Use `/skill` to inject specific skills when needed

## License

MIT
