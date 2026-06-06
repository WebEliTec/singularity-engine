import { app, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { readFileSync } from 'fs'

// Load a project-root `.env` into process.env at startup, so secrets like
// ANTHROPIC_API_KEY don't have to be typed on the command line each launch.
// Read at RUNTIME (never baked into a build) and main-process only (never the
// renderer). Minimal parser: `KEY=VALUE` per line, `#` comments, optional
// surrounding quotes / `export `. Does NOT override a variable already set, so
// an inline launch (`ANTHROPIC_API_KEY=… npm run dev`) still wins. Silent if no
// `.env` exists.
function loadDotEnv() {
  const candidates = [
    join(__dirname, '../../.env'),   // <projectRoot>/.env  (built main lives at out/main/)
    join(process.cwd(), '.env'),     // fallback: current working dir
  ]
  for (const path of candidates) {
    let text
    try { text = readFileSync(path, 'utf8') } catch { continue }
    for (const rawLine of text.split('\n')) {
      const line = rawLine.trim()
      if (!line || line.startsWith('#')) continue
      const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
      if (!match) continue
      const key = match[1]
      let value = match[2].trim()
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1)
      }
      if (process.env[key] === undefined) process.env[key] = value
    }
    return  // first .env found wins
  }
}

loadDotEnv()

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true
    }
  })

  win.on('ready-to-show', () => {
    win.show()
    win.webContents.openDevTools()
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

ipcMain.handle('athene:ping', () => 'pong')

// AI control layer (β4): authenticated proxy to the Anthropic Messages API.
// The key lives ONLY here in the main process (read from the environment) — it
// never reaches the context-isolated renderer. The renderer sends a ready-built
// Messages request body (model, messages, tools, ...) and gets back the parsed
// response. Thin and agent-logic-free: the tool-use loop lives renderer-side in
// the Morpheus `agentTransport` service.
ipcMain.handle('athene:llm', async (_event, request) => {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return { ok: false, error: 'no_api_key', message: 'ANTHROPIC_API_KEY is not set — add it to a .env file at the project root (ANTHROPIC_API_KEY=sk-ant-…), or set it inline at launch.' }
  }
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(request)
    })
    const data = await res.json()
    if (!res.ok) {
      return { ok: false, error: 'api_error', status: res.status, data }
    }
    return { ok: true, data }
  } catch (error) {
    return { ok: false, error: 'request_failed', message: String(error?.message ?? error) }
  }
})

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
