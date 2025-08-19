# Electron + Nitro Desktop App Setup

This guide explains how to package Dynalis as a desktop application using Electron with the Nitro server backend.

## Architecture Overview

```
┌─────────────────────────────────────────┐
│ Electron Desktop App                    │
│ ┌─────────────────┐ ┌─────────────────┐ │
│ │ Main Process    │ │ Renderer Process│ │
│ │ - Start Nitro   │ │ - Load UI from  │ │
│ │ - Manage SQLite │ │   localhost     │ │
│ │ - Handle ports  │ │ - Web interface │ │
│ │ - File system   │ │ - No browser    │ │
│ └─────────────────┘ └─────────────────┘ │
└─────────────────────────────────────────┘
```

## Prerequisites

- Node.js 18+ installed
- Bun package manager
- Git

## Step 1: Install Electron Dependencies

```bash
# Add Electron and build tools
bun add --dev electron electron-builder

# Add cross-platform process management
bun add cross-spawn wait-port
```

## Step 2: Create Electron Main Process

Create `electron/main.js`:

```javascript
const { app, BrowserWindow, dialog } = require('electron')
const { spawn } = require('cross-spawn')
const waitPort = require('wait-port')
const path = require('path')
const isDev = process.env.NODE_ENV === 'development'

let nitroServer = null
let mainWindow = null

// Configure server port
const SERVER_PORT = isDev ? 3000 : 3001

async function startNitroServer() {
  const serverPath = isDev 
    ? path.join(__dirname, '../.output/server/index.mjs')
    : path.join(process.resourcesPath, 'server/index.mjs')
    
  console.log('Starting Nitro server...')
  
  nitroServer = spawn('node', [serverPath], {
    env: { 
      ...process.env, 
      PORT: SERVER_PORT,
      NODE_ENV: 'production'
    },
    stdio: isDev ? 'inherit' : 'pipe'
  })
  
  nitroServer.on('error', (err) => {
    console.error('Failed to start Nitro server:', err)
    dialog.showErrorBox('Server Error', `Failed to start server: ${err.message}`)
  })
  
  // Wait for server to be ready
  try {
    await waitPort({
      host: 'localhost',
      port: SERVER_PORT,
      timeout: 30000,
      output: 'silent'
    })
    console.log(`Nitro server ready on port ${SERVER_PORT}`)
  } catch (err) {
    console.error('Server failed to start:', err)
    throw err
  }
}

async function createWindow() {
  // Start the Nitro server first
  await startNitroServer()
  
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false
    },
    icon: path.join(__dirname, 'assets/icon.png'), // Add your app icon
    show: false // Don't show until ready
  })
  
  // Load the app
  const appUrl = `http://localhost:${SERVER_PORT}`
  await mainWindow.loadURL(appUrl)
  
  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
    
    if (isDev) {
      mainWindow.webContents.openDevTools()
    }
  })
  
  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// App event handlers
app.whenReady().then(() => {
  createWindow()
  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  // Terminate Nitro server
  if (nitroServer) {
    nitroServer.kill()
  }
  
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  // Cleanup Nitro server
  if (nitroServer) {
    nitroServer.kill()
  }
})
```

## Step 3: Update Package.json Scripts

Add to `package.json`:

```json
{
  "main": "electron/main.js",
  "scripts": {
    "electron:dev": "concurrently \"bun run dev\" \"wait-on http://localhost:3000 && electron .\"",
    "electron:build": "bun run build && electron-builder",
    "electron:build:all": "bun run build && electron-builder --mac --win --linux",
    "preelectron:build": "bun run build"
  }
}
```

## Step 4: Configure Electron Builder

Create `electron-builder.json`:

```json
{
  "appId": "com.dynalis.app",
  "productName": "Dynalis",
  "directories": {
    "output": "dist-electron"
  },
  "files": [
    "electron/main.js",
    ".output/**/*",
    "!.output/server/node_modules",
    "node_modules/**/*"
  ],
  "extraResources": [
    {
      "from": ".output/server",
      "to": "server"
    },
    {
      "from": ".data",
      "to": "data"
    }
  ],
  "mac": {
    "category": "public.app-category.productivity",
    "target": [
      {
        "target": "dmg",
        "arch": ["x64", "arm64"]
      }
    ]
  },
  "win": {
    "target": [
      {
        "target": "nsis",
        "arch": ["x64"]
      }
    ]
  },
  "linux": {
    "target": [
      {
        "target": "AppImage",
        "arch": ["x64"]
      }
    ]
  },
  "nsis": {
    "oneClick": false,
    "allowToChangeInstallationDirectory": true
  }
}
```

## Step 5: Add Development Dependencies

```bash
# Add concurrent execution for development
bun add --dev concurrently wait-on
```

## Step 6: Create App Icon

1. Create `electron/assets/` directory
2. Add `icon.png` (512x512 or higher)
3. For production, create platform-specific icons:
   - `icon.ico` (Windows)
   - `icon.icns` (macOS)
   - `icon.png` (Linux)

## Step 7: Development Workflow

```bash
# Development mode (hot reload)
bun run electron:dev

# Build for current platform
bun run electron:build

# Build for all platforms
bun run electron:build:all
```

## Step 8: Database Considerations

The SQLite database will be stored in:
- **Development**: `.data/dynalis.sqlite3`
- **Production**: User's app data directory

To ensure data persistence, update the Nitro config to use user data directory in production:

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  nitro: {
    database: {
      default: {
        connector: "sqlite",
        options: {
          name: "dynalis_db",
          file: process.env.NODE_ENV === 'production' 
            ? path.join(os.homedir(), '.dynalis', 'data.sqlite3')
            : ".data/dynalis.sqlite3"
        }
      }
    }
  }
})
```

## Distribution

After building, you'll find installers in `dist-electron/`:
- **Windows**: `.exe` installer
- **macOS**: `.dmg` disk image
- **Linux**: `.AppImage` portable app

## Troubleshooting

### Port Conflicts
If port 3001 is busy, the app will show an error. Users can:
1. Close other applications using the port
2. Restart the app

### Database Issues
- Check file permissions in user data directory
- Ensure SQLite file isn't corrupted
- Database will auto-initialize on first run

### Performance
- First startup may take 5-10 seconds
- Subsequent launches are faster
- App uses ~150MB RAM (includes Chromium engine)

## Security Notes

- The app runs a local server only accessible to localhost
- No external network access required after installation
- All data stored locally on user's machine
- SQLite database is not encrypted (consider adding encryption for sensitive data)