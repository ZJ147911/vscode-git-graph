import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

const bundleCache = new Map<string, Record<string, string>>();

function loadBundleFromFile(bundlePath: string): Record<string, string> | null {
	try {
		return JSON.parse(fs.readFileSync(bundlePath, 'utf8'));
	} catch {
		return null;
	}
}

function getLocaleBundle(bundleDir: string, locale: string): Record<string, string> {
	const cacheKey = `${bundleDir}:${locale}`;
	const cached = bundleCache.get(cacheKey);
	if (cached !== undefined) return cached;

	// Try exact locale (e.g., zh-CN), then language-only (e.g., zh), then fallback to default bundle
	const paths = [
		path.join(bundleDir, `bundle.l10n.${locale}.json`),
		path.join(bundleDir, `bundle.l10n.${locale.split('-')[0]}.json`),
		path.join(bundleDir, 'bundle.l10n.json')
	];

	let result: Record<string, string> = {};
	for (const p of paths) {
		const loaded = loadBundleFromFile(p);
		if (loaded !== null) {
			result = loaded;
			break;
		}
	}

	bundleCache.set(cacheKey, result);
	return result;
}

/**
 * Resolve strings shown in the Git Graph webview.
 *
 * - Default (empty): uses `vscode.l10n.t()`, which automatically loads
 *   translations from `l10n/bundle.l10n.json` based on the active VS Code UI
 *   language — same as the rest of the extension.
 * - `git-graph.language` set to **zh** or **en**: overrides the webview
 *   language. If VS Code's UI language already matches the override, falls
 *   back to `vscode.l10n.t()`. Otherwise, reads the corresponding
 *   `l10n/bundle.l10n.xx.json` file directly.
 */
export function createWebviewNlsTranslator(
	extensionPath: string,
	gitGraphLanguageSetting: string
): (key: string) => string {
	const norm = gitGraphLanguageSetting.trim().toLowerCase();
	const bundleDir = path.join(extensionPath, 'l10n');
	const currentLang = vscode.env.language.toLowerCase();

	// Explicitly force English when VS Code is not in English
	if (norm === 'en' && !currentLang.startsWith('en')) {
		const bundle = getLocaleBundle(bundleDir, 'en');
		return (key: string) => bundle[key] ?? key;
	}

	// Explicitly force Chinese when VS Code is not in Chinese
	if (norm === 'zh' && !currentLang.startsWith('zh')) {
		const bundle = getLocaleBundle(bundleDir, 'zh');
		return (key: string) => bundle[key] ?? key;
	}

	// Default: use VS Code's built-in l10n system
	return (key: string) => vscode.l10n.t(key);
}
