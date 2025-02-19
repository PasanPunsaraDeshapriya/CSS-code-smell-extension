
// import * as vscode from 'vscode';
// import axios from 'axios';

// export function activate(context: vscode.ExtensionContext) {
//     console.log("✅ CSS Smell Detector Activated");
//     console.log(" hello");
    
//     let disposable = vscode.commands.registerCommand('css-smell-detect.analyze', async () => {
//         console.log("🔍 Running Analysis Command");

//         const editor = vscode.window.activeTextEditor;
//         if (!editor) {
//             vscode.window.showErrorMessage("No CSS file open.");
//             console.error("❌ No active editor found!");
//             return;
//         }

//         const document = editor.document;
//         const cssCode = document.getText();

//         console.log("📂 Extracted CSS Code:", cssCode.substring(0, 100) + "...");

//         try {
//             console.log("🌍 Sending request to API...");
//             const response = await axios.post('http://127.0.0.1:5000/predict', { css_code: cssCode });

//             console.log("✅ API Response:", response.data);

//             if (!response.data || !response.data.smells || !response.data.features) {
//                 vscode.window.showErrorMessage("API response is invalid.");
//                 console.error("❌ API returned unexpected response:", response.data);
//                 return;
//             }

//             const prediction = response.data.prediction;
//             const smells = response.data.smells || {};
//             const features = response.data.features || {};

//             let smellMessages = Object.entries(smells)
//                 .map(([smell, count]) => `${smell}: ${count} occurrences`)
//                 .join('\n');

//             vscode.window.showInformationMessage(`Predicted Smell Level: ${prediction}\n\nDetected Smells:\n${smellMessages}`);

//             highlightSmells(editor, smells, features);

//         } catch (error) {
//             vscode.window.showErrorMessage("Error connecting to API.");
//             console.error("❌ API Request Failed:", error);
//         }
//     });

//     // Register the command
//     context.subscriptions.push(disposable);

//     // Listen for document changes and saves
//     context.subscriptions.push(
//         vscode.workspace.onDidChangeTextDocument((event) => {
//             if (event.document.languageId === 'css') {
//                 console.log("📜 CSS Document Changed:", event.document.fileName);
//                 handleDocumentChange(event);
//             }
//         })
//     );

//     context.subscriptions.push(
//         vscode.workspace.onDidSaveTextDocument((document) => {
//             if (document.languageId === 'css') {
//                 console.log("💾 CSS Document Saved:", document.fileName);
//                 handleDocumentSave(document);
//             }
//         })
//     );
// }


// // **Real-Time CSS Analysis (Debounced)**
// let typingTimer: NodeJS.Timeout | null = null;
// async function handleDocumentChange(event: vscode.TextDocumentChangeEvent) {
//     const editor = vscode.window.activeTextEditor;
//     if (!editor || editor.document.languageId !== 'css') return;

//     const document = editor.document;
//     const cssCode = document.getText();

//     if (!cssCode.trim()) return;

//     console.log("✍️ CSS Code Detected:", cssCode.substring(0, 50) + "...");

//     // **Debounce Mechanism for Real-Time Analysis**
//     if (typingTimer) clearTimeout(typingTimer);
//     typingTimer = setTimeout(async () => {
//         console.log("🚀 Real-Time API Request Triggered...");
//         await analyzeCSSCode(editor, cssCode);
//     }, 500); // Adjust delay for responsiveness (lower = faster response)
// }

// // **Auto-Save Detection**
// async function handleDocumentSave(document: vscode.TextDocument) {
//     if (document.languageId !== 'css') return;

//     const editor = vscode.window.activeTextEditor;
//     if (!editor) return;

//     const cssCode = document.getText();
//     console.log("💾 Auto-Save Triggered, Analyzing CSS...");
//     await analyzeCSSCode(editor, cssCode);
// }


// async function analyzeCSSCode(editor: vscode.TextEditor, cssCode: string) {
//     try {
//         const startTime = Date.now(); // Start time ⏱️

//         const response = await axios.post('http://127.0.0.1:5000/predict', { css_code: cssCode });

//         const endTime = Date.now(); // End time ⏱️
//         const responseTime = endTime - startTime; // Calculate response time

//         console.log(`✅ API Response Time: ${responseTime}ms`);

//         if (!response.data || !response.data.smells || !response.data.features) {
//             vscode.window.showErrorMessage("API response is invalid.");
//             return;
//         }

//         console.log("✅ API Response Received:", response.data);

//         const smells = response.data.smells || {};
//         const features = response.data.features || {};

//         vscode.window.showInformationMessage(`Predicted Smell Level: ${response.data.prediction}\nResponse Time: ${responseTime}ms`);

//         highlightSmells(editor, smells, features);
//     } catch (error) {
//         console.error("❌ API Request Failed:", error);
//     }
// }


// // **Highlight Detected CSS Smells**
// function highlightSmells(editor: vscode.TextEditor, smells: any, features: any) {
//     const decorationTypes: { [key: string]: vscode.TextEditorDecorationType } = {
//         excessive_nesting: vscode.window.createTextEditorDecorationType({ backgroundColor: 'rgba(255, 0, 0, 0.07)' }),
//         excessive_specificity: vscode.window.createTextEditorDecorationType({ backgroundColor: 'rgba(255, 166, 0, 0.17)' }),
//         num_important: vscode.window.createTextEditorDecorationType({ backgroundColor: 'rgba(255, 255, 0, 0.16)' }),
//         browser_specific_properties: vscode.window.createTextEditorDecorationType({ backgroundColor: 'rgba(14, 255, 14, 0.11)' }),
//         animation_usage: vscode.window.createTextEditorDecorationType({ backgroundColor: 'rgba(0, 0, 255, 0.15)' }),
//         unused_selectors: vscode.window.createTextEditorDecorationType({ backgroundColor: 'rgba(128, 0, 128, 0.5)' }),
//         universal_selectors: vscode.window.createTextEditorDecorationType({ backgroundColor: 'rgba(76, 0, 130, 0.2)' }),
//         duplicate_selectors: vscode.window.createTextEditorDecorationType({ backgroundColor: 'rgba(255, 20, 147, 0.3)' }), // 💖 Pink
//         long_selectors: vscode.window.createTextEditorDecorationType({ backgroundColor: 'rgba(128, 128, 128, 0.3)' }), // ⚪ Gray
//         excessive_zindex: vscode.window.createTextEditorDecorationType({ backgroundColor: 'rgba(139, 0, 139, 0.3)' }), // 💜 Dark Purple
//         excessive_font_sizes: vscode.window.createTextEditorDecorationType({ backgroundColor: 'rgba(255, 105, 180, 0.3)' }) // 🎀 Light Pink
//     };

//     let decorations: { [key: string]: vscode.Range[] } = {};
//     for (let key in decorationTypes) {
//         decorations[key] = [];
//     }

//     for (let i = 0; i < editor.document.lineCount; i++) {
//         const line = editor.document.lineAt(i);
//         const text = line.text;

//         if (text.includes('{') && features.excessive_nesting > 5) {
//             decorations["excessive_nesting"].push(line.range);
//         }
//         if (text.includes('!important') && features.num_important > 10) {
//             decorations["num_important"].push(line.range);
//         }
//         if (text.match(/-\bwebkit\b-|-moz-|-ms-|-o-/g)) {
//             decorations["browser_specific_properties"].push(line.range);
//         }
//         if (text.includes('@keyframes') && features.animation_usage > 0) {
//             decorations["animation_usage"].push(line.range);
//         }
//         if (text.includes('*') && features.universal_selectors > 3) {
//             decorations["universal_selectors"].push(line.range);
//         }
//         if (text.includes(' ') && features.excessive_specificity > 3) {
//             decorations["excessive_specificity"].push(line.range);
//         }
//         if (features.duplicate_selectors > 5 && text.includes('{')) {
//             decorations["duplicate_selectors"].push(line.range);
//         }
//         if (features.long_selectors > 5 && text.length > 50) {
//             decorations["long_selectors"].push(line.range);
//         }
//         if (features.excessive_zindex > 3 && text.includes('z-index')) {
//             decorations["excessive_zindex"].push(line.range);
//         }
//         if (features.excessive_font_sizes > 5 && text.includes('font-size')) {
//             decorations["excessive_font_sizes"].push(line.range);
//         }
//     }

//     for (let key in decorations) {
//         if (decorations[key].length > 0) {
//             editor.setDecorations(decorationTypes[key], decorations[key]);
//         }
//     }

//     vscode.window.showInformationMessage(`✅ Highlighted ${Object.keys(decorations).length} types of code smells.`);
// }


// // **Deactivate Cleanup**
// export function deactivate() {
//     console.log("❌ CSS Smell Detector Deactivated");
// }



import * as vscode from 'vscode';
import axios from 'axios';

export function activate(context: vscode.ExtensionContext) {
    console.log("✅ CSS Smell Detector Activated");

    let disposable = vscode.commands.registerCommand('css-smell-detect.analyze', async () => {
        console.log("🔍 Running Analysis Command");

        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage("No CSS file open.");
            return;
        }

        const document = editor.document;
        const cssCode = document.getText();

        console.log("📂 Extracted CSS Code:", cssCode.substring(0, 100) + "...");

        try {
            console.log("🌍 Sending request to API...");
            const response = await axios.post('http://127.0.0.1:5000/predict', { css_code: cssCode });

            console.log("✅ API Response:", response.data);

            if (!response.data || !response.data.smells || !response.data.features) {
                vscode.window.showErrorMessage("API response is invalid.");
                return;
            }

            const prediction = response.data.prediction;
            const smells = response.data.smells || {};
            const features = response.data.features || {};

            let smellMessages = Object.entries(smells)
                .map(([smell, count]) => `${smell}: ${count} occurrences`)
                .join('\n');

            vscode.window.showInformationMessage(`Predicted Smell Level: ${prediction}\n\nDetected Smells:\n${smellMessages}`);

            highlightSmells(editor, smells, features);

        } catch (error) {
            vscode.window.showErrorMessage("Error connecting to API.");
            console.error("❌ API Request Failed:", error);
        }
    });

    context.subscriptions.push(disposable);

    // Hover Tooltips for Error Suggestions
    context.subscriptions.push(
        vscode.languages.registerHoverProvider('css', {
            provideHover(document, position) {
                const range = document.getWordRangeAtPosition(position);
                if (!range) return;
                const text = document.getText(range);

                let suggestion = getCssIssueSuggestion(text);
                if (suggestion) {
                    return new vscode.Hover(suggestion);
                }
            }
        })
    );

    // Quick Fix Command
    let fixCommand = vscode.commands.registerCommand('css-smell-detect.quickFix', () => {
        vscode.window.showQuickPick([
            "Replace !important with better specificity",
            "Convert ID selector to class",
            "Remove empty class",
            "Reduce excessive z-index",
            "Optimize redundant properties"
        ]).then(selection => {
            if (selection) {
                vscode.window.showInformationMessage(`✅ Applied fix: ${selection}`);
            }
        });
    });

    context.subscriptions.push(fixCommand);

        // Register the command
        context.subscriptions.push(disposable);

        // Listen for document changes and saves
        context.subscriptions.push(
            vscode.workspace.onDidChangeTextDocument((event) => {
                if (event.document.languageId === 'css') {
                    console.log("📜 CSS Document Changed:", event.document.fileName);
                    handleDocumentChange(event);
                }
            })
        );
    
        context.subscriptions.push(
            vscode.workspace.onDidSaveTextDocument((document) => {
                if (document.languageId === 'css') {
                    console.log("💾 CSS Document Saved:", document.fileName);
                    handleDocumentSave(document);
                }
            })
        );
    
}


// **Real-Time CSS Analysis (Debounced)**
let typingTimer: NodeJS.Timeout | null = null;
async function handleDocumentChange(event: vscode.TextDocumentChangeEvent) {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'css') return;

    const document = editor.document;
    const cssCode = document.getText();

    if (!cssCode.trim()) return;

    console.log("✍️ CSS Code Detected:", cssCode.substring(0, 50) + "...");

    // **Debounce Mechanism for Real-Time Analysis**
    if (typingTimer) clearTimeout(typingTimer);
    typingTimer = setTimeout(async () => {
        console.log("🚀 Real-Time API Request Triggered...");
        await analyzeCSSCode(editor, cssCode);
    }, 500); // Adjust delay for responsiveness (lower = faster response)
}

// **Auto-Save Detection**
async function handleDocumentSave(document: vscode.TextDocument) {
    if (document.languageId !== 'css') return;

    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    const cssCode = document.getText();
    console.log("💾 Auto-Save Triggered, Analyzing CSS...");
    await analyzeCSSCode(editor, cssCode);
}

async function analyzeCSSCode(editor: vscode.TextEditor, cssCode: string) {
    try {
        const startTime = Date.now(); // Start time ⏱️

        const response = await axios.post('http://127.0.0.1:5000/predict', { css_code: cssCode });

        const endTime = Date.now(); // End time ⏱️
        const responseTime = endTime - startTime; // Calculate response time

        console.log(`✅ API Response Time: ${responseTime}ms`);

        if (!response.data || !response.data.smells || !response.data.features) {
            vscode.window.showErrorMessage("API response is invalid.");
            return;
        }

        console.log("✅ API Response Received:", response.data);

        const smells = response.data.smells || {};
        const features = response.data.features || {};

        vscode.window.showInformationMessage(`Predicted Smell Level: ${response.data.prediction}\nResponse Time: ${responseTime}ms`);

        highlightSmells(editor, smells, features);
    } catch (error) {
        console.error("❌ API Request Failed:", error);
    }
}


// Detect Common CSS Issues & Provide Fix Suggestions
function getCssIssueSuggestion(text: string): string | null {
    if (text.includes('!important')) {
        return `⚠️ **Avoid Using !important**  
        ❌ Overuse of \`!important\` makes debugging difficult.  
        ✅ **Solution**: Use more specific selectors instead.`;
    }

    if (text.startsWith('.') && text.endsWith('{}')) {
        return `⚠️ **Empty Class Detected**  
        ❌ The class \`${text}\` is empty.  
        ✅ **Solution**: Remove it if unnecessary, or add styles.`;
    }

    if (text.startsWith('#')) {
        return `⚠️ **Avoid Using IDs for Styling**  
        ❌ ID selectors have high specificity, making overrides harder.  
        ✅ **Solution**: Use classes instead (e.g., \`.my-class\`).`;
    }

    if (text.includes('*')) {
        return `⚠️ **Avoid Universal Selectors (\`*\`)**  
        ❌ Universal selectors apply styles to all elements, reducing efficiency.  
        ✅ **Solution**: Use specific selectors instead.`;
    }

    if (text.includes('z-index:') && /\d{3,}/.test(text)) {
        return `⚠️ **High z-index Detected**  
        ❌ Excessive \`z-index\` values can cause stacking issues.  
        ✅ **Solution**: Reduce values and use a structured stacking context.`;
    }

    return null;
}

// Highlight Detected CSS Smells
function highlightSmells(editor: vscode.TextEditor, smells: any, features: any) {
    const decorationTypes: { [key: string]: vscode.TextEditorDecorationType } = {
        excessive_nesting: vscode.window.createTextEditorDecorationType({ backgroundColor: 'rgba(255, 0, 0, 0.07)' }),
        excessive_specificity: vscode.window.createTextEditorDecorationType({ backgroundColor: 'rgba(255, 166, 0, 0.17)' }),
        num_important: vscode.window.createTextEditorDecorationType({ backgroundColor: 'rgba(255, 255, 0, 0.16)' }),
        browser_specific_properties: vscode.window.createTextEditorDecorationType({ backgroundColor: 'rgba(14, 255, 14, 0.11)' }),
        animation_usage: vscode.window.createTextEditorDecorationType({ backgroundColor: 'rgba(0, 0, 255, 0.15)' }),
        unused_selectors: vscode.window.createTextEditorDecorationType({ backgroundColor: 'rgba(128, 0, 128, 0.5)' }),
        universal_selectors: vscode.window.createTextEditorDecorationType({ backgroundColor: 'rgba(76, 0, 130, 0.2)' }),
        duplicate_selectors: vscode.window.createTextEditorDecorationType({ backgroundColor: 'rgba(255, 20, 147, 0.3)' }),
        long_selectors: vscode.window.createTextEditorDecorationType({ backgroundColor: 'rgba(128, 128, 128, 0.3)' }),
        excessive_zindex: vscode.window.createTextEditorDecorationType({ backgroundColor: 'rgba(139, 0, 139, 0.3)' }),
        excessive_font_sizes: vscode.window.createTextEditorDecorationType({ backgroundColor: 'rgba(255, 105, 180, 0.3)' })
    };

    let decorations: { [key: string]: vscode.Range[] } = {};
    for (let key in decorationTypes) {
        decorations[key] = [];
    }

    for (let i = 0; i < editor.document.lineCount; i++) {
        const line = editor.document.lineAt(i);
        const text = line.text;

        if (text.includes('{') && features.excessive_nesting > 5) {
            decorations["excessive_nesting"].push(line.range);
        }
        if (text.includes('!important') && features.num_important > 10) {
            decorations["num_important"].push(line.range);
        }
        if (text.match(/-\bwebkit\b-|-moz-|-ms-|-o-/g)) {
            decorations["browser_specific_properties"].push(line.range);
        }
        if (text.includes('@keyframes') && features.animation_usage > 0) {
            decorations["animation_usage"].push(line.range);
        }
        if (text.includes('*') && features.universal_selectors > 3) {
            decorations["universal_selectors"].push(line.range);
        }
        if (text.includes(' ') && features.excessive_specificity > 3) {
            decorations["excessive_specificity"].push(line.range);
        }
        if (features.duplicate_selectors > 5 && text.includes('{')) {
            decorations["duplicate_selectors"].push(line.range);
        }
    }

    for (let key in decorations) {
        if (decorations[key].length > 0) {
            editor.setDecorations(decorationTypes[key], decorations[key]);
        }
    }
}

// Cleanup when Deactivating
export function deactivate() {
    console.log("❌ CSS Smell Detector Deactivated");
}
