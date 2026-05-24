const { app, BrowserWindow, Menu, ipcMain, screen } = require("electron");
const fs = require("fs");
const path = require("path");

let mainWindow = null;

function settingsPath() {
  return path.join(app.getPath("userData"), "widget-settings.json");
}

function defaultSettings() {
  return {
    opacity: 0.96,
    alwaysOnTop: true,
    openAtLogin: false,
    theme: "dark",
  };
}

function readSettings() {
  try {
    return { ...defaultSettings(), ...JSON.parse(fs.readFileSync(settingsPath(), "utf8")) };
  } catch {
    return defaultSettings();
  }
}

function writeSettings(settings) {
  fs.mkdirSync(app.getPath("userData"), { recursive: true });
  fs.writeFileSync(settingsPath(), JSON.stringify(settings, null, 2));
}

function applyWindowSettings(window, settings) {
  window.setOpacity(Math.min(1, Math.max(0.55, Number(settings.opacity) || 0.96)));
  window.setAlwaysOnTop(Boolean(settings.alwaysOnTop), "floating");
  window.setVisibleOnAllWorkspaces(Boolean(settings.alwaysOnTop));
}

function applyLoginSettings(settings) {
  app.setLoginItemSettings({
    openAtLogin: Boolean(settings.openAtLogin),
    path: process.execPath,
  });
}

function createWindow() {
  const { workArea } = screen.getPrimaryDisplay();
  const settings = readSettings();
  const width = 1060;
  const height = 640;
  mainWindow = new BrowserWindow({
    width,
    height,
    minWidth: 860,
    minHeight: 480,
    x: Math.max(workArea.x, workArea.x + workArea.width - width - 24),
    y: Math.max(workArea.y, workArea.y + 24),
    title: "YJ Timetable Widget",
    frame: false,
    backgroundColor: "#07111d",
    titleBarStyle: "hidden",
    alwaysOnTop: settings.alwaysOnTop,
    skipTaskbar: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  applyWindowSettings(mainWindow, settings);
  applyLoginSettings(settings);
  mainWindow.loadFile(path.join(__dirname, "widget.html"));
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);

  ipcMain.handle("settings:get", () => {
    const settings = readSettings();
    const loginSettings = app.getLoginItemSettings();
    return { ...settings, openAtLogin: Boolean(loginSettings.openAtLogin || settings.openAtLogin) };
  });

  ipcMain.handle("settings:update", (_event, patch) => {
    const settings = { ...readSettings(), ...patch };
    settings.opacity = Math.min(1, Math.max(0.55, Number(settings.opacity) || 0.96));
    settings.alwaysOnTop = Boolean(settings.alwaysOnTop);
    settings.openAtLogin = Boolean(settings.openAtLogin);
    settings.theme = settings.theme === "light" ? "light" : "dark";
    writeSettings(settings);
    applyLoginSettings(settings);
    if (mainWindow) {
      applyWindowSettings(mainWindow, settings);
    }
    return settings;
  });

  ipcMain.handle("window:close", () => {
    if (mainWindow) {
      mainWindow.close();
    }
  });

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
