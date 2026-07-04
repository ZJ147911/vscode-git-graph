import * as vscode from 'vscode';
import { RequestMessage, ResponseMessage, Writeable } from '../../src/types';


/* Mocks */

const mockedExtensionSettingValues: { [section: string]: any } = {};
const mockedCommands: { [command: string]: (...args: any[]) => any } = {};

interface WebviewPanelMocks {
	messages: ResponseMessage[],
	panel: {
		onDidChangeViewState: (e: vscode.WebviewPanelOnDidChangeViewStateEvent) => any,
		onDidDispose: (e: void) => any,
		setVisibility: (visible: boolean) => void,
		webview: {
			onDidReceiveMessage: (msg: RequestMessage) => void
		}
	}
}

let mockedWebviews: { panel: vscode.WebviewPanel, mocks: WebviewPanelMocks }[] = [];

export const mocks = {
	extensionContext: {
		asAbsolutePath: jest.fn(),
		extensionPath: '/path/to/extension',
		globalState: {
			get: jest.fn(),
			update: jest.fn()
		},
		globalStoragePath: '/path/to/globalStorage',
		logPath: '/path/to/logs',
		storagePath: '/path/to/storage',
		subscriptions: [],
		workspaceState: {
			get: jest.fn(),
			update: jest.fn()
		}
	},
	outputChannel: {
		appendLine: jest.fn(),
		dispose: jest.fn()
	},
	statusBarItem: {
		text: '',
		tooltip: '',
		command: '',
		show: jest.fn(),
		hide: jest.fn(),
		dispose: jest.fn()
	},
	terminal: {
		sendText: jest.fn(),
		show: jest.fn()
	},
	workspaceConfiguration: {
		get: jest.fn((section: string, defaultValue?: any) => {
			return typeof mockedExtensionSettingValues[section] !== 'undefined'
				? mockedExtensionSettingValues[section]
				: defaultValue;
		}),
		inspect: jest.fn((section: string) => ({
			workspaceValue: mockedExtensionSettingValues[section],
			globalValue: mockedExtensionSettingValues[section]
		}))
	}
};


/* Visual Studio Code API Mocks */

export const commands = {
	executeCommand: jest.fn((command: string, ...rest: any[]) => mockedCommands[command](...rest)),
	registerCommand: jest.fn((command: string, callback: (...args: any[]) => any) => {
		mockedCommands[command] = callback;
		return {
			dispose: () => {
				delete mockedCommands[command];
			}
		};
	})
};

export const env = {
	clipboard: {
		writeText: jest.fn()
	},
	language: 'en',
	openExternal: jest.fn()
};

export const EventEmitter = jest.fn(() => ({
	dispose: jest.fn(),
	event: jest.fn()
}));

const nlsMessages: { [key: string]: string } = {
	'ui.avatarCacheCleared': 'The Avatar Cache was successfully cleared.',
	'ui.cannotAddRepo': '{error} Therefore it could not be added to Git Graph.',
	'ui.cannotOpenFile': 'Unable to Open File: {filePath}',
	'ui.cannotOpenFileMissingArgs': 'Unable to Open File: The command was not called with the required arguments.',
	'ui.cannotWriteConfigFile': 'Failed to write the Git Graph Repository Configuration File to "{path}".',
	'ui.codeReviewEnded': 'Successfully ended Code Review "{review}".',
	'ui.configFileExported': 'Successfully exported the Git Graph Repository Configuration to "{path}".',
	'ui.configFileImported': 'Git Graph Repository Configuration was successfully imported for the repository "{repo}".',
	'ui.configFileUpdated': 'A newer Git Graph Repository Configuration File has been detected for the repository "{repo}". Would you like to override your current repository configuration with the new changes?',
	'ui.copy': 'Copy',
	'ui.endedAllCodeReviews': 'Ended All Code Reviews in Workspace',
	'ui.errorCheckingDir': 'An unexpected error occurred while checking if the "{path}" directory exists. This directory is used to store the Git Graph Repository Configuration file.',
	'ui.errorClearingAvatarCache': 'An unexpected error occurred while running the command "Clear Avatar Cache".',
	'ui.errorEndingCodeReview': 'An unexpected error occurred while running the command "End a specific Code Review in Workspace...".',
	'ui.errorGettingVersionInfo': 'An unexpected error occurred while retrieving version information.',
	'ui.errorResumingCodeReview': 'An unexpected error occurred while running the command "Resume a specific Code Review in Workspace...".',
	'ui.errorRunningFetchCommand': 'An unexpected error occurred while running the command "Fetch from Remote(s)".',
	'ui.folderNotInWorkspace': 'The folder "{path}" is not within the opened Visual Studio Code workspace, and therefore could not be added to Git Graph.',
	'ui.folderNotGitRepo': 'The folder "{path}" is not a Git repository.',
	'ui.folderInKnownRepo': 'The folder "{path}" is contained within the known repository "{root}".',
	'ui.invalidConfigValue': 'The value for "{value}" in the configuration file "{file}" is invalid.',
	'ui.no': 'No',
	'ui.noActiveCodeReviews': 'There are no Code Reviews in progress within the current workspace.',
	'ui.repoAdded': 'The repository "{repo}" was added to Git Graph.',
	'ui.selectCodeReviewToEnd': 'Select the Code Review you want to end:',
	'ui.selectCodeReviewToResume': 'Select the Code Review you want to resume:',
	'ui.selectRepoToFetch': 'Select the repository you want to open in Git Graph, and fetch from remote(s):',
	'ui.selectRepoToRemove': 'Select a repository to remove from Git Graph:',
	'ui.viewGitGraph': 'View Git Graph',
	'ui.yes': 'Yes'
};

export const l10n = {
	t: jest.fn((key: string, args?: { [key: string]: any }) => {
		const message = nlsMessages[key] || key;
		return args === undefined
			? message
			: message.replace(/\{([^}]+)\}/g, (_, name) => args[name]);
	})
};

export class Uri implements vscode.Uri {
	public readonly scheme: string;
	public readonly authority: string;
	public readonly path: string;
	public readonly query: string;
	public readonly fragment: string;

	protected constructor(scheme: string, authority?: string, path?: string, query?: string, fragment?: string) {
		this.scheme = scheme;
		this.authority = authority || '';
		this.path = path || '';
		this.query = query || '';
		this.fragment = fragment || '';
	}

	get fsPath() {
		return this.path;
	}

	public with(change: { scheme?: string | undefined; authority?: string | undefined; path?: string | undefined; query?: string | undefined; fragment?: string | undefined; }): vscode.Uri {
		return new Uri(change.scheme || this.scheme, change.authority || this.authority, change.path || this.path, change.query || this.query, change.fragment || this.fragment);
	}

	public toString() {
		return this.scheme + '://' + this.path + (this.query ? '?' + this.query : '') + (this.fragment ? '#' + this.fragment : '');
	}

	public toJSON() {
		return this;
	}

	public static file(path: string) {
		return new Uri('file', '', path);
	}

	public static parse(path: string) {
		const comps = path.match(/([a-z]+):\/\/([^?#]+)(\?([^#]+)|())(#(.+)|())/)!;
		return new Uri(comps[1], '', comps[2], comps[4], comps[6]);
	}
}

export enum StatusBarAlignment {
	Left = 1,
	Right = 2
}

export let version = '1.51.0';

export enum ViewColumn {
	Active = -1,
	Beside = -2,
	One = 1,
	Two = 2,
	Three = 3,
	Four = 4,
	Five = 5,
	Six = 6,
	Seven = 7,
	Eight = 8,
	Nine = 9
}

export const window = {
	activeTextEditor: undefined as any,
	createOutputChannel: jest.fn(() => mocks.outputChannel),
	createStatusBarItem: jest.fn(() => mocks.statusBarItem),
	createWebviewPanel: jest.fn(createWebviewPanel),
	createTerminal: jest.fn(() => mocks.terminal),
	showErrorMessage: jest.fn(),
	showInformationMessage: jest.fn(),
	showOpenDialog: jest.fn(),
	showQuickPick: jest.fn(),
	showSaveDialog: jest.fn()
};

export const workspace = {
	createFileSystemWatcher: jest.fn(() => ({
		onDidCreate: jest.fn(),
		onDidChange: jest.fn(),
		onDidDelete: jest.fn(),
		dispose: jest.fn()
	})),
	getConfiguration: jest.fn(() => mocks.workspaceConfiguration),
	onDidChangeConfiguration: jest.fn((_: () => void) => ({ dispose: jest.fn() })),
	onDidChangeWorkspaceFolders: jest.fn((_: () => Promise<void>) => ({ dispose: jest.fn() })),
	onDidCloseTextDocument: jest.fn((_: () => void) => ({ dispose: jest.fn() })),
	workspaceFolders: <{ uri: Uri, index: number }[] | undefined>undefined
};

function createWebviewPanel(viewType: string, title: string, _showOptions: ViewColumn | { viewColumn: ViewColumn, preserveFocus?: boolean }, _options?: vscode.WebviewPanelOptions & vscode.WebviewOptions) {
	const mocks: WebviewPanelMocks = {
		messages: [],
		panel: {
			onDidChangeViewState: () => { },
			onDidDispose: () => { },
			setVisibility: (visible) => {
				webviewPanel.visible = visible;
				mocks.panel.onDidChangeViewState({ webviewPanel: webviewPanel });
			},
			webview: {
				onDidReceiveMessage: () => { }
			}
		}
	};

	const webviewPanel: Writeable<vscode.WebviewPanel> = {
		active: true,
		dispose: jest.fn(),
		iconPath: undefined,
		onDidChangeViewState: jest.fn((onDidChangeViewState) => {
			mocks.panel.onDidChangeViewState = onDidChangeViewState;
			return { dispose: jest.fn() };
		}),
		onDidDispose: jest.fn((onDidDispose) => {
			mocks.panel.onDidDispose = onDidDispose;
			return { dispose: jest.fn() };
		}),
		options: {},
		reveal: jest.fn((_viewColumn?: ViewColumn, _preserveFocus?: boolean) => { }),
		title: title,
		visible: true,
		viewType: viewType,
		webview: {
			asWebviewUri: jest.fn((uri: Uri) => uri.with({ scheme: 'vscode-webview-resource', path: 'file//' + uri.path.replace(/\\/g, '/') })),
			cspSource: 'vscode-webview-resource:',
			html: '',
			onDidReceiveMessage: jest.fn((onDidReceiveMessage) => {
				mocks.panel.webview.onDidReceiveMessage = onDidReceiveMessage;
				return { dispose: jest.fn() };
			}),
			options: {},
			postMessage: jest.fn((msg) => {
				mocks.messages.push(msg);
				return Promise.resolve(true);
			})
		}
	};

	mockedWebviews.push({ panel: webviewPanel, mocks: mocks });
	return webviewPanel;
}


/* Utilities */

beforeEach(() => {
	jest.clearAllMocks();

	window.activeTextEditor = {
		document: {
			uri: Uri.file('/path/to/workspace-folder/active-file.txt')
		},
		viewColumn: ViewColumn.One
	};

	// Clear any mocked extension setting values before each test
	Object.keys(mockedExtensionSettingValues).forEach((section) => {
		delete mockedExtensionSettingValues[section];
	});

	mockedWebviews = [];

	version = '1.51.0';
});

export function mockExtensionSettingReturnValue(section: string, value: any) {
	mockedExtensionSettingValues[section] = value;
}

export function mockVscodeVersion(newVersion: string) {
	version = newVersion;
}

export function getMockedWebviewPanel(i: number) {
	return mockedWebviews[i];
}
