"use strict";
// import * as vscode from 'vscode';
// import axios from 'axios';
// // vscode: Provides APIs to interact with the VS Code editor (like highlighting text, accessing open files).
// // axios: Makes HTTP requests to an external API that analyzes CSS code for code smells.
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
// export function activate(context: vscode.ExtensionContext) {
//     console.log(" hello");
//     //activate(): Runs when the extension is activated in VS Code.
//     let disposable = vscode.commands.registerCommand('css-smell-detect.analyze', async () => {
//         console.log("🔍 Running Analysis Command"); // Debug log
//         const editor = vscode.window.activeTextEditor;
//         if (!editor) {
//             vscode.window.showErrorMessage("No CSS file open.");
//             console.error("❌ No active editor found!");
//             return;
//         }
//         const document = editor.document;
//         const cssCode = document.getText();
//         console.log("📂 Extracted CSS Code:", cssCode.substring(0, 100) + "..."); // Debug log
//         // activeTextEditor: Retrieves the currently open file in VS Code.
//         // Validation: Displays an error if no file is open.
//         // getText(): Extracts the entire CSS code from the open file.
//         try {
//             console.log("🌍 Sending request to API...");
//             const response = await axios.post('http://127.0.0.1:5000/predict', { css_code: cssCode });
//             console.log("✅ API Response:", response.data); // Debug log
//             // Sends the extracted CSS code to a local API running at http://127.0.0.1:5000/predict
//             // Ensure the API response has features and smells
//             if (!response.data || !response.data.features || !response.data.smells) {
//                 vscode.window.showErrorMessage("API response is invalid. Please check your API.");
//                 console.error("❌ API returned unexpected response:", response.data);
//                 return;
//             }
//             // Checks if the API returned valid data.
//             const prediction = response.data.prediction;
//             const features = response.data.features || {}; // Ensure features is an object
//             const smells = response.data.smells || {}; // Ensure smells is an object
//             let smellMessages = Object.entries(smells)
//                 .map(([smell, count]) => `${smell}: ${count} occurrences`)
//                 .join('\n');
//             vscode.window.showInformationMessage(`Predicted Smell Level: ${prediction}\n\nDetected Smells:\n${smellMessages}`);
//             highlightSmells(editor, smells, features); // Use correct arguments
//         } catch (error) {
//             vscode.window.showErrorMessage("Error connecting to API.");
//             console.error("❌ API Request Failed:", error);
//         }
//     });
//     context.subscriptions.push(disposable);
// }
// // After detecting smells, this function highlights them in the code editor using different colors.
// function highlightSmells(editor: vscode.TextEditor, smells: any, features: any) {
//     // Define different colors for different smells
//     const decorationTypes: { [key: string]: vscode.TextEditorDecorationType } = {
//         // Red: Excessive nesting
//         excessive_nesting: vscode.window.createTextEditorDecorationType({ backgroundColor: 'rgba(255, 0, 0, 0.07)' }), // 🔴 Red
//         // Orange: Excessive specificity
//         excessive_specificity: vscode.window.createTextEditorDecorationType({ backgroundColor: 'rgba(255, 166, 0, 0.17)' }), // 🟠 Orange
//         // Yellow: Overuse of !important
//         num_important: vscode.window.createTextEditorDecorationType({ backgroundColor: 'rgba(255, 255, 0, 0.16)' }), // 🟡 Yellow
//         // Green: Browser-specific prefixes (-webkit-, -moz-, etc.)
//         browser_specific_properties: vscode.window.createTextEditorDecorationType({ backgroundColor: 'rgba(14, 255, 14, 0.11)' }), // 🟢 Green
//         // Blue: Animations (@keyframes)
//         animation_usage: vscode.window.createTextEditorDecorationType({ backgroundColor: 'rgba(0, 0, 255, 0.15)' }), // 🔵 Blue
//         // Purple: Unused selectors
//         unused_selectors: vscode.window.createTextEditorDecorationType({ backgroundColor: 'rgba(128, 0, 128, 0.5)' }), // 🟣 Purple
//         // Indigo: Universal selectors (*)
//         universal_selectors: vscode.window.createTextEditorDecorationType({ backgroundColor: 'rgba(76, 0, 130, 0.2)' }) // 🔵 Indigo
//     };
//     // Initialize empty arrays for each smell type
//     let decorations: { [key: string]: vscode.Range[] } = {};
//     for (let key in decorationTypes) {
//         decorations[key] = [];
//     }
//     // Iterate through each line and detect code smells
//     for (let i = 0; i < editor.document.lineCount; i++) {
//         const line = editor.document.lineAt(i);
//         const text = line.text;
//         // Highlight excessive nesting
//         if (text.includes('{') && features.excessive_nesting > 5) {
//             decorations["excessive_nesting"].push(line.range);
//         }
//         // Highlight !important properties
//         if (text.includes('!important') && features.num_important > 10) {
//             decorations["num_important"].push(line.range);
//         }
//         // Highlight browser-specific properties (-webkit-, -moz-, -ms-, -o-)
//         if (text.match(/-\bwebkit\b-|-moz-|-ms-|-o-/g)) {
//             decorations["browser_specific_properties"].push(line.range);
//         }
//         // Highlight animation usage
//         if (text.includes('@keyframes') && features.animation_usage > 0) {
//             decorations["animation_usage"].push(line.range);
//         }
//         // Highlight unused/universal selectors (*)
//         if (text.includes('*') && features.universal_selectors > 3) {
//             decorations["universal_selectors"].push(line.range);
//         }
//         // Highlight excessive specificity (too many spaces in selectors)
//         if (text.includes(' ') && features.excessive_specificity > 3) {
//             decorations["excessive_specificity"].push(line.range);
//         }
//     }
//     // Apply decorations to the editor
//     for (let key in decorations) {
//         if (decorations[key].length > 0) {
//             editor.setDecorations(decorationTypes[key], decorations[key]);
//         }
//     }
// }
// // This function is required by VS Code extensions to clean up resources when the extension is disabled.
// export function deactivate() { }
const vscode = __importStar(require("vscode"));
const axios_1 = __importDefault(require("axios"));
function activate(context) {
    console.log("✅ CSS Smell Detector Activated");
    console.log(" hello");
    // Register the "Analyze CSS Smells" command
    let disposable = vscode.commands.registerCommand('css-smell-detect.analyze', async () => {
        console.log("🔍 Running Analysis Command");
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage("No CSS file open.");
            console.error("❌ No active editor found!");
            return;
        }
        const document = editor.document;
        const cssCode = document.getText();
        console.log("📂 Extracted CSS Code:", cssCode.substring(0, 100) + "...");
        try {
            console.log("🌍 Sending request to API...");
            const response = await axios_1.default.post('http://127.0.0.1:5000/predict', { css_code: cssCode });
            console.log("✅ API Response:", response.data);
            if (!response.data || !response.data.smells || !response.data.features) {
                vscode.window.showErrorMessage("API response is invalid.");
                console.error("❌ API returned unexpected response:", response.data);
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
        }
        catch (error) {
            vscode.window.showErrorMessage("Error connecting to API.");
            console.error("❌ API Request Failed:", error);
        }
    });
    // Register the command
    context.subscriptions.push(disposable);
    // Listen for document changes and saves
    context.subscriptions.push(vscode.workspace.onDidChangeTextDocument((event) => {
        if (event.document.languageId === 'css') {
            console.log("📜 CSS Document Changed:", event.document.fileName);
            handleDocumentChange(event);
        }
    }));
    context.subscriptions.push(vscode.workspace.onDidSaveTextDocument((document) => {
        if (document.languageId === 'css') {
            console.log("💾 CSS Document Saved:", document.fileName);
            handleDocumentSave(document);
        }
    }));
}
// **Real-Time CSS Analysis (Debounced)**
let typingTimer = null;
async function handleDocumentChange(event) {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'css')
        return;
    const document = editor.document;
    const cssCode = document.getText();
    if (!cssCode.trim())
        return;
    console.log("✍️ CSS Code Detected:", cssCode.substring(0, 50) + "...");
    // **Debounce Mechanism for Real-Time Analysis**
    if (typingTimer)
        clearTimeout(typingTimer);
    typingTimer = setTimeout(async () => {
        console.log("🚀 Real-Time API Request Triggered...");
        await analyzeCSSCode(editor, cssCode);
    }, 500); // Adjust delay for responsiveness (lower = faster response)
}
// **Auto-Save Detection**
async function handleDocumentSave(document) {
    if (document.languageId !== 'css')
        return;
    const editor = vscode.window.activeTextEditor;
    if (!editor)
        return;
    const cssCode = document.getText();
    console.log("💾 Auto-Save Triggered, Analyzing CSS...");
    await analyzeCSSCode(editor, cssCode);
}
// **Send CSS Code to API**
// async function analyzeCSSCode(editor: vscode.TextEditor, cssCode: string) {
//     try {
//         const response = await axios.post('http://127.0.0.1:5000/predict', { css_code: cssCode });
//         if (!response.data || !response.data.smells || !response.data.features) {
//             vscode.window.showErrorMessage("API response is invalid.");
//             return;
//         }
//         console.log("✅ API Response Received:", response.data);
//         const smells = response.data.smells || {};
//         const features = response.data.features || {};
//         highlightSmells(editor, smells, features);
//     } catch (error) {
//         console.error("❌ API Request Failed:", error);
//     }
// }
async function analyzeCSSCode(editor, cssCode) {
    try {
        const startTime = Date.now(); // Start time ⏱️
        const response = await axios_1.default.post('http://127.0.0.1:5000/predict', { css_code: cssCode });
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
    }
    catch (error) {
        console.error("❌ API Request Failed:", error);
    }
}
// **Highlight Detected CSS Smells**
function highlightSmells(editor, smells, features) {
    const decorationTypes = {
        excessive_nesting: vscode.window.createTextEditorDecorationType({ backgroundColor: 'rgba(255, 0, 0, 0.07)' }),
        excessive_specificity: vscode.window.createTextEditorDecorationType({ backgroundColor: 'rgba(255, 166, 0, 0.17)' }),
        num_important: vscode.window.createTextEditorDecorationType({ backgroundColor: 'rgba(255, 255, 0, 0.16)' }),
        browser_specific_properties: vscode.window.createTextEditorDecorationType({ backgroundColor: 'rgba(14, 255, 14, 0.11)' }),
        animation_usage: vscode.window.createTextEditorDecorationType({ backgroundColor: 'rgba(0, 0, 255, 0.15)' }),
        unused_selectors: vscode.window.createTextEditorDecorationType({ backgroundColor: 'rgba(128, 0, 128, 0.5)' }),
        universal_selectors: vscode.window.createTextEditorDecorationType({ backgroundColor: 'rgba(76, 0, 130, 0.2)' }),
        duplicate_selectors: vscode.window.createTextEditorDecorationType({ backgroundColor: 'rgba(255, 20, 147, 0.3)' }), // 💖 Pink
        long_selectors: vscode.window.createTextEditorDecorationType({ backgroundColor: 'rgba(128, 128, 128, 0.3)' }), // ⚪ Gray
        excessive_zindex: vscode.window.createTextEditorDecorationType({ backgroundColor: 'rgba(139, 0, 139, 0.3)' }), // 💜 Dark Purple
        excessive_font_sizes: vscode.window.createTextEditorDecorationType({ backgroundColor: 'rgba(255, 105, 180, 0.3)' }) // 🎀 Light Pink
    };
    let decorations = {};
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
        if (features.long_selectors > 5 && text.length > 50) {
            decorations["long_selectors"].push(line.range);
        }
        if (features.excessive_zindex > 3 && text.includes('z-index')) {
            decorations["excessive_zindex"].push(line.range);
        }
        if (features.excessive_font_sizes > 5 && text.includes('font-size')) {
            decorations["excessive_font_sizes"].push(line.range);
        }
    }
    for (let key in decorations) {
        if (decorations[key].length > 0) {
            editor.setDecorations(decorationTypes[key], decorations[key]);
        }
    }
    vscode.window.showInformationMessage(`✅ Highlighted ${Object.keys(decorations).length} types of code smells.`);
}
// **Deactivate Cleanup**
function deactivate() {
    console.log("❌ CSS Smell Detector Deactivated");
}
//# sourceMappingURL=extension.js.map