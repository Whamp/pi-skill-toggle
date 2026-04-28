# Pi Skill Toggle

I have a confession to make. I'm a skill hoarder. We moved from MCP servers polluting our context to now the irresistible urge to gather and hoard skills that then do the same once you gather enough of them. The problem is I'm afraid to remove them and forget that they exist or where to find them in my system, and it's a pain to re-enable them when needed for a specific use case. So I created this project inspired by [Pi Skill Palette](https://github.com/nicobailon/pi-skill-palette) that lets me enable and disable all the 'SKILLs' I have without them disappearing from my visual memory, but still maintaining control over what gets pumped into my context.

Full credit to [nicobailon](https://github.com/nicobailon) for pi-skill-palette which was the foundation of this. I just pointed my clanker at that project and basically said "make that project but have it toggle skills instead."

## Install

```bash
pi install npm:pi-skill-toggle
```

Or from git:

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
- **Enter/Space** - Toggle between enabled ↔ hidden
- **d** - Toggle full disable (enabled ↔ disabled)
- **Ctrl+S** - Save changes
- **Esc** - Cancel

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

## Disable Modes

### Hidden (Default Toggle)
Use **hidden** when you still want to call the skill manually via `/skill:name` but don't want day-to-day context pollution. The model won't auto-invoke it, keeping your system prompt lean, but you retain access when needed.

**Examples:** Specialized debugging skills, infrequently-used cloud tools, niche domain skills you call explicitly.

Hidden mode sets `disable-model-invocation: true` in the skill's SKILL.md frontmatter.

### Fully Disabled
Use **fully disabled** when you want to clean up your slash command menu so less-used skills don't overwhelm your UI/UX. The skill won't appear anywhere—not in the system prompt, not in `/skill:` completions.

**Examples:** Deprecated skills, skills from packages you rarely use, duplicates you'll never need.

Disabled mode adds `-path` entries to settings.json (pi's built-in mechanism).

## Visual Indicators

| Icon | Meaning |
|------|---------|
| ● (green) | Enabled - skill active in context |
| ◐ (yellow) | Hidden - manual only via `/skill:name` |
| ○ (red) | Disabled - completely off |
| * (yellow) | Pending change (not yet saved) |
| ² | Skill has multiple sources (duplicates) |

## Theming

Create `theme.json` in the extension directory to customize colors. Copy `theme.example.json` as a starting point:

```json
{
  "border": "2",
  "title": "2",
  "enabled": "32",
  "hidden": "33",
  "disabled": "31",
  "selected": "36",
  "selectedText": "36",
  "searchIcon": "2",
  "placeholder": "2;3",
  "description": "2",
  "hint": "2",
  "changed": "33",
  "duplicate": "35"
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
7. `~/.agents/skills/` (recursive)

## License

MIT
