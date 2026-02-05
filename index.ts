/**
 * pi-skill-toggle
 *
 * Extension to enable/disable skills from loading into pi context.
 * Usage: /skills - Opens the skill toggle UI
 *
 * Disabled skills are persisted via settings.json using the -path pattern.
 * Changes take effect on next pi restart (or /reload).
 *
 * Matches pi's deduplication behavior: first skill with a given name wins.
 * When a skill has duplicates (same name, different paths), disabling it
 * disables ALL paths to ensure the skill is fully disabled.
 *
 * Inspired by pi-skill-palette.
 */

import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { matchesKey, truncateToWidth, visibleWidth } from "@mariozechner/pi-tui";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

interface SkillInfo {
	name: string;
	description: string;
	filePath: string;        // Primary path (first found, shown to user)
	allPaths: string[];      // All paths with this name (for disabling all)
	enabled: boolean;
	hasDuplicates: boolean;  // True if multiple paths share this name
}

interface SkillToggleResult {
	action: "toggle" | "cancel" | "apply";
	changes: Map<string, boolean>; // skill name -> newEnabledState
}

// ═══════════════════════════════════════════════════════════════════════════
// Theme
// ═══════════════════════════════════════════════════════════════════════════

interface ToggleTheme {
	border: string;
	title: string;
	enabled: string;
	disabled: string;
	selected: string;
	selectedText: string;
	searchIcon: string;
	placeholder: string;
	description: string;
	hint: string;
	changed: string;
	duplicate: string;
}

const DEFAULT_THEME: ToggleTheme = {
	border: "2",           // dim
	title: "2",            // dim
	enabled: "32",         // green
	disabled: "31",        // red
	selected: "36",        // cyan
	selectedText: "36",    // cyan
	searchIcon: "2",       // dim
	placeholder: "2;3",    // dim italic
	description: "2",      // dim
	hint: "2",             // dim
	changed: "33",         // yellow
	duplicate: "35",       // magenta
};

function loadTheme(): ToggleTheme {
	const configPath = path.join(os.homedir(), ".pi", "agent", "extensions", "skill-toggle", "theme.json");
	try {
		if (fs.existsSync(configPath)) {
			const content = fs.readFileSync(configPath, "utf-8");
			const custom = JSON.parse(content) as Partial<ToggleTheme>;
			return { ...DEFAULT_THEME, ...custom };
		}
	} catch {
		// Ignore errors, use default
	}
	return DEFAULT_THEME;
}

function fg(code: string, text: string): string {
	if (!code) return text;
	return `\x1b[${code}m${text}\x1b[0m`;
}

const toggleTheme = loadTheme();

// ═══════════════════════════════════════════════════════════════════════════
// Settings Management
// ═══════════════════════════════════════════════════════════════════════════

const SETTINGS_PATH = path.join(os.homedir(), ".pi", "agent", "settings.json");

interface Settings {
	skills?: string[];
	[key: string]: unknown;
}

function loadSettings(): Settings {
	try {
		if (fs.existsSync(SETTINGS_PATH)) {
			return JSON.parse(fs.readFileSync(SETTINGS_PATH, "utf-8"));
		}
	} catch {
		// Ignore
	}
	return {};
}

function saveSettings(settings: Settings): void {
	fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2));
}

// The base directories for skills - used to compute relative paths
const AGENT_DIR = path.join(os.homedir(), ".pi", "agent");
const PROJECT_DIR = process.cwd();

/**
 * Get the set of disabled skill paths from settings.
 * Skills are disabled using the -path pattern.
 * Returns normalized absolute paths for both the directory and SKILL.md file.
 */
function getDisabledSkillPaths(settings: Settings): Set<string> {
	const disabled = new Set<string>();
	const skills = settings.skills ?? [];
	for (const entry of skills) {
		if (typeof entry === "string" && entry.startsWith("-")) {
			// Remove the - prefix and resolve to absolute path
			const rawPath = entry.slice(1);
			const absolutePath = normalizeSettingsPath(rawPath);
			disabled.add(absolutePath);
			// Also add SKILL.md if this is a directory
			const skillMd = path.join(absolutePath, "SKILL.md");
			disabled.add(skillMd);
		}
	}
	return disabled;
}

/**
 * Check if a skill file path is disabled
 */
function isSkillDisabled(filePath: string, disabledPaths: Set<string>): boolean {
	const normalized = path.normalize(filePath);
	const dir = path.dirname(filePath);
	return disabledPaths.has(normalized) || disabledPaths.has(dir);
}

/**
 * Get the relative path for a skill, suitable for use in settings.json.
 * Pi's resource filtering uses relative paths from the baseDir (~/.pi/agent or .pi).
 */
function getSkillRelativePath(skillFilePath: string): { path: string; isRelative: boolean } {
	const skillDir = path.dirname(skillFilePath);
	
	// Check if under ~/.pi/agent/
	if (skillDir.startsWith(AGENT_DIR + path.sep) || skillDir === AGENT_DIR) {
		const rel = path.relative(AGENT_DIR, skillDir);
		return { path: rel, isRelative: true };
	}
	
	// Check if under current project's .pi/
	const projectPiDir = path.join(PROJECT_DIR, ".pi");
	if (skillDir.startsWith(projectPiDir + path.sep) || skillDir === projectPiDir) {
		const rel = path.relative(projectPiDir, skillDir);
		return { path: rel, isRelative: true };
	}
	
	// Fall back to absolute path for skills outside standard locations
	return { path: skillDir, isRelative: false };
}

/**
 * Normalize a settings entry path for comparison.
 */
function normalizeSettingsPath(entryPath: string): string {
	if (path.isAbsolute(entryPath)) {
		return path.normalize(entryPath);
	}
	
	if (entryPath.startsWith("~")) {
		return normalizePath(entryPath);
	}
	
	return path.join(AGENT_DIR, entryPath);
}

/**
 * Update settings to reflect enabled/disabled state changes.
 * When disabling a skill with duplicates, disables ALL paths.
 */
function applyChanges(changes: Map<string, boolean>, skillsByName: Map<string, SkillInfo>): void {
	const settings = loadSettings();
	const skills = settings.skills ?? [];
	const newSkills: string[] = [];
	
	// Collect all paths that need to be disabled/enabled
	const pathsToDisable = new Set<string>();
	const pathsToEnable = new Set<string>();
	
	for (const [skillName, newEnabled] of changes) {
		const skill = skillsByName.get(skillName);
		if (!skill) continue;
		
		// Apply change to ALL paths for this skill name
		for (const filePath of skill.allPaths) {
			if (newEnabled) {
				pathsToEnable.add(filePath);
			} else {
				pathsToDisable.add(filePath);
			}
		}
	}
	
	// Helper to check if a settings entry matches any of the paths
	const matchesPath = (entry: string, targetPaths: Set<string>): boolean => {
		if (!entry.startsWith("-")) return false;
		const entryPath = normalizeSettingsPath(entry.slice(1));
		for (const filePath of targetPaths) {
			const skillDir = path.dirname(filePath);
			if (entryPath === skillDir || entryPath === filePath) {
				return true;
			}
		}
		return false;
	};
	
	// Keep non-disable entries and entries not being changed
	for (const entry of skills) {
		if (typeof entry !== "string") {
			newSkills.push(entry);
			continue;
		}
		
		if (!entry.startsWith("-")) {
			newSkills.push(entry);
			continue;
		}
		
		// This is a disable entry - check if it's being enabled
		if (matchesPath(entry, pathsToEnable)) {
			// Skip it (remove from settings)
			continue;
		}
		
		// Keep it
		newSkills.push(entry);
	}
	
	// Add new disable entries
	const existingDisables = new Set(
		newSkills
			.filter(s => typeof s === "string" && s.startsWith("-"))
			.map(s => normalizeSettingsPath((s as string).slice(1)))
	);
	
	for (const filePath of pathsToDisable) {
		const skillDir = path.dirname(filePath);
		if (existingDisables.has(skillDir) || existingDisables.has(filePath)) {
			continue; // Already disabled
		}
		
		const { path: skillPath } = getSkillRelativePath(filePath);
		newSkills.push(`-${skillPath}`);
	}
	
	settings.skills = newSkills;
	saveSettings(settings);
}

function normalizePath(p: string): string {
	const trimmed = p.trim();
	if (trimmed === "~") return os.homedir();
	if (trimmed.startsWith("~/")) return path.join(os.homedir(), trimmed.slice(2));
	if (trimmed.startsWith("~")) return path.join(os.homedir(), trimmed.slice(1));
	return path.resolve(trimmed);
}

// ═══════════════════════════════════════════════════════════════════════════
// Skill Discovery
// ═══════════════════════════════════════════════════════════════════════════

type SkillFormat = "recursive" | "claude";

interface SkillDirConfig {
	dir: string;
	format: SkillFormat;
}

interface RawSkill {
	name: string;
	description: string;
	filePath: string;
	realPath: string;
}

/**
 * Scan a directory for skills (raw, before deduplication)
 */
function scanSkillDir(
	dir: string,
	format: SkillFormat,
	skills: RawSkill[],
	visitedRealPaths: Set<string>,
	visitedDirs?: Set<string>
): void {
	if (!fs.existsSync(dir)) return;

	const visited = visitedDirs ?? new Set<string>();
	let realDir: string;
	try {
		realDir = fs.realpathSync(dir);
	} catch {
		realDir = dir;
	}
	if (visited.has(realDir)) return;
	visited.add(realDir);

	try {
		const entries = fs.readdirSync(dir, { withFileTypes: true });
		for (const entry of entries) {
			if (entry.name.startsWith(".")) continue;
			if (entry.name === "node_modules") continue;

			const entryPath = path.join(dir, entry.name);

			let isDirectory = entry.isDirectory();
			let isFile = entry.isFile();
			if (entry.isSymbolicLink()) {
				try {
					const stats = fs.statSync(entryPath);
					isDirectory = stats.isDirectory();
					isFile = stats.isFile();
				} catch {
					continue;
				}
			}

			if (format === "recursive") {
				if (isDirectory) {
					scanSkillDir(entryPath, format, skills, visitedRealPaths, visited);
				} else if (isFile && entry.name === "SKILL.md") {
					loadRawSkill(entryPath, skills, visitedRealPaths);
				}
			} else if (format === "claude") {
				if (!isDirectory) continue;
				const skillFile = path.join(entryPath, "SKILL.md");
				if (!fs.existsSync(skillFile)) continue;
				loadRawSkill(skillFile, skills, visitedRealPaths);
			}
		}
	} catch {
		// Skip inaccessible directories
	}
}

function loadRawSkill(filePath: string, skills: RawSkill[], visitedRealPaths: Set<string>): void {
	try {
		// Resolve symlinks to detect same file
		let realPath: string;
		try {
			realPath = fs.realpathSync(filePath);
		} catch {
			realPath = filePath;
		}
		
		// Skip if we've already loaded this exact file (via symlink)
		if (visitedRealPaths.has(realPath)) {
			return;
		}
		visitedRealPaths.add(realPath);
		
		const content = fs.readFileSync(filePath, "utf-8");
		const skillDir = path.dirname(filePath);
		const parentDirName = path.basename(skillDir);
		const { name, description } = parseFrontmatter(content, parentDirName);
		
		if (!description) return;
		
		skills.push({
			name,
			description,
			filePath,
			realPath,
		});
	} catch {
		// Skip invalid skill files
	}
}

function parseFrontmatter(content: string, fallbackName: string): { name: string; description: string } {
	if (!content.startsWith("---")) {
		return { name: fallbackName, description: "" };
	}

	const endIndex = content.indexOf("\n---", 3);
	if (endIndex === -1) {
		return { name: fallbackName, description: "" };
	}

	const frontmatter = content.slice(4, endIndex);
	let name = fallbackName;
	let description = "";

	for (const line of frontmatter.split("\n")) {
		const colonIndex = line.indexOf(":");
		if (colonIndex === -1) continue;

		const key = line.slice(0, colonIndex).trim();
		const value = line.slice(colonIndex + 1).trim();

		if (key === "name") name = value;
		if (key === "description") description = value;
	}

	return { name, description };
}

/**
 * Load all skills from known directories, deduplicating by name (matching pi's behavior)
 */
function loadAllSkills(): { skills: SkillInfo[]; byName: Map<string, SkillInfo> } {
	const settings = loadSettings();
	const disabledPaths = getDisabledSkillPaths(settings);
	const rawSkills: RawSkill[] = [];
	const visitedRealPaths = new Set<string>();
	
	const skillDirs: SkillDirConfig[] = [
		{ dir: path.join(os.homedir(), ".codex", "skills"), format: "recursive" },
		{ dir: path.join(os.homedir(), ".claude", "skills"), format: "claude" },
		{ dir: path.join(process.cwd(), ".claude", "skills"), format: "claude" },
		{ dir: path.join(os.homedir(), ".pi", "agent", "skills"), format: "recursive" },
		{ dir: path.join(os.homedir(), ".pi", "skills"), format: "recursive" },
		{ dir: path.join(process.cwd(), ".pi", "skills"), format: "recursive" },
	];

	for (const { dir, format } of skillDirs) {
		scanSkillDir(dir, format, rawSkills, visitedRealPaths);
	}

	// Group by name, first occurrence wins (matches pi's behavior)
	const byName = new Map<string, SkillInfo>();
	const pathsByName = new Map<string, string[]>();
	
	for (const raw of rawSkills) {
		if (!pathsByName.has(raw.name)) {
			pathsByName.set(raw.name, []);
		}
		pathsByName.get(raw.name)!.push(raw.filePath);
		
		// First occurrence wins
		if (!byName.has(raw.name)) {
			byName.set(raw.name, {
				name: raw.name,
				description: raw.description,
				filePath: raw.filePath,
				allPaths: [], // Will be filled after grouping
				enabled: true, // Will be computed after grouping
				hasDuplicates: false, // Will be computed after grouping
			});
		}
	}
	
	// Now fill in allPaths and compute enabled state
	for (const [name, skill] of byName) {
		const allPaths = pathsByName.get(name) ?? [skill.filePath];
		skill.allPaths = allPaths;
		skill.hasDuplicates = allPaths.length > 1;
		
		// Skill is enabled if ANY of its paths is enabled
		// (if user disabled one path but not others, the skill is still partially enabled)
		// Actually, to match pi's behavior: if the PRIMARY path is disabled, consider it disabled
		// But for safety, we should check if ALL paths are disabled
		skill.enabled = !allPaths.every(p => isSkillDisabled(p, disabledPaths));
	}

	const skills = Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name));
	return { skills, byName };
}

// ═══════════════════════════════════════════════════════════════════════════
// Fuzzy Filter
// ═══════════════════════════════════════════════════════════════════════════

function fuzzyScore(query: string, text: string): number {
	const lowerQuery = query.toLowerCase();
	const lowerText = text.toLowerCase();

	if (lowerText.includes(lowerQuery)) {
		return 100 + (lowerQuery.length / lowerText.length) * 50;
	}

	let score = 0;
	let queryIndex = 0;
	let consecutiveBonus = 0;

	for (let i = 0; i < lowerText.length && queryIndex < lowerQuery.length; i++) {
		if (lowerText[i] === lowerQuery[queryIndex]) {
			score += 10 + consecutiveBonus;
			consecutiveBonus += 5;
			queryIndex++;
		} else {
			consecutiveBonus = 0;
		}
	}

	return queryIndex === lowerQuery.length ? score : 0;
}

function filterSkills(skills: SkillInfo[], query: string): SkillInfo[] {
	if (!query.trim()) return skills;

	const scored = skills
		.map((skill) => ({
			skill,
			score: Math.max(
				fuzzyScore(query, skill.name),
				fuzzyScore(query, skill.description) * 0.8
			),
		}))
		.filter((item) => item.score > 0)
		.sort((a, b) => b.score - a.score);

	return scored.map((item) => item.skill);
}

// ═══════════════════════════════════════════════════════════════════════════
// UI Component
// ═══════════════════════════════════════════════════════════════════════════

class SkillToggleComponent {
	private allSkills: SkillInfo[];
	private filtered: SkillInfo[];
	private selected = 0;
	private query = "";
	private changes = new Map<string, boolean>(); // skill NAME -> newEnabledState
	private inactivityTimeout: ReturnType<typeof setTimeout> | null = null;
	private static readonly INACTIVITY_MS = 120000; // 2 minutes

	constructor(
		skills: SkillInfo[],
		private done: (result: SkillToggleResult) => void
	) {
		this.allSkills = skills;
		this.filtered = skills;
		this.resetInactivityTimeout();
	}

	private resetInactivityTimeout(): void {
		if (this.inactivityTimeout) clearTimeout(this.inactivityTimeout);
		this.inactivityTimeout = setTimeout(() => {
			this.cleanup();
			this.done({ action: "cancel", changes: new Map() });
		}, SkillToggleComponent.INACTIVITY_MS);
	}

	private getEffectiveEnabled(skill: SkillInfo): boolean {
		if (this.changes.has(skill.name)) {
			return this.changes.get(skill.name)!;
		}
		return skill.enabled;
	}

	handleInput(data: string): void {
		this.resetInactivityTimeout();

		if (matchesKey(data, "escape")) {
			this.cleanup();
			this.done({ action: "cancel", changes: new Map() });
			return;
		}

		// Enter on a skill toggles it
		if (matchesKey(data, "return")) {
			const skill = this.filtered[this.selected];
			if (skill) {
				const currentEnabled = this.getEffectiveEnabled(skill);
				const originalEnabled = skill.enabled;
				const newEnabled = !currentEnabled;
				
				// If toggling back to original state, remove from changes
				if (newEnabled === originalEnabled) {
					this.changes.delete(skill.name);
				} else {
					this.changes.set(skill.name, newEnabled);
				}
			}
			return;
		}

		// Space also toggles
		if (data === " ") {
			const skill = this.filtered[this.selected];
			if (skill) {
				const currentEnabled = this.getEffectiveEnabled(skill);
				const originalEnabled = skill.enabled;
				const newEnabled = !currentEnabled;
				
				if (newEnabled === originalEnabled) {
					this.changes.delete(skill.name);
				} else {
					this.changes.set(skill.name, newEnabled);
				}
			}
			return;
		}

		// Ctrl+S to save and exit
		if (matchesKey(data, "ctrl+s")) {
			this.cleanup();
			this.done({ action: "apply", changes: this.changes });
			return;
		}

		if (matchesKey(data, "up")) {
			if (this.filtered.length > 0) {
				this.selected = this.selected === 0 ? this.filtered.length - 1 : this.selected - 1;
			}
			return;
		}

		if (matchesKey(data, "down")) {
			if (this.filtered.length > 0) {
				this.selected = this.selected === this.filtered.length - 1 ? 0 : this.selected + 1;
			}
			return;
		}

		if (matchesKey(data, "backspace")) {
			if (this.query.length > 0) {
				this.query = this.query.slice(0, -1);
				this.updateFilter();
			}
			return;
		}

		// Printable character
		if (data.length === 1 && data.charCodeAt(0) >= 32) {
			this.query += data;
			this.updateFilter();
		}
	}

	private updateFilter(): void {
		this.filtered = filterSkills(this.allSkills, this.query);
		this.selected = 0;
	}

	render(width: number): string[] {
		const innerW = width - 2;
		const lines: string[] = [];

		const t = toggleTheme;
		const border = (s: string) => fg(t.border, s);
		const title = (s: string) => fg(t.title, s);
		const enabled = (s: string) => fg(t.enabled, s);
		const disabled = (s: string) => fg(t.disabled, s);
		const selected = (s: string) => fg(t.selected, s);
		const selectedText = (s: string) => fg(t.selectedText, s);
		const searchIcon = (s: string) => fg(t.searchIcon, s);
		const placeholder = (s: string) => fg(t.placeholder, s);
		const description = (s: string) => fg(t.description, s);
		const hint = (s: string) => fg(t.hint, s);
		const changed = (s: string) => fg(t.changed, s);
		const duplicate = (s: string) => fg(t.duplicate, s);
		const bold = (s: string) => `\x1b[1m${s}\x1b[22m`;
		const italic = (s: string) => `\x1b[3m${s}\x1b[23m`;

		const visLen = visibleWidth;

		const row = (content: string) => border("│") + truncateToWidth(" " + content, innerW, "…", true) + border("│");
		const emptyRow = () => border("│") + " ".repeat(innerW) + border("│");

		// Count pending changes
		const pendingCount = this.changes.size;
		const enabledCount = this.allSkills.filter(s => this.getEffectiveEnabled(s)).length;
		const totalCount = this.allSkills.length;

		// Top border with title
		const titleText = ` Skills (${enabledCount}/${totalCount} enabled) `;
		const borderLen = innerW - visLen(titleText);
		const leftBorder = Math.floor(borderLen / 2);
		const rightBorder = borderLen - leftBorder;
		lines.push(border("╭" + "─".repeat(leftBorder)) + title(titleText) + border("─".repeat(rightBorder) + "╮"));

		lines.push(emptyRow());

		// Search input
		const cursor = selected("│");
		const searchIconChar = searchIcon("◎");
		const queryDisplay = this.query
			? `${this.query}${cursor}`
			: `${cursor}${placeholder(italic("type to filter..."))}`;
		lines.push(row(`${searchIconChar}  ${queryDisplay}`));

		lines.push(emptyRow());

		// Pending changes indicator
		if (pendingCount > 0) {
			lines.push(row(changed(`⚠ ${pendingCount} pending change${pendingCount === 1 ? "" : "s"} (Ctrl+S to save)`)));
			lines.push(emptyRow());
		}

		// Divider
		lines.push(border("├" + "─".repeat(innerW) + "┤"));

		// Skills list
		const maxVisible = 12;
		const startIndex = Math.max(0, Math.min(this.selected - Math.floor(maxVisible / 2), this.filtered.length - maxVisible));
		const endIndex = Math.min(startIndex + maxVisible, this.filtered.length);

		if (this.filtered.length === 0) {
			lines.push(emptyRow());
			lines.push(row(hint(italic("No matching skills"))));
			lines.push(emptyRow());
		} else {
			lines.push(emptyRow());
			for (let i = startIndex; i < endIndex; i++) {
				const skill = this.filtered[i];
				const isSelected = i === this.selected;
				const isEnabled = this.getEffectiveEnabled(skill);
				const hasChanged = this.changes.has(skill.name);
				
				// Build the skill line
				const prefix = isSelected ? selected("▸") : border("·");
				const statusIcon = isEnabled ? enabled("●") : disabled("○");
				const changedMarker = hasChanged ? changed("*") : " ";
				const dupMarker = skill.hasDuplicates ? duplicate("²") : " ";
				const nameStr = isSelected ? bold(selectedText(skill.name)) : skill.name;
				const maxDescLen = Math.max(0, innerW - visLen(skill.name) - 18);
				const descStr = maxDescLen > 3 ? description(truncateToWidth(skill.description, maxDescLen, "…")) : "";
				
				const separator = descStr ? `  ${border("—")}  ` : "";
				const skillLine = `${prefix} ${statusIcon}${changedMarker}${dupMarker}${nameStr}${separator}${descStr}`;
				lines.push(row(skillLine));
			}
			lines.push(emptyRow());

			// Scroll indicator
			if (this.filtered.length > maxVisible) {
				const countStr = `${this.selected + 1}/${this.filtered.length}`;
				lines.push(row(hint(countStr)));
				lines.push(emptyRow());
			}
		}

		// Divider
		lines.push(border("├" + "─".repeat(innerW) + "┤"));

		lines.push(emptyRow());

		// Footer hints
		const baseHints = `${italic("↑↓")} navigate  ${italic("enter/space")} toggle  ${italic("ctrl+s")} save  ${italic("esc")} cancel`;
		lines.push(row(hint(baseHints)));
		
		// Legend for markers
		lines.push(row(hint(`${duplicate("²")} = multiple sources (all will be toggled)`)));

		// Bottom border
		lines.push(border(`╰${"─".repeat(innerW)}╯`));

		return lines;
	}

	private cleanup(): void {
		if (this.inactivityTimeout) {
			clearTimeout(this.inactivityTimeout);
			this.inactivityTimeout = null;
		}
	}

	invalidate(): void {}
	
	dispose(): void {
		this.cleanup();
	}
}

// ═══════════════════════════════════════════════════════════════════════════
// Extension Entry Point
// ═══════════════════════════════════════════════════════════════════════════

export default function skillToggleExtension(pi: ExtensionAPI): void {
	// Register the /skills command
	pi.registerCommand("skills-toggle", {
		description: "Toggle skills on/off (changes require restart)",
		handler: async (_args: string, ctx: ExtensionContext) => {
			const { skills, byName } = loadAllSkills();

			if (skills.length === 0) {
				ctx.ui.notify("No skills found", "warning");
				return;
			}

			const result = await ctx.ui.custom<SkillToggleResult>(
				(_tui, _theme, _keybindings, done) => new SkillToggleComponent(
					skills,
					(r) => done(r)
				),
				{ overlay: true, overlayOptions: { anchor: "center", width: 80 } }
			);

			if (result.action === "apply" && result.changes.size > 0) {
				try {
					applyChanges(result.changes, byName);
					
					const enabledCount = Array.from(result.changes.values()).filter(v => v).length;
					const disabledCount = result.changes.size - enabledCount;
					
					const parts: string[] = [];
					if (enabledCount > 0) parts.push(`${enabledCount} enabled`);
					if (disabledCount > 0) parts.push(`${disabledCount} disabled`);
					
					ctx.ui.notify(`Skills updated: ${parts.join(", ")}. Use /reload or restart for changes to take effect.`, "success");
				} catch (error) {
					const msg = error instanceof Error ? error.message : "Unknown error";
					ctx.ui.notify(`Failed to save settings: ${msg}`, "error");
				}
			} else if (result.action === "cancel") {
				// Silent cancel
			}
		},
	});
}
