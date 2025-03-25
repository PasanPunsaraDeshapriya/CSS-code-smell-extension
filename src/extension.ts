import * as vscode from 'vscode';
import axios from 'axios';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import * as fs from 'fs';


// Global variables
let apiProcess: ChildProcess | null = null;
const outputChannel = vscode.window.createOutputChannel('CSS Smell Detector');
let extensionContext: vscode.ExtensionContext | undefined;

// ======================
// Utility Functions
// ======================

function getActiveCssEditor(): vscode.TextEditor | undefined {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showErrorMessage('No active editor found');
        return;
    }
    if (editor.document.languageId !== 'css') {
        vscode.window.showErrorMessage('Active file is not a CSS file');
        return;
    }
    return editor;
}

function handleError(message: string, error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    outputChannel.appendLine(`${message}: ${errorMessage}`);
    vscode.window.showErrorMessage(
        `${message}. See output for details.`,
        'Open Output'
    ).then(choice => {
        if (choice === 'Open Output') {
            outputChannel.show();
        }
    });
}

// ======================
// API Management
// ======================

function startAPI() {
    if (!apiProcess) {
        outputChannel.appendLine('Starting Flask API...');
        if (!extensionContext) {
            outputChannel.appendLine('Error: Extension context not available');
            vscode.window.showErrorMessage('Extension context not initialized');
            return;
        }

        const apiPath = path.join(extensionContext.extensionPath, 'src', 'api', 'css_smell_api.py');
        outputChannel.appendLine(`API Path: ${apiPath}`);

        if (!fs.existsSync(apiPath)) {
            const errorMsg = `API file not found at ${apiPath}`;
            outputChannel.appendLine(errorMsg);
            vscode.window.showErrorMessage(errorMsg);
            return;
        }

        apiProcess = spawn("python", [apiPath]);

        // Correct way to get the API path
        // const apiPath = path.join(extension.extensionPath, 'src', 'api', 'css_smell_api.py');
        // outputChannel.appendLine(`API Path: ${apiPath}`);  // Debug output

         // Verify file exists
         if (!fs.existsSync(apiPath)) {
            outputChannel.appendLine(`Error: API file not found at ${apiPath}`);
            return;
        }

        apiProcess = spawn("python", [apiPath]);
        // apiProcess = spawn("python", ["D:/Documents/IIT/FYP/CSS-code-smell-extension/src/api/css_smell_api.py"]);

        apiProcess.stdout?.on("data", (data: Buffer) => {
            outputChannel.appendLine(`API: ${data.toString()}`);
        });

        apiProcess.stderr?.on("data", (data: Buffer) => {
            outputChannel.appendLine(`API Error: ${data.toString()}`);
        });

        apiProcess.on("exit", (code: number | null) => {
            outputChannel.appendLine(`API exited with code ${code}`);
            apiProcess = null;
            if (code !== 0) {
                setTimeout(startAPI, 2000);
            }
        });

        apiProcess.on("error", (err: Error) => {
            outputChannel.appendLine(`API Error: ${err.message}`);
            apiProcess = null;
            setTimeout(startAPI, 2000);
        });
    }
}

// async function ensureAPIIsRunning(): Promise<void> {
//     const maxRetries = 3;
//     for (let i = 0; i < maxRetries; i++) {
//         try {
//             await axios.get('http://127.0.0.1:5000/', { timeout: 1000 });
//             return;
//         } catch (error) {
//             if (i === maxRetries - 1) throw error;
//             startAPI();
//             await new Promise(resolve => setTimeout(resolve, 2000));
//         }
//     }
// }

async function ensureAPIIsRunning(): Promise<void> {
    const maxRetries = 5;
    const retryDelay = 2000;
    
    for (let i = 0; i < maxRetries; i++) {
        try {
            await axios.get('http://127.0.0.1:5000/', { timeout: 1000 });
            return;
        } catch (error) {
            if (i === 0) startAPI(); // Start API on first attempt
            
            if (i === maxRetries - 1) {
                throw new Error(`Failed to connect to API after ${maxRetries} attempts`);
            }
            
            await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
    }
}

// ======================
// CSS Analysis Functions
// ======================

async function analyzeCss() {
    try {
        outputChannel.appendLine('Starting CSS analysis...');
        const editor = getActiveCssEditor();
        if (!editor) return;

        const cssCode = editor.document.getText();
        outputChannel.appendLine('Sending CSS to API...');

        await ensureAPIIsRunning();
        const response = await axios.post('http://127.0.0.1:5000/predict', {
            css_code: cssCode
        }, { timeout: 30000 });

        if (!response.data?.smells) {
            throw new Error('Invalid API response');
        }

        showAnalysisResults(editor, response.data);
    } catch (error) {
        handleError('Analysis failed', error);
    }
}

function showAnalysisResults(editor: vscode.TextEditor, data: any) {
    const { prediction, smells = {}, severity_level = "Unknown" } = data;
    const severity = severity_level.toLowerCase();

    let message = `Total Smells: ${prediction}\n\n`;
    message += Object.entries(smells)
        .map(([smell, count]) => `${smell}: ${count} occurrences`)
        .join('\n');

    if (severity === "high") {
        vscode.window.showErrorMessage(`🚨 High Severity Detected!\n${message}`);
    } else if (severity === "medium" || severity === "low") {
        vscode.window.showWarningMessage(`⚠️ ${severity_level} Severity\n${message}`);
    } else {
        vscode.window.showInformationMessage(`ℹ️ Analysis Results\n${message}`);
    }

    highlightSmells(editor, smells, data.features || {});
}


// ======================
// CSS Smells highlight
//  Functions
// ======================

function highlightSmells(editor: vscode.TextEditor, smells: Record<string, number>, features: Record<string, number>) {
    const smellTypes: Record<string, vscode.DecorationOptions[]> = {
        important: [],
        deepNesting: [],
        longSelector: [],
        universalSelector: [],
        vendorPrefix: [],
        inlineStyle: [],
        highZIndex: [],
        overqualified: [],
        duplicate: []
    };

    for (let i = 0; i < editor.document.lineCount; i++) {
        const line = editor.document.lineAt(i);
        const text = line.text;

        if (text.includes('!important') && features.num_important > 0) {
            smellTypes.important.push({ range: line.range, hoverMessage: '⚠️ Avoid using !important' });
        }

        if ((text.match(/\{/g) || []).length > 1 && features.deep_nesting > 0) {
            smellTypes.deepNesting.push({ range: line.range, hoverMessage: '⚠️ Deep nesting detected' });
        }

        if (text.length > 100 && features.long_selectors > 0) {
            smellTypes.longSelector.push({ range: line.range, hoverMessage: '⚠️ Long selector - consider shortening' });
        }

        if (text.includes('*') && features.universal_selectors > 0) {
            smellTypes.universalSelector.push({ range: line.range, hoverMessage: '⚠️ Avoid universal selectors (*)' });
        }

        if (text.match(/-webkit-|-moz-|-ms-|-o-/g) && features.vendor_prefixes > 0) {
            smellTypes.vendorPrefix.push({ range: line.range, hoverMessage: '⚠️ Vendor-specific prefixes detected' });
        }

        if (text.includes('style=') && features.inline_styles > 0) {
            smellTypes.inlineStyle.push({ range: line.range, hoverMessage: '⚠️ Inline styles detected' });
        }

        if (text.match(/z-index\s*:\s*\d+/) && features.excessive_zindex > 0) {
            smellTypes.highZIndex.push({ range: line.range, hoverMessage: '⚠️ High z-index value' });
        }

        if ((text.includes('html') || text.includes('body')) && features.overqualified_selectors > 0) {
            smellTypes.overqualified.push({ range: line.range, hoverMessage: '⚠️ Overqualified selector (html/body)' });
        }

        if ((text.match(/^[a-zA-Z0-9.#: \[\]=]+(?=\s*\{)/) || []).length > 1 && features.duplicate_selectors > 0) {
            smellTypes.duplicate.push({ range: line.range, hoverMessage: '⚠️ Possible duplicate selector' });
        }
    }

    const decorationTypes: Record<string, vscode.TextEditorDecorationType> = {
        important: vscode.window.createTextEditorDecorationType({ backgroundColor: 'rgba(255,0,0,0.1)', border: '1px solid rgba(255,0,0,0.3)' }),
        deepNesting: vscode.window.createTextEditorDecorationType({ backgroundColor: 'rgba(255,165,0,0.1)', border: '1px solid rgba(255,165,0,0.3)' }),
        longSelector: vscode.window.createTextEditorDecorationType({ backgroundColor: 'rgba(255,215,0,0.1)', border: '1px solid rgba(255,215,0,0.3)' }),
        universalSelector: vscode.window.createTextEditorDecorationType({ backgroundColor: 'rgba(0,128,128,0.1)', border: '1px solid rgba(0,128,128,0.3)' }),
        vendorPrefix: vscode.window.createTextEditorDecorationType({ backgroundColor: 'rgba(70,130,180,0.1)', border: '1px solid rgba(70,130,180,0.3)' }),
        inlineStyle: vscode.window.createTextEditorDecorationType({ backgroundColor: 'rgba(138,43,226,0.1)', border: '1px solid rgba(138,43,226,0.3)' }),
        highZIndex: vscode.window.createTextEditorDecorationType({ backgroundColor: 'rgba(169,169,169,0.1)', border: '1px solid rgba(169,169,169,0.3)' }),
        overqualified: vscode.window.createTextEditorDecorationType({ backgroundColor: 'rgba(220,20,60,0.1)', border: '1px solid rgba(220,20,60,0.3)' }),
        duplicate: vscode.window.createTextEditorDecorationType({ backgroundColor: 'rgba(255,20,147,0.1)', border: '1px solid rgba(255,20,147,0.3)' })
    };

    for (const key in smellTypes) {
        if (smellTypes[key].length > 0) {
            editor.setDecorations(decorationTypes[key], smellTypes[key]);
        }
    }
}


// ======================
// CSS Optimization Functions
// ======================

async function optimizeCss() {
    try {
        outputChannel.appendLine('Optimizing CSS...');
        const editor = getActiveCssEditor();
        if (!editor) return;

        const { document } = editor;
        const cssCode = document.getText();
        const optimized = optimizeCssShorthand(cssCode);

        const success = await editor.edit(editBuilder => {
            editBuilder.replace(
                new vscode.Range(
                    document.positionAt(0),
                    document.positionAt(cssCode.length)
                ),
                optimized
            );
        });

        if (!success) {
            throw new Error('Edit operation failed');
        }

        vscode.window.showInformationMessage('CSS optimized successfully!');
    } catch (error) {
        handleError('Optimization failed', error);
    }
}

function optimizeCssShorthand(cssCode: string): string {
    const lines = cssCode.split('\n');
    const optimizedLines: string[] = [];
    let currentRule: string | null = null;
    let properties: Record<string, string> = {};

    for (const line of lines) {
        const trimmedLine = line.trim();

        if (trimmedLine.endsWith('{')) {
            if (currentRule) {
                optimizedLines.push(optimizeRule(currentRule, properties));
                properties = {};
            }
            currentRule = trimmedLine;
            optimizedLines.push(line);
        } else if (trimmedLine.endsWith('}')) {
            if (currentRule) {
                optimizedLines.push(optimizeRule(currentRule, properties));
                properties = {};
            }
            currentRule = null;
            optimizedLines.push(line);
        } else if (currentRule) {
            const [property, value] = trimmedLine.split(':').map(s => s.trim());
            if (property && value) {
                properties[property] = value.replace(';', '');
            }
        } else {
            optimizedLines.push(line);
        }
    }

    return optimizedLines.join('\n');
}

function optimizeRule(rule: string, properties: Record<string, string>): string {
    const optimized: Record<string, string> = { ...properties };

    // Handle padding
    if (optimized['padding-top'] && optimized['padding-right'] &&
        optimized['padding-bottom'] && optimized['padding-left']) {
        optimized['padding'] = `${optimized['padding-top']} ${optimized['padding-right']} ${optimized['padding-bottom']} ${optimized['padding-left']}`;
        delete optimized['padding-top'];
        delete optimized['padding-right'];
        delete optimized['padding-bottom'];
        delete optimized['padding-left'];
    }

    // Handle margin
    if (optimized['margin-top'] && optimized['margin-right'] &&
        optimized['margin-bottom'] && optimized['margin-left']) {
        optimized['margin'] = `${optimized['margin-top']} ${optimized['margin-right']} ${optimized['margin-bottom']} ${optimized['margin-left']}`;
        delete optimized['margin-top'];
        delete optimized['margin-right'];
        delete optimized['margin-bottom'];
        delete optimized['margin-left'];
    }

    return Object.entries(optimized)
        .map(([prop, val]) => `  ${prop}: ${val};`)
        .join('\n');
}

// ======================
// Quick Fix Function
// ======================

async function quickFix() {
    try {
        outputChannel.appendLine('Applying quick fix...');
        const editor = getActiveCssEditor();
        if (!editor) return;

        const selection = await vscode.window.showQuickPick([
            "Replace !important with better specificity",
            "Convert ID selector to class",
            "Remove empty class",
            "Reduce excessive z-index",
            "Optimize redundant properties"
        ]);

        if (!selection) return;

        const { document } = editor;
        const fullText = document.getText();
        let modifiedText = fullText;

        switch (selection) {
            case "Replace !important with better specificity":
                modifiedText = fullText.replace(/!important/g, '');
                break;
            case "Convert ID selector to class":
                modifiedText = fullText.replace(/#([a-zA-Z][\w-]*)(?=[^\w-]|$)/g, '.$1');
                break;
            case "Remove empty class":
                modifiedText = fullText.replace(/\.[a-zA-Z][\w-]*\s*\{\s*\}/g, '');
                break;
            case "Reduce excessive z-index":
                modifiedText = fullText.replace(/z-index:\s*\d{3,}/g, 'z-index: 10');
                break;
            case "Optimize redundant properties":
                modifiedText = optimizeCssShorthand(fullText);
                break;
        }

        const success = await editor.edit(editBuilder => {
            editBuilder.replace(
                new vscode.Range(
                    document.positionAt(0),
                    document.positionAt(fullText.length)
                ),
                modifiedText
            );
        });

        if (!success) {
            throw new Error('Edit operation failed');
        }

        vscode.window.showInformationMessage(`Applied fix: ${selection}`);
    } catch (error) {
        handleError('Quick fix failed', error);
    }
}

// ======================
// Extension Activation
// ======================

export function activate(context: vscode.ExtensionContext) {

    // Store context globally
    extensionContext = context;

    outputChannel.appendLine('Extension activated');
    
    // Start API with proper context
    startAPI();

    // outputChannel.appendLine('Extension activated');
    // startAPI();

    context.subscriptions.push(
        vscode.commands.registerCommand('css-smell-detect.analyze', analyzeCss),
        vscode.commands.registerCommand('css-smell-detect.optimize', optimizeCss),
        vscode.commands.registerCommand('css-smell-detect.quickFix', quickFix),
        outputChannel
    );
}
export function deactivate() {
    if (apiProcess) {
        apiProcess.kill();
    }
    outputChannel.dispose();
}