const repl = require('repl');
const vscode = require('vscode');
const axios = require('axios');
const path = require('path');

let intervalId = null;
let timerId = null;
let stopwatchTime = 0;
let secretStorage;
let inactivityTimer = null;
let typingFlag = false;

function startStopwatch() {
    stopwatchTime = 0;
    timerId = setInterval(() => {
        stopwatchTime += 1;
    }, 1000);
}

function stopStopwatch() {
    if (timerId) {
        clearInterval(timerId);
        timerId = null;
    }
}

function resetInactivityTimer() {
    if (inactivityTimer) {
        clearTimeout(inactivityTimer);
    }
    inactivityTimer = setTimeout(() => {
        sendActivityData(secretStorage, true);
        vscode.window.showInformationMessage("ActivityDoor: User is idle. Activity data sent.");
        stopContinuousTracking();
    }, 40000); // 40 seconds of inactivity
}

async function storeSecret(secretStorage) {
    const apiKey = await vscode.window.showInputBox({
        prompt: "Enter your API Key",
        ignoreFocusOut: true,
        password: true
    });

    if (!apiKey) {
        vscode.window.showErrorMessage("ActivityDoor: API Key is required!");
        return;
    }

    await secretStorage.store("myApiKey", apiKey);
    vscode.window.showInformationMessage("ActivityDoor: API Key saved successfully!");
}

async function sendActivityData(secretStorage, turnOff) {
    const apiKey = await secretStorage.get("myApiKey");
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    const document = editor.document;
    const currentFile = path.basename(document.fileName);
    const currentFolder = path.basename(vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders[0].uri.fsPath : 'No Folder Opened');
    
    if (turnOff) {
        stopwatchTime = -1;
        console.log("Turning off activity tracking");
    }

    const activity = {
        fileName: currentFile,
        folderName: currentFolder,
        time: stopwatchTime
    };

    try {
        await axios.post("https://actdoor.onrender.com/api/setActivity", { activity }, {
            headers: { Authorization: `Bearer ${apiKey}` }
        });
    } catch (error) {
        console.error("Error sending data:", error.message);
        vscode.window.showErrorMessage("ActivityDoor: Failed to send data. Try changing API key.", error.message);
    }
}

async function startContinuousTracking(secretStorage) {
    const apiKey = await secretStorage.get("myApiKey");

    if (!apiKey) {
        storeSecret(secretStorage);
        return;
    }
    if (intervalId) {
        
        return;
    }

    intervalId = setInterval(() => {
        sendActivityData(secretStorage, false);
    }, 30*1000); 

    vscode.window.showInformationMessage("ActivityDoor: Activity tracking started!");
}

function stopContinuousTracking() {
    if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
        vscode.window.showInformationMessage("ActivityDoor: Activity tracking stopped!");
        try{
            sendActivityData(secretStorage, true);
        }
        catch(err){
            console.log("Error in sending data");
        }
    } else {
        vscode.window.showWarningMessage("ActivityDoor: No tracking process is running.");
    }
}

function activate(context) {
    secretStorage = context.secrets;

    let storeApiKeyCommand = vscode.commands.registerCommand("extension.storeApiKey", () => {
        storeSecret(secretStorage);
    });

    let startTrackingCommand = vscode.commands.registerCommand("extension.startTracking", () => {
        startContinuousTracking(secretStorage);
    });

    let stopTrackingCommand = vscode.commands.registerCommand("extension.stopTracking", () => {
        stopContinuousTracking();
    });

    vscode.workspace.onDidChangeTextDocument((event) => {
        if (event.contentChanges.length > 0) {
            console.log("Text changed");
            resetInactivityTimer();

            if (!intervalId) {
                console.log("User became active again. Restarting tracking...");
                startContinuousTracking(secretStorage);
            }
            
            
        }
    });

    startStopwatch();
    startContinuousTracking(secretStorage);
    sendActivityData(secretStorage, false)

    context.subscriptions.push(storeApiKeyCommand, startTrackingCommand, stopTrackingCommand);
}

function deactivate() {
    return new Promise(async (resolve) => {
        try {
            stopContinuousTracking();
            stopStopwatch();
            await sendActivityData(secretStorage, true); // Send data when deactivating
            console.log("ActivityDoor: Deactivated!");
            resolve();
        } catch (error) {
            console.error("Error during deactivation:", error);
            resolve();
        }
    });
}

module.exports = {
    activate,
    deactivate
};
