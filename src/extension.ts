import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
    let disposable = vscode.commands.registerCommand('my-extension.helloWorld', () => {
        vscode.window.showInformationMessage('Hello World from My Extension!');
    });

    let onSave = vscode.workspace.onDidSaveTextDocument((document) => {
        if (document.fileName.endsWith('.properties')) {
            const edit = new vscode.WorkspaceEdit();
            const text = document.getText();
            const encoded = text.replace(/[^\x00-\x7F]/g, (char) => 
                encodeURIComponent(char).replace(/%/g, '\\u').toLowerCase()
            );
            if (text !== encoded) {
                edit.replace(document.uri, new vscode.Range(0, 0, document.lineCount, 0), encoded);
                vscode.workspace.applyEdit(edit);
            }
        }
    });

    let onOpen = vscode.workspace.onDidOpenTextDocument((document) => {
        if (document.fileName.endsWith('.properties')) {
            const text = document.getText();
            const decoded = text.replace(/\\u([0-9a-f]{2})/gi, (match, hex) => 
                decodeURIComponent('%' + hex)
            );
            if (text !== decoded) {
                const edit = new vscode.WorkspaceEdit();
                edit.replace(document.uri, new vscode.Range(0, 0, document.lineCount, 0), decoded);
                vscode.workspace.applyEdit(edit);
            }
        }
    });

    context.subscriptions.push(disposable, onSave, onOpen);
}

export function deactivate() {}