# Pi Skill Toggle

I have a confession to make. I'm a skill hoarder. We moved from MCP servers polluting our context to now the irresistible urge to gather and hoard skills that then do the same once you gather enough of them. The problem is I'm afraid to remove them and forget that they exist, and it's a pain to re-enable them when needed for a specific use case. So I created this project inspired by [Pi Skill Palette](https://github.com/nicobailon/pi-skill-palette) that lets me enable and disable all the SKILLs I have without them disappearing from my visual memory, but still maintaining control over what gets pumped into my context.

Full credit to [nicobailon](https://github.com/nicobailon) for pi-skill-palette which was the foundation of this. I just pointed my clanker at that project and basically said "make that project but have it toggle skills instead."

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

## License

MIT
