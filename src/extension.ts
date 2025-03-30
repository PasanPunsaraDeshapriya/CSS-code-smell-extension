import * as vscode from 'vscode';
import axios from 'axios';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import * as fs from 'fs';


// Global variables
let apiProcess: ChildProcess | null = null;
const outputChannel = vscode.window.createOutputChannel('CSS Smell Detector');
let extensionContext: vscode.ExtensionContext | undefined;
let realTimeAnalysisActive = false;
let analysisDisposable: vscode.Disposable | undefined;
let analysisTimeout: NodeJS.Timeout | undefined;
let lastAnalysisTime: number | undefined; // Add this line
const analysisDebounceTime = 1000; // 1 second delay after save

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

        // Removed duplicate spawn call
        apiProcess = spawn("python", [apiPath]);

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

async function ensureAPIIsRunning(): Promise<void> {
    const maxRetries = 5;
    const retryDelay = 2000;
    
    for (let i = 0; i < maxRetries; i++) {
        try {
            await axios.get('http://127.0.0.1:5000/', { timeout: 5000 });
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
// real time Analysis Functions
// ======================

async function toggleRealTimeAnalysis() {
    if (realTimeAnalysisActive) {
        stopRealTimeAnalysis();
        vscode.window.showInformationMessage('🛑 Real-time CSS analysis stopped');
    } else {
        await startRealTimeAnalysis();
        vscode.window.showInformationMessage('🔍 Real-time CSS analysis started - will analyze on save');
    }
}


async function startRealTimeAnalysis() {
    if (realTimeAnalysisActive) return;

    realTimeAnalysisActive = true;
    outputChannel.appendLine('[Real-time] Starting continuous CSS analysis');
    
    // Initial analysis
    await analyzeCss();

    // Set up file save listener with debouncing
    analysisDisposable = vscode.workspace.onDidSaveTextDocument(async document => {
        if (document.languageId === 'css') {
            // Clear any pending analysis
            if (analysisTimeout) {
                clearTimeout(analysisTimeout);
            }
            
            // Schedule new analysis with debounce
            analysisTimeout = setTimeout(async () => {
                outputChannel.appendLine(`[Real-time] Detected changes in ${document.fileName}`);
                await analyzeCss();
            }, analysisDebounceTime);
        }
    });
}


function stopRealTimeAnalysis() {
    if (!realTimeAnalysisActive) return;

    realTimeAnalysisActive = false;
    
    // Clear any pending analysis
    if (analysisTimeout) {
        clearTimeout(analysisTimeout);
        analysisTimeout = undefined;
    }
    
    // Dispose the listener
    if (analysisDisposable) {
        analysisDisposable.dispose();
        analysisDisposable = undefined;
    }
    
    outputChannel.appendLine('[Real-time] Stopped continuous CSS analysis');
}

// ======================
// CSS Analysis Functions
// ======================

async function analyzeCss() {
    try {
        const editor = getActiveCssEditor();
        if (!editor) {
            if (realTimeAnalysisActive) {
                outputChannel.appendLine('[Real-time] No active CSS editor found');
            }
            return;
        }

        const startTime = Date.now();
        const statusMsg = vscode.window.setStatusBarMessage('🔍 Analyzing CSS...');
        
        outputChannel.appendLine(`\n[Analysis] Starting at ${new Date().toLocaleTimeString()}`);
        
        await ensureAPIIsRunning();
        
        const cssCode = editor.document.getText();
        const response = await axios.post('http://127.0.0.1:5000/predict', {
            css_code: cssCode
        }, { timeout: 120000 });

        if (!response.data?.smells) {
            throw new Error('Invalid API response');
        }

        const responseTime = Date.now() - startTime;
        lastAnalysisTime = responseTime; // Now properly typed
        
        statusMsg.dispose(); // Remove analyzing status
        
        outputChannel.appendLine(`[Analysis] Completed in ${responseTime}ms`);
        showAnalysisResults(editor, response.data, responseTime);

    } catch (error) {
        handleError('Analysis failed', error);
    }
}

function showAnalysisResults(editor: vscode.TextEditor, data: any, responseTime: number) {
    const { prediction, smells = {}, severity_level = "Unknown" } = data;
    const severity = severity_level.toLowerCase();

    let message = `Total Smells: ${prediction} | Response Time: ${responseTime}ms\n\n`;
    message += Object.entries(smells)
        .map(([smell, count]) => `${smell}: ${count} occurrences`)
        .join('\n');

    // Create a status bar item to show last analysis time
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.text = `CSS Analysis: ${responseTime}ms`;
    statusBarItem.tooltip = 'Last CSS analysis response time';
    statusBarItem.show();
    
    // Hide after 5 seconds
    setTimeout(() => statusBarItem.dispose(), 5000);
    switch (severity) {
        case "high":
            vscode.window.showErrorMessage(`🚨 High Severity (${responseTime}ms)\n${message}`);
            break;
        case "medium":
            vscode.window.showWarningMessage(`⚠️ Medium Severity (${responseTime}ms)\n${message}`);
            break;
        case "low":
            vscode.window.showInformationMessage(`☑️ Low Severity (${responseTime}ms)\n${message}`);
            break;
        case "clean":
            vscode.window.showInformationMessage(`✅ CSS is clean! (${responseTime}ms)\n${message}`);
            break;
        default:
            vscode.window.showInformationMessage(`ℹ️ Smell Analysis (${responseTime}ms)\n${message}`);
    }

    highlightSmells(editor, smells, data.features || {});

    if (lastAnalysisTime !== undefined) {
        const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        statusBarItem.text = `Last analysis: ${lastAnalysisTime}ms`;
        statusBarItem.show();
        setTimeout(() => statusBarItem.dispose(), 5000);
    }
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
        const changes: { line: number, oldText: string, newText: string }[] = [];
        const cssCode = document.getText();
        const optimized = optimizeCssShorthand(cssCode, changes);

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

        if (changes.length > 0) {
            showChangedLines(editor, changes.map(c => c.line));
            vscode.window.showInformationMessage(
                `Optimized ${changes.length} properties across ${new Set(changes.map(c => c.line)).size} lines`,
                'Show Changes'
            ).then(choice => {
                if (choice === 'Show Changes') {
                    outputChannel.appendLine('\nOptimization Changes:');
                    changes.forEach(change => {
                        outputChannel.appendLine(
                            `Line ${change.line}: ${change.oldText.trim()} → ${change.newText.trim()}`
                        );
                    });
                    outputChannel.show();
                }
            });
        } else {
            vscode.window.showInformationMessage('No optimizations were needed');
        }
    } catch (error) {
        handleError('Optimization failed', error);
    }
}

function optimizeCssShorthand(cssCode: string, changeTracker?: { line: number, oldText: string, newText: string }[]): string {
    const lines = cssCode.split('\n');
    const optimizedLines: string[] = [];
    let currentRule: { selector: string, startLine: number } | null = null;
    let properties: Record<string, string> = {};

    for (let lineNumber = 0; lineNumber < lines.length; lineNumber++) {
        const line = lines[lineNumber];
        const trimmedLine = line.trim();

        if (trimmedLine.endsWith('{')) {
            if (currentRule) {
                // Close previous rule if not properly closed
                optimizedLines.push(optimizeRule(currentRule.selector, properties, currentRule.startLine, changeTracker));
                properties = {};
            }
            currentRule = {
                selector: trimmedLine,
                startLine: lineNumber
            };
            optimizedLines.push(line);
        } else if (trimmedLine.endsWith('}')) {
            if (currentRule) {
                optimizedLines.push(optimizeRule(currentRule.selector, properties, currentRule.startLine, changeTracker));
                properties = {};
                currentRule = null;
            }
            optimizedLines.push(line);
        } else if (currentRule) {
            const [property, value] = trimmedLine.split(':').map(s => s.trim());
            if (property && value) {
                // Only add property if it doesn't already exist
                if (!properties[property]) {
                    properties[property] = value.replace(/;$/, '');
                }
            }
            // Don't push the line here - we'll reconstruct from optimized properties
        } else {
            optimizedLines.push(line);
        }
    }

    return optimizedLines.join('\n');
}

// ======================
// optimizeRule Function
// ======================

function optimizeRule(selector: string, properties: Record<string, string>, lineNumber: number, changeTracker?: { line: number, oldText: string, newText: string }[]): string {
    const optimized: Record<string, string> = { ...properties };

    // Handle padding
    if (optimized['padding-top'] && optimized['padding-right'] && 
        optimized['padding-bottom'] && optimized['padding-left']) {
        const oldValue = [
            `padding-top: ${optimized['padding-top']};`,
            `padding-right: ${optimized['padding-right']};`,
            `padding-bottom: ${optimized['padding-bottom']};`,
            `padding-left: ${optimized['padding-left']};`
        ].join('\n');
        
        optimized['padding'] = `${optimized['padding-top']} ${optimized['padding-right']} ${optimized['padding-bottom']} ${optimized['padding-left']}`;
        
        if (changeTracker) {
            changeTracker.push({
                line: lineNumber + 1,
                oldText: oldValue,
                newText: `padding: ${optimized['padding']};`
            });
        }
        
        delete optimized['padding-top'];
        delete optimized['padding-right'];
        delete optimized['padding-bottom'];
        delete optimized['padding-left'];
    }

    // Handle margin
    if (optimized['margin-top'] && optimized['margin-right'] && 
        optimized['margin-bottom'] && optimized['margin-left']) {
        const oldValue = [
            `margin-top: ${optimized['margin-top']};`,
            `margin-right: ${optimized['margin-right']};`,
            `margin-bottom: ${optimized['margin-bottom']};`,
            `margin-left: ${optimized['margin-left']};`
        ].join('\n');
        
        optimized['margin'] = `${optimized['margin-top']} ${optimized['margin-right']} ${optimized['margin-bottom']} ${optimized['margin-left']}`;
        
        if (changeTracker) {
            changeTracker.push({
                line: lineNumber + 1,
                oldText: oldValue,
                newText: `margin: ${optimized['margin']};`
            });
        }
        
        delete optimized['margin-top'];
        delete optimized['margin-right'];
        delete optimized['margin-bottom'];
        delete optimized['margin-left'];
    }

    // Handle border
    if (optimized['border-top'] && optimized['border-right'] && 
        optimized['border-bottom'] && optimized['border-left']) {
        if (optimized['border-top'] === optimized['border-right'] && 
            optimized['border-right'] === optimized['border-bottom'] && 
            optimized['border-bottom'] === optimized['border-left']) {
            const oldValue = [
                `border-top: ${optimized['border-top']};`,
                `border-right: ${optimized['border-right']};`,
                `border-bottom: ${optimized['border-bottom']};`,
                `border-left: ${optimized['border-left']};`
            ].join('\n');
            
            optimized['border'] = optimized['border-top'];
            
            if (changeTracker) {
                changeTracker.push({
                    line: lineNumber + 1,
                    oldText: oldValue,
                    newText: `border: ${optimized['border']};`
                });
            }
            
            delete optimized['border-top'];
            delete optimized['border-right'];
            delete optimized['border-bottom'];
            delete optimized['border-left'];
        }
    }

    // Convert the optimized properties to CSS lines
    return Object.entries(optimized)
        .map(([prop, val]) => `  ${prop}: ${val};`)
        .join('\n');
}



// ======================
// Helper Functions
// ======================

function showChangedLines(editor: vscode.TextEditor, lineNumbers: number[]) {
    const decorations = lineNumbers.map(lineNo => {
        const line = editor.document.lineAt(lineNo - 1);
        return {
            range: line.range,
            hoverMessage: 'Modified by CSS optimization'
        };
    });

    const decorationType = vscode.window.createTextEditorDecorationType({
        backgroundColor: 'rgba(100, 255, 100, 0.2)',
        border: '1px solid rgba(100, 255, 100, 0.5)',
        overviewRulerColor: 'rgba(100, 255, 100, 0.5)'
    });

    editor.setDecorations(decorationType, decorations);
    setTimeout(() => decorationType.dispose(), 5000);
}

// ======================
// Quick Fix Function Function with Line Tracking
// ======================

async function quickFix() {
    try {
        outputChannel.appendLine('Applying quick fix...');
        const editor = getActiveCssEditor();
        if (!editor) return;

        const quickFixOptions = [
            {
                label: "Replace !important with better specificity",
                action: (doc: vscode.TextDocument) => applyImportantFix(doc)
            },
            {
                label: "Convert ID selector to class",
                action: (doc: vscode.TextDocument) => convertIdToClass(doc)
            },
            {
                label: "Remove empty class",
                action: (doc: vscode.TextDocument) => removeEmptyClasses(doc)
            },
            {
                label: "Reduce excessive z-index",
                action: (doc: vscode.TextDocument) => reduceZIndex(doc)
            },
            {
                label: "Optimize redundant properties",
                action: (doc: vscode.TextDocument) => optimizeRedundantProperties(doc)
            }
        ];

        const selection = await vscode.window.showQuickPick(
            quickFixOptions.map(option => option.label),
            { placeHolder: 'Select a quick fix to apply' }
        );

        if (!selection) return;

        const selectedFix = quickFixOptions.find(option => option.label === selection);
        if (!selectedFix) return;

        const { document } = editor;
        const { edits, changedLines } = await selectedFix.action(document);

        const success = await editor.edit(editBuilder => {
            edits.forEach(edit => editBuilder.replace(edit.range, edit.newText));
        });

        if (!success) {
            throw new Error('Edit operation failed');
        }

        if (changedLines.length > 0) {
            showChangedLines(editor, changedLines);
            vscode.window.showInformationMessage(
                `Applied fix to lines: ${changedLines.join(', ')}`,
                'Show Changes'
            ).then(choice => {
                if (choice === 'Show Changes') {
                    outputChannel.appendLine(`Changes made by "${selection}":`);
                    edits.forEach(edit => {
                        const lineNumber = editor.document.positionAt(document.offsetAt(edit.range.start)).line + 1;
                        outputChannel.appendLine(
                            `Line ${lineNumber}: ${document.getText(edit.range)} → ${edit.newText}`
                        );
                    });
                    outputChannel.show();
                }
            });
        } else {
            vscode.window.showInformationMessage('No changes were needed');
        }
    } catch (error) {
        handleError('Quick fix failed', error);
    }
}

async function applyImportantFix(document: vscode.TextDocument) {
    const edits: vscode.TextEdit[] = [];
    const changedLines: number[] = [];

    for (let i = 0; i < document.lineCount; i++) {
        const line = document.lineAt(i);
        if (line.text.includes('!important')) {
            edits.push(vscode.TextEdit.replace(
                line.range,
                line.text.replace(/!important/g, '')
            ));
            changedLines.push(i + 1); // +1 for 1-based line numbers
        }
    }

    return { edits, changedLines };
}

async function convertIdToClass(document: vscode.TextDocument) {
    const edits: vscode.TextEdit[] = [];
    const changedLines: number[] = [];

    for (let i = 0; i < document.lineCount; i++) {
        const line = document.lineAt(i);
        const newText = line.text.replace(/#([a-zA-Z][\w-]*)(?=[^\w-]|$)/g, '.$1');
        if (newText !== line.text) {
            edits.push(vscode.TextEdit.replace(line.range, newText));
            changedLines.push(i + 1);
        }
    }

    return { edits, changedLines };
}

async function removeEmptyClasses(document: vscode.TextDocument) {
    const edits: vscode.TextEdit[] = [];
    const changedLines: number[] = [];
    let inEmptyClass = false;
    let emptyClassStart: vscode.Position | null = null;
    let emptyClassSelector = '';

    // First pass: identify empty classes
    for (let i = 0; i < document.lineCount; i++) {
        const line = document.lineAt(i);
        const text = line.text.trim();

        // Check for class selector opening
        if (text.match(/^\.[a-zA-Z][\w-]*\s*\{\s*$/) && !inEmptyClass) {
            inEmptyClass = true;
            emptyClassStart = line.range.start;
            emptyClassSelector = text.replace(/\{\s*$/, '').trim();
            continue;
        }

        // If we're in a potential empty class
        if (inEmptyClass) {
            // If we find content (not just whitespace or comments), it's not empty
            if (text && !text.match(/^\s*(\/\*.*\*\/)?\s*$/) && !text.match(/^\s*\}/)) {
                inEmptyClass = false;
                emptyClassStart = null;
                continue;
            }

            // Check for closing brace of empty class
            if (text.match(/^\s*\}\s*$/)) {
                if (emptyClassStart) {
                    const range = new vscode.Range(
                        emptyClassStart,
                        line.range.end
                    );
                    edits.push(vscode.TextEdit.delete(range));
                    changedLines.push(i + 1); // +1 for 1-based line numbers
                    outputChannel.appendLine(`Removed empty class: ${emptyClassSelector}`);
                }
                inEmptyClass = false;
                emptyClassStart = null;
            }
        }
    }

    return { edits, changedLines };
}

async function reduceZIndex(document: vscode.TextDocument) {
    const edits: vscode.TextEdit[] = [];
    const changedLines: number[] = [];

    for (let i = 0; i < document.lineCount; i++) {
        const line = document.lineAt(i);
        const newText = line.text.replace(/z-index:\s*\d{3,}/g, 'z-index: 10');
        if (newText !== line.text) {
            edits.push(vscode.TextEdit.replace(line.range, newText));
            changedLines.push(i + 1);
        }
    }

    return { edits, changedLines };
}

async function optimizeRedundantProperties(document: vscode.TextDocument) {
    const edits: vscode.TextEdit[] = [];
    const changedLines: number[] = [];
    const changes: { line: number, oldText: string, newText: string }[] = [];

    const originalText = document.getText();
    const optimized = optimizeCssShorthand(originalText, changes);

    // Only proceed if changes were actually made
    if (optimized !== originalText) {
        edits.push(vscode.TextEdit.replace(
            new vscode.Range(
                document.positionAt(0),
                document.positionAt(originalText.length)
            ),
            optimized
        ));

        changedLines.push(...changes.map(change => change.line));
    }

    return { edits, changedLines };
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
        vscode.commands.registerCommand('css-smell-detect.toggleRealtime', toggleRealTimeAnalysis),
        outputChannel
    );
}
export function deactivate() {
    stopRealTimeAnalysis();
    if (apiProcess) {
        apiProcess.kill();
    }
    outputChannel.dispose();
}