/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
import {
	createConnection,
	InitializeParams,
	CompletionItem,
	CompletionItemKind,
	TextDocumentPositionParams,
	TextDocuments,
	Message as LMessage,
	RequestMessage as LRequestMessage,
	ResponseMessage as LResponseMessage
} from 'vscode-languageserver/node';

import {
	TextDocument
} from 'vscode-languageserver-textdocument';

function isRequestMessage(message: LMessage | undefined): message is LRequestMessage {
	const candidate = <LRequestMessage>message;
	return candidate && typeof candidate.method === 'string' && (typeof candidate.id === 'string' || typeof candidate.id === 'number');
}

const connection = createConnection({
	cancelUndispatched: (message: LMessage) => {
		// Code actions can savely be cancel on request.
		if (isRequestMessage(message) && message.method === 'textDocument/codeAction') {
			const response: LResponseMessage = {
				jsonrpc: message.jsonrpc,
				id: message.id,
				result: null
			};
			return response;
		}
		return undefined;
	}
});

// Create a simple text document manager.
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

connection.onInitialize((params: InitializeParams) => {
	console.log('init: ', params);
	return Promise.resolve({
		capabilities: {
		}
	});
});

connection.onInitialized(() => {
	console.log('inited');
});


connection.onDidChangeConfiguration(change => {
	console.log('did change: ', change);
});

// Only keep settings for open documents
documents.onDidClose(e => {
	console.log('document e: ', e);
});

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent(change => {
	console.log('document change: ', change);
});
documents.onDidOpen(() => {
	console.log('document open');
});

connection.onDidChangeWatchedFiles(_change => {
	// Monitored files have change in VSCode
	connection.console.log('We received an file change event');
});

// This handler provides the initial list of the completion items.
connection.onCompletion(
	(_textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
		// The pass parameter contains the position of the text document in
		// which code complete got requested. For the example we ignore this
		// info and always provide the same completion items.
		return [
			{
				label: 'TypeScript',
				kind: CompletionItemKind.Text,
				data: 1
			},
			{
				label: 'JavaScript',
				kind: CompletionItemKind.Text,
				data: 2
			}
		];
	}
);

// This handler resolves additional information for the item selected in
// the completion list.
connection.onCompletionResolve(
	(item: CompletionItem): CompletionItem => {
		if (item.data === 1) {
			item.detail = 'TypeScript details';
			item.documentation = 'TypeScript documentation';
		} else if (item.data === 2) {
			item.detail = 'JavaScript details';
			item.documentation = 'JavaScript documentation';
		}
		return item;
	}
);

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();
