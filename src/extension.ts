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

interface ValidationRules {
    requiredKeys: string[];
    doValidation: boolean;
    keyPattern: string;
    allowEmptyValue: boolean;
}

function validatePropertiesWithRules(text: string, rules: ValidationRules): string[] {
    const errors: string[] = [];
    if (!rules.doValidation) {
        return errors;
    }

    const lines = text.split(/\r?\n/);
    const seenKeys = new Set<string>();
    lines.forEach((line, index) => {
        const trimmed = line.trim();

        // 空行・コメント行（#または!または-または_）はスキップ
        if (trimmed === '' || /^[#!-_]/.test(trimmed)) return;

        // プロパティ形式解析（key[=:]value）
        const match = /^([^=:\s]+)\s*[=:]\s*(.*)$/.exec(trimmed);
        if (!match) {
            errors.push(`行 ${index + 1}: プロパティ形式が正しくありません → "${line}"`);
            return;
        }

        const [_, key, value] = match;
        seenKeys.add(key);

        // キーのパターンチェック
        if (rules.keyPattern && !new RegExp(rules.keyPattern).test(key)) {
            errors.push(`行 ${index + 1}: キー "${key}" はルールに一致しません`);
        }

        // 値の存在チェック
        if (!rules.allowEmptyValue && value.trim() === '') {
            errors.push(`行 ${index + 1}: 値が空です`);
        }
    });

    // 必須キーの存在チェック
    for (const requiredKey of rules.requiredKeys) {
        if (!seenKeys.has(requiredKey)) {
            errors.push(`必須キー "${requiredKey}" が存在しません`);
        }
    }

    return errors;
}

function getValidationSettings(): ValidationRules {
    const config = vscode.workspace.getConfiguration('propertiesExtension.validation');
    return {
        requiredKeys: config.get<string[]>('requiredKeys', []),
        doValidation: config.get<boolean>('doValidation', false),
        keyPattern: config.get<string>('keyPattern', '^[a-zA-Z0-9_.-]+$'),
        allowEmptyValue: config.get<boolean>('allowEmptyValue', true),
    };
}

class GitPropertiesContentProvider implements vscode.TextDocumentContentProvider {
    private _onDidChange = new vscode.EventEmitter<vscode.Uri>();
    readonly onDidChange = this._onDidChange.event;

    async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
        log(`Git content provider called for: ${uri.toString()}`);

        try {
            // Get the original git content
            const gitDoc = await vscode.workspace.openTextDocument(vscode.Uri.parse(uri.query));
            const content = gitDoc.getText();
            log(`Git content length: ${content.length} chars`);

            // Decode the content
            const decoded = decodeText(content);
            log(`Returning decoded git content`);

            return decoded;
        } catch (error) {
            log(`Error getting git content: ${error}`);
            return '';
        }
    }
}

class PropertiesFileSystemProvider implements vscode.FileSystemProvider {
    private _emitter = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
    readonly onDidChangeFile: vscode.Event<vscode.FileChangeEvent[]> = this._emitter.event;

    watch(): vscode.Disposable {
        return new vscode.Disposable(() => { });
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

    createDirectory(): void { }

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
        const settings = getValidationSettings();
        const validationErrors = validatePropertiesWithRules(decodedContent, settings);
        if (validationErrors.length > 0) {
            const message = `保存できません：${validationErrors.length} 件のバリデーションエラーがあります。\n\n` +
                validationErrors.join('\n');
            log(message);
            vscode.window.showErrorMessage(message);
            throw new Error('Validation failed. Save aborted.');
        }
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

    delete(): void { }
    rename(): void { }
}

export function activate(context: vscode.ExtensionContext) {
    log('Properties Extension activated');

    const provider = new PropertiesFileSystemProvider();
    const providerRegistration = vscode.workspace.registerFileSystemProvider('properties-decoded', provider);

    const gitProvider = new GitPropertiesContentProvider();
    const gitProviderRegistration = vscode.workspace.registerTextDocumentContentProvider('git-properties-decoded', gitProvider);

    const openDecodedCommand = vscode.commands.registerCommand('properties.openDecoded', async (uri?: vscode.Uri) => {
        if (uri === undefined) {
            const activeEditor = vscode.window.activeTextEditor;
            if (!activeEditor) {
                vscode.window.showErrorMessage('アクティブなエディターがありません');
                return;
            }
            uri = activeEditor.document.uri;
        }
        log(`Opening decoded view for: ${uri.path}`);
        const decodedUri = vscode.Uri.parse(`properties-decoded:${uri.path}.decoded`);
        const doc = await vscode.workspace.openTextDocument(decodedUri);
        await vscode.languages.setTextDocumentLanguage(doc, 'properties');
        await vscode.window.showTextDocument(doc);
        log(`Decoded view opened successfully`);
    });

    const showLogsCommand = vscode.commands.registerCommand('properties.showLogs', () => {
        outputChannel.show();
    });

    context.subscriptions.push(
        providerRegistration,
        gitProviderRegistration,
        openDecodedCommand,
        showLogsCommand,
        outputChannel
    );
}
export function deactivate() {
    log('Properties Extension deactivated');
    outputChannel.dispose();
}