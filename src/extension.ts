import * as vscode from 'vscode';

const originalEncodedContent = new Map<string, string>();

export function activate(context: vscode.ExtensionContext) {
    let onSave = vscode.workspace.onWillSaveTextDocument((event) => {
        if (event.document.fileName.endsWith('.properties')) {
            const text = event.document.getText();
            const encoded = text.replace(/[^\x00-\x7F]/g, (char) => {
                const code = char.charCodeAt(0).toString(16).padStart(4, '0');
                return '\\u' + code;
            });
            
            const originalEncoded = originalEncodedContent.get(event.document.uri.toString());
            if (originalEncoded && originalEncoded === encoded) {
                return; // No actual changes made
            }
            
            if (text !== encoded) {
                const edit = new vscode.WorkspaceEdit();
                edit.replace(event.document.uri, new vscode.Range(0, 0, event.document.lineCount, 0), encoded);
                event.waitUntil(vscode.workspace.applyEdit(edit).then(() => {
                    // Decode back to readable characters after save
                    setTimeout(() => {
                        const savedText = event.document.getText();
                        const decoded = savedText.replace(/\\u([0-9a-f]{4})/gi, (match, hex) => 
                            String.fromCharCode(parseInt(hex, 16))
                        );
                        if (savedText !== decoded) {
                            const decodeEdit = new vscode.WorkspaceEdit();
                            decodeEdit.replace(event.document.uri, new vscode.Range(0, 0, event.document.lineCount, 0), decoded);
                            vscode.workspace.applyEdit(decodeEdit);
                        }
                    }, 100);
                }));
            }
            originalEncodedContent.set(event.document.uri.toString(), encoded);
        }
    });

    let onOpen = vscode.workspace.onDidOpenTextDocument((document) => {
        if (document.fileName.endsWith('.properties')) {
            const text = document.getText();
            const encoded = text.replace(/[^\x00-\x7F]/g, (char) => {
                const code = char.charCodeAt(0).toString(16).padStart(4, '0');
                return '\\u' + code;
            });
            originalEncodedContent.set(document.uri.toString(), encoded);
            
            const decoded = text.replace(/\\u([0-9a-f]{4})/gi, (match, hex) => 
                String.fromCharCode(parseInt(hex, 16))
            );
            if (text !== decoded) {
                const edit = new vscode.WorkspaceEdit();
                edit.replace(document.uri, new vscode.Range(0, 0, document.lineCount, 0), decoded);
                vscode.workspace.applyEdit(edit);
            }
        }
    });

    context.subscriptions.push(onSave, onOpen);
}

export function deactivate() {
    originalEncodedContent.clear();
}