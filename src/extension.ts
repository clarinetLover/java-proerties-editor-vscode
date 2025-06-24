import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

// Create output channel for logging
const outputChannel = vscode.window.createOutputChannel('Properties Extension');

function log(message: string) {
    const timestamp = new Date().toISOString();
    outputChannel.appendLine(`[${timestamp}] ${message}`);
    console.log(`[Properties Extension] ${message}`);
}

function decodeText(text: string): string {
    const matches = text.match(/\\u([0-9a-f]{4})/gi);
    if (matches) {
        log(`Decoding ${matches.length} Unicode sequences: ${matches.join(', ')}`);
    }
    
    const decoded = text.replace(/\\u([0-9a-f]{4})/gi, (match, hex) => {
        const char = String.fromCharCode(parseInt(hex, 16));
        log(`Decode: ${match} → ${char}`);
        return char;
    });
    
    log(`Decode complete: ${text.length} → ${decoded.length} chars`);
    return decoded;
}

function encodeText(text: string): string {
    const multibytes = text.match(/[^\x00-\x7F]/g);
    if (multibytes) {
        log(`Encoding ${multibytes.length} multibyte characters: ${multibytes.join(', ')}`);
    }
    
    const encoded = text.replace(/[^\x00-\x7F]/g, (char) => {
        const code = char.charCodeAt(0).toString(16).padStart(4, '0');
        const result = '\\u' + code;
        log(`Encode: ${char} → ${result}`);
        return result;
    });
    
    log(`Encode complete: ${text.length} → ${encoded.length} chars`);
    return encoded;
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
        const originalPath = uri.path.replace('.decoded', '').substring(1);
        log(`Reading file: ${originalPath}`);
        
        try {
            const content = fs.readFileSync(originalPath, 'utf8');
            log(`File content length: ${content.length} chars`);
            
            const decoded = decodeText(content);
            log(`Returning decoded content for virtual file`);
            
            return Buffer.from(decoded, 'utf8');
        } catch (error) {
            log(`Error reading file: ${error}`);
            return Buffer.from('', 'utf8');
        }
    }

    writeFile(uri: vscode.Uri, content: Uint8Array): void {
        const originalPath = uri.path.replace('.decoded', '').substring(1);
        log(`Writing to file: ${originalPath}`);
        
        const decodedContent = Buffer.from(content).toString('utf8');
        log(`Virtual file content length: ${decodedContent.length} chars`);
        
        const encodedContent = encodeText(decodedContent);
        log(`Encoded content length: ${encodedContent.length} chars`);
        
        try {
            fs.writeFileSync(originalPath, encodedContent, 'utf8');
            log(`File saved successfully`);
        } catch (error) {
            log(`Error saving file: ${error}`);
            throw error;
        }
    }

    delete(): void {}
    rename(): void {}
}

export function activate(context: vscode.ExtensionContext) {
    log('Properties Extension activated');
    
    const provider = new PropertiesFileSystemProvider();
    const providerRegistration = vscode.workspace.registerFileSystemProvider('properties-decoded', provider);

    const openDecodedCommand = vscode.commands.registerCommand('properties.openDecoded', async (uri: vscode.Uri) => {
        log(`Opening decoded view for: ${uri.path}`);
        const decodedUri = vscode.Uri.parse(`properties-decoded:${uri.path}.decoded`);
        const doc = await vscode.workspace.openTextDocument(decodedUri);
        await vscode.window.showTextDocument(doc);
        log(`Decoded view opened successfully`);
    });

    const showLogsCommand = vscode.commands.registerCommand('properties.showLogs', () => {
        outputChannel.show();
    });

    const onOpenProperties = vscode.workspace.onDidOpenTextDocument((document) => {
        if (document.fileName.endsWith('.properties') && document.uri.scheme === 'file') {
            log(`Properties file opened: ${document.fileName}`);
            vscode.commands.executeCommand('properties.openDecoded', document.uri);
            vscode.commands.executeCommand('workbench.action.closeActiveEditor');
        }
    });

    context.subscriptions.push(
        providerRegistration,
        openDecodedCommand,
        showLogsCommand,
        onOpenProperties,
        outputChannel
    );
}
export function deactivate() {
    log('Properties Extension deactivated');
    outputChannel.dispose();
}