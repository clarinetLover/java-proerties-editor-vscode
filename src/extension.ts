import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

function decodeText(text: string): string {
    return text.replace(/\\u([0-9a-f]{4})/gi, (match, hex) =>
        String.fromCharCode(parseInt(hex, 16))
    );
}

function encodeText(text: string): string {
    return text.replace(/[^\x00-\x7F]/g, (char) => {
        const code = char.charCodeAt(0).toString(16).padStart(4, '0');
        return '\\u' + code;
    });
}

class PropertiesFileSystemProvider implements vscode.FileSystemProvider {
    private _emitter = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
    readonly onDidChangeFile: vscode.Event<vscode.FileChangeEvent[]> = this._emitter.event;

    watch(): vscode.Disposable {
        return new vscode.Disposable(() => {});
    }

    stat(uri: vscode.Uri): vscode.FileStat {
        return {
            type: vscode.FileType.File,
            ctime: Date.now(),
            mtime: Date.now(),
            size: 0
        };
    }

    readDirectory(): [string, vscode.FileType][] {
        return [];
    }

    createDirectory(): void {}

    readFile(uri: vscode.Uri): Uint8Array {
        const originalPath = uri.path.replace('.decoded', '').substring(1); // Remove leading slash
        try {
            const content = fs.readFileSync(originalPath, 'utf8');
            const decoded = decodeText(content);
            return Buffer.from(decoded, 'utf8');
        } catch {
            return Buffer.from('', 'utf8');
        }
    }

    writeFile(uri: vscode.Uri, content: Uint8Array): void {
        const originalPath = uri.path.replace('.decoded', '').substring(1); // Remove leading slash
        const decodedContent = Buffer.from(content).toString('utf8');
        const encodedContent = encodeText(decodedContent);
        fs.writeFileSync(originalPath, encodedContent, 'utf8');
    }

    delete(): void {}
    rename(): void {}
}

export function activate(context: vscode.ExtensionContext) {
    const provider = new PropertiesFileSystemProvider();
    const providerRegistration = vscode.workspace.registerFileSystemProvider('properties-decoded', provider);

    const openDecodedCommand = vscode.commands.registerCommand('properties.openDecoded', async (uri: vscode.Uri) => {
        const decodedUri = vscode.Uri.parse(`properties-decoded:${uri.path}.decoded`);
        const doc = await vscode.workspace.openTextDocument(decodedUri);
        await vscode.window.showTextDocument(doc);
    });

    const onOpenProperties = vscode.workspace.onDidOpenTextDocument((document) => {
        if (document.fileName.endsWith('.properties') && document.uri.scheme === 'file') {
            vscode.commands.executeCommand('properties.openDecoded', document.uri);
            vscode.commands.executeCommand('workbench.action.closeActiveEditor');
        }
    });

    context.subscriptions.push(
        providerRegistration,
        openDecodedCommand,
        onOpenProperties
    );
}
export function deactivate() {}