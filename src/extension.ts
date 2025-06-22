import * as vscode from 'vscode';

const originalEncodedContent = new Map<string, string>();
const fileExtension = '.properties';

export function activate(context: vscode.ExtensionContext) {
    let onSave = vscode.workspace.onWillSaveTextDocument((event) => {
        if (event.document.fileName.endsWith(fileExtension)) {
            const text = event.document.getText();
            const encoded = encodeText(text);
            const originalEncoded = originalEncodedContent.get(event.document.uri.toString());
            if (originalEncoded && originalEncoded === encoded) {
                return; // No actual changes made
            }
            
            if (text !== encoded) {
                const edit = new vscode.WorkspaceEdit();
                edit.replace(event.document.uri, new vscode.Range(0, 0, event.document.lineCount, 0), encoded);
                event.waitUntil(vscode.workspace.applyEdit(edit));
            }
            originalEncodedContent.set(event.document.uri.toString(), encoded);
        }
    });

    let onDidSave = vscode.workspace.onDidSaveTextDocument((document) => {
        if (document.fileName.endsWith(fileExtension)) {
            // Decode back to readable characters after save
            setTimeout(() => {
                const text = document.getText();
                const decoded = decodeText(text);
                if (text !== decoded) {
                    const edit = new vscode.WorkspaceEdit();
                    edit.replace(document.uri, new vscode.Range(0, 0, document.lineCount, 0), decoded);
                    vscode.workspace.applyEdit(edit).then(() => {
                        // Mark document as saved to avoid unsaved changes marker
                        vscode.commands.executeCommand('workbench.action.files.save');
                    });
                }
            }, 50);
        }
    });

    let onOpen = vscode.workspace.onDidOpenTextDocument((document) => {
        if (document.fileName.endsWith('.properties')) {
            const text = document.getText();
            const encoded = encodeText(text);
            originalEncodedContent.set(document.uri.toString(), encoded);
            
            const decoded = decodeText(text);
            if (text !== decoded) {
                const edit = new vscode.WorkspaceEdit();
                edit.replace(document.uri, new vscode.Range(0, 0, document.lineCount, 0), decoded);
                vscode.workspace.applyEdit(edit);
            }
        }
    });

    context.subscriptions.push(onSave, onDidSave, onOpen);
}
function decodeText(text: String) {
    return text.replace(/\\u([0-9a-f]{4})/gi, (match, hex) =>
        String.fromCharCode(parseInt(hex, 16))
    );
}
function encodeText(text: String) {
    return text.replace(/[^\x00-\x7F]/g, (char) => {
        const code = char.charCodeAt(0).toString(16).padStart(4, '0');
        return '\\u' + code;
    });
}
export function deactivate() {
    originalEncodedContent.clear();
}