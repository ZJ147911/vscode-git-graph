import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

function readNlsJson(filePath: string): Record<string, string> {
	return JSON.parse(fs.readFileSync(filePath, 'utf8')) as Record<string, string>;
}

const bundleCache = new Map<string, Record<string, string>>();

function getFileBundleMap(extensionPath: string, useZh: boolean): Record<string, string> {
	const cacheKey = extensionPath + (useZh ? ':zh' : ':en');
	const cached = bundleCache.get(cacheKey);
	if (cached !== undefined) {
		return cached;
	}
	const base = readNlsJson(path.join(extensionPath, 'package.nls.json'));
	let result: Record<string, string>;
	if (useZh) {
		const zhBundlePath = path.join(extensionPath, 'package.nls.zh.json');
		result = fs.existsSync(zhBundlePath) ? { ...base, ...readNlsJson(zhBundlePath) } : base;
	} else {
		result = base;
	}
	bundleCache.set(cacheKey, result);
	return result;
}

function createMapTranslator(extensionPath: string, useZh: boolean): (key: string) => string {
	const map = getFileBundleMap(extensionPath, useZh);
	return (key: string) => map[key] ?? key;
}

/**
 * Resolve strings shown in the Git Graph webview.
 * - `git-graph.language` **zh** / **en**: read `package.nls*.json` from disk (explicit override).
 * - **empty** (default): use `vscode.l10n.t`, same as the rest of the extension and the active VS Code / Language Pack locale.
 */
export function createWebviewNlsTranslator(
	extensionPath: string,
	gitGraphLanguageSetting: string
): (key: string) => string {
	const norm = gitGraphLanguageSetting.trim().toLowerCase();
	if (norm === 'zh') {
		return createMapTranslator(extensionPath, true);
	}
	if (norm === 'en') {
		return createMapTranslator(extensionPath, false);
	}
	return (key: string) => {
		// Check if VS Code language is Chinese (zh, zh-CN, zh-TW, etc.)
		const useZh = vscode.env.language.toLowerCase().startsWith('zh');
		const translated = getFileBundleMap(extensionPath, useZh)[key];
		if (translated !== undefined) {
			return translated;
		}
		// Fallback: try vscode.l10n.t
		const fromL10n = vscode.l10n.t(key);
		return fromL10n !== key ? fromL10n : key;
	};
}
