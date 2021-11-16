/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
import {
	TextDocuments,
	createConnection,
	ProposedFeatures,
	TextDocumentSyncKind,
	ExecuteCommandRequest,
	VersionedTextDocumentIdentifier,
	ExecuteCommandParams,
	Diagnostic,
	DiagnosticSeverity,
	TextEdit,
	Range,
	WorkspaceChange
} from 'vscode-languageserver/node';

import {
	TextDocument
} from 'vscode-languageserver-textdocument';
import { run } from 'zhlint';

// 创建连接
const connection = createConnection(ProposedFeatures.all);

// 创建 text document
let documents!: TextDocuments<TextDocument>;

connection.onInitialize((_params, _cancel, progress) => {
	documents = new TextDocuments(TextDocument);
	documentSetup();
	progress.done();
	return {
		capabilities: {
			textDocumentSync: TextDocumentSyncKind.Incremental,
			// 补全支持
			completionProvider: {
				resolveProvider: true,
			},
			// 格式化支持
			documentFormattingProvider: true
		}
	};
});

// 监听请求
connection.onRequest(ExecuteCommandRequest.type, (args: ExecuteCommandParams) => {
	const params = args.arguments![0];
	switch(args.command) {
		// 格式诊断
		case 'vscode-zhlint-diagnostic':
			diagnostic(params);
			break;
		// 格式化
		case 'vscode-zhlint-format':
			const editor = format(params);
			if (!editor) {
				return;
			}
			const workspace = new WorkspaceChange();
			const textChange = workspace.getTextEditChange(params);
			textChange.add(editor);
			return connection.workspace.applyEdit(workspace.edit).then((response) => {
				if (!response.applied) {
					connection.console.error(`Failed to apply command: ${params.command}`);
				}
				return {};
			}, () => {
				connection.console.error(`Failed to apply command: ${params.command}`);
			});
			break;
	}
	return;
});

function diagnostic(args: VersionedTextDocumentIdentifier) {
	const uri = args.uri;
	const textDocument = documents.get(uri);
	if (textDocument === undefined || textDocument.version !== args.version) {
		return;
	}
	const originalText = textDocument.getText();
	const zhLint = run(originalText);
	const diagnostics: Diagnostic[] = zhLint.validations.map(v => ({
		range: {
			start: textDocument.positionAt(v.index),
			end: textDocument.positionAt(v.index + v.length)
		},
		message: v.message,
		source: 'zhlint',
		severity: DiagnosticSeverity.Error
	}));
	connection.sendDiagnostics({uri: uri, diagnostics});
}

function format(args: VersionedTextDocumentIdentifier) {
	const uri = args.uri;
	const textDocument = documents.get(uri);
	if (textDocument === undefined || textDocument.version !== args.version) {
		return;
	}
	const originalText = textDocument.getText();
	const zhLint = run(originalText);
	if (!zhLint.validations.length) {
		return;
	}
	const range = Range.create(textDocument.positionAt(0), textDocument.positionAt(textDocument.getText().length));
	return TextEdit.replace(range, zhLint.result);
}

function documentSetup() {
	// 将当前的 text document 监听到当前连接
	documents.listen(connection);
	documents.onDidChangeContent(e => {
		diagnostic({
			version: e.document.version,
			uri: e.document.uri
		});
	});
}

// 监听连接
connection.listen();
