/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as path from 'path';
import { workspace, ExtensionContext, commands, window } from 'vscode';

import {
	LanguageClient,
	LanguageClientOptions,
	ServerOptions,
	VersionedTextDocumentIdentifier,
	TransportKind,
	ExecuteCommandParams,
	ExecuteCommandRequest
} from 'vscode-languageclient/node';

let client: LanguageClient;

export function activate(context: ExtensionContext) {
	// The server is implemented in node
	const serverModule = context.asAbsolutePath(
		path.join('server', 'out', 'server.js')
	);
	console.log('serverModule: ', serverModule);
	// The debug options for the server
	// --inspect=6009: runs the server in Node's Inspector mode so VS Code can attach to the server for debugging
	const debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] };

	// If the extension is launched in debug mode then the debug server options are used
	// Otherwise the run options are used
	const serverOptions: ServerOptions = {
		run: { module: serverModule, transport: TransportKind.ipc },
		debug: {
			module: serverModule,
			transport: TransportKind.ipc,
			options: debugOptions
		}
	};

	// Options to control the language client
	const clientOptions: LanguageClientOptions = {
		// Register the server for plain text documents
		documentSelector: [{ scheme: 'file' }, { scheme: 'untitled' }],
		synchronize: {
			// Notify the server about file changes to '.clientrc files contained in the workspace
			fileEvents: workspace.createFileSystemWatcher('**/.clientrc')
		}
	};

	// Create the language client and start the client.
	client = new LanguageClient(
		'vscode-zhlint',
		'zhlint format',
		serverOptions,
		clientOptions
	);

	async function registerCommand(command: string) {
		const textEditor = window.activeTextEditor;
		if (!textEditor) {
			return;
		}
		const textDocument: VersionedTextDocumentIdentifier = {
			uri: textEditor.document.uri.toString(),
			version: textEditor.document.version
		};
		const params: ExecuteCommandParams = {
			command: command,
			arguments: [textDocument]
		};
		await client.onReady();
		client.sendRequest(ExecuteCommandRequest.type, params).then(undefined, () => {
			void window.showErrorMessage('Failed to apply ZhLint fixes to the document.');
		});
	}

	// Start the client. This will also launch the server
	const disposable = [
		commands.registerCommand('vscode-zhlint-diagnostic', () => {
			void registerCommand('vscode-zhlint-diagnostic');
		}),
		commands.registerCommand('vscode-zhlint-format', async() => {
			void registerCommand('vscode-zhlint-diagnostic');
		})
	];
	context.subscriptions.push(client.start(), ...disposable);
}

export function deactivate(): Thenable<void> | undefined {
	if (!client) {
		console.log('client stop');
		return undefined;
	}
	return client.stop();
}
