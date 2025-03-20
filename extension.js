const vscode = require('vscode');
const axios = require('axios');
const path = require('path');

let intervalId = null;
let stopwatchTime = 0;
let activityIntervalId = null;
let secretStorage;
let startTrackingButton;
let stopTrackingButton;

function startStopwatch() {
    stopwatchTime = 0;
    intervalId = setInterval(() => {
        stopwatchTime += 1;
    }, 1000);

    activityIntervalId = setInterval(() => {
        sendActivityData(secretStorage);
    }, 30000);
}

function stopStopwatch() {
    if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
    }
    if (activityIntervalId) {
        clearInterval(activityIntervalId);
        activityIntervalId = null;
    }
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

async function sendActivityData(secretStorage, isStop) {
    const apiKey = await secretStorage.get("myApiKey");
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    const document = editor.document;
    const currentFile = path.basename(document.fileName);
    const currentFolder = path.basename(vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders[0].uri.fsPath : 'No Folder Opened');

    if(isStop == true){
        stopwatchTime = -1;
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

async function startTracking(secretStorage) {
    const apiKey = await secretStorage.get("myApiKey");

    if (!apiKey) {
        storeSecret(secretStorage);
        return;
    }

    startStopwatch();
    vscode.window.showInformationMessage("ActivityDoor: Activity tracking started!");
    startTrackingButton.hide();
    stopTrackingButton.show();
}

function stopTracking(secretStorage) {
    stopStopwatch();
    vscode.window.showInformationMessage("ActivityDoor: Activity tracking stopped!");
    sendActivityData(secretStorage,true);

    startTrackingButton.show();
    stopTrackingButton.hide();
}

function activate(context) {
    secretStorage = context.secrets;

    let storeApiKeyCommand = vscode.commands.registerCommand("extension.storeApiKey", () => {
        storeSecret(secretStorage);
    });

    let startTrackingCommand = vscode.commands.registerCommand("extension.startTracking", () => {
        startTracking(secretStorage);
    });

    let stopTrackingCommand = vscode.commands.registerCommand("extension.stopTracking", () => {
        stopTracking(secretStorage);
    });
    startTracking(secretStorage);
    startTrackingButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 1);
    startTrackingButton.text = "Start Activity Tracking";
    startTrackingButton.command = "extension.startTracking";
    startTrackingButton.hide();

    stopTrackingButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 2);
    stopTrackingButton.text = "Stop Activity Tracking";
    stopTrackingButton.command = "extension.stopTracking";
    stopTrackingButton.show();

    context.subscriptions.push(storeApiKeyCommand, startTrackingCommand, stopTrackingCommand);
}

function deactivate() {
    return new Promise(async (resolve) => {
        try {
            stopTracking(secretStorage);
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
