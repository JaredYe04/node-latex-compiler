'use strict'

const fs = require('fs')
const path = require('path')
const os = require('os')

/**
 * Get runtime package name based on platform and architecture
 * 
 * @param {string} platform - OS platform (win32, darwin, linux)
 * @param {string} arch - Architecture (x64, arm64)
 * @returns {string|null} - Package name or null if unsupported
 */
function getRuntimePackageName (platform, arch) {
  if (platform === 'win32' && arch === 'x64') {
    return '@node-latex-compiler/bin-win32-x64'
  } else if (platform === 'darwin' && arch === 'x64') {
    return '@node-latex-compiler/bin-darwin-x64'
  } else if (platform === 'darwin' && arch === 'arm64') {
    return '@node-latex-compiler/bin-darwin-arm64'
  } else if (platform === 'linux' && arch === 'x64') {
    return '@node-latex-compiler/bin-linux-x64'
  }
  
  // Unsupported platform/arch combination
  return null
}

/**
 * Get executable name based on platform
 * 
 * @param {string} platform - OS platform (win32, darwin, linux)
 * @returns {string} - Executable name
 */
function getExecutableName (platform) {
  if (platform === 'win32') {
    return 'tectonic.exe'
  }
  return 'tectonic'
}

/**
 * Resolve bundled Tectonic binary from optional dependencies
 * Based on platform and architecture
 * 
 * @returns {string|null} - Path to bundled Tectonic executable
 */
function resolveBundledTectonic () {
  const platform = os.platform()
  const arch = os.arch()

  // Normalize arch
  let normalizedArch = arch
  if (arch === 'x86_64' || arch === 'amd64') {
    normalizedArch = 'x64'
  } else if (arch === 'aarch64') {
    normalizedArch = 'arm64'
  }

  // First, try to find in local bin directory (for development/testing)
  const thisPkgPath = path.join(__dirname, '..')
  const exeName = getExecutableName(platform)
  
  // Try primary arch first
  const localBinPath = path.join(thisPkgPath, 'bin', `${platform}-${normalizedArch}`)
  const localTectonicPath = path.join(localBinPath, exeName)
  
  if (fs.existsSync(localTectonicPath)) {
    try {
      if (platform !== 'win32') {
        fs.chmodSync(localTectonicPath, 0o755)
      }
      return localTectonicPath
    } catch (e) {
      return localTectonicPath
    }
  }
  
  // On macOS, also try alternative arch if the primary one doesn't exist
  // This handles cases where Node.js reports a different arch than the binary
  // or when running x64 Node.js on ARM Mac (Rosetta 2)
  if (platform === 'darwin') {
    const altArch = normalizedArch === 'x64' ? 'arm64' : 'x64'
    const altLocalBinPath = path.join(thisPkgPath, 'bin', `${platform}-${altArch}`)
    const altLocalTectonicPath = path.join(altLocalBinPath, exeName)
    if (fs.existsSync(altLocalTectonicPath)) {
      try {
        fs.chmodSync(altLocalTectonicPath, 0o755)
        return altLocalTectonicPath
      } catch (e) {
        return altLocalTectonicPath
      }
    }
  }
  
  // Also try checking all available bin directories (fallback)
  // This helps in CI environments where arch detection might be inconsistent
  const binBasePath = path.join(thisPkgPath, 'bin')
  if (fs.existsSync(binBasePath)) {
    try {
      const entries = fs.readdirSync(binBasePath)
      for (const entry of entries) {
        if (entry.startsWith(`${platform}-`)) {
          const candidatePath = path.join(binBasePath, entry, exeName)
          if (fs.existsSync(candidatePath)) {
            try {
              if (platform !== 'win32') {
                fs.chmodSync(candidatePath, 0o755)
              }
              return candidatePath
            } catch (e) {
              return candidatePath
            }
          }
        }
      }
    } catch (e) {
      // Ignore errors when scanning bin directory
    }
  }

  // Map platform and arch to package name
  const pkgName = getRuntimePackageName(platform, normalizedArch)
  if (!pkgName) {
    return null
  }

  try {
    // Try to resolve the runtime package
    let pkgPath
    try {
      // Try to require.resolve the package
      const pkgJsonPath = require.resolve(pkgName + '/package.json')
      pkgPath = path.dirname(pkgJsonPath)
    } catch (e) {
      // Package might not be installed (optional dependency)
      // Try to find it in node_modules relative to this package
      const possiblePath = path.join(thisPkgPath, 'node_modules', pkgName)
      if (fs.existsSync(path.join(possiblePath, 'package.json'))) {
        pkgPath = possiblePath
      } else {
        return null
      }
    }

    // Construct Tectonic executable path
    const tectonicPath = path.join(pkgPath, 'bin', exeName)

    if (fs.existsSync(tectonicPath)) {
      try {
        // Make executable on Unix
        if (platform !== 'win32') {
          fs.chmodSync(tectonicPath, 0o755)
        }
        return tectonicPath
      } catch (e) {
        // If chmod fails, still return the path (it might already be executable)
        return tectonicPath
      }
    }
  } catch (e) {
    // Silently fail - bundled binary not available
    return null
  }

  return null
}

/**
 * Resolve Tectonic executable path with fallback strategy
 * 
 * Priority order:
 * 1. options.tectonicPath (user-specified)
 * 2. Bundled binary (from optional dependencies)
 * 3. System 'tectonic' in PATH
 * 
 * @param {Object} options - Options object
 * @param {string} options.tectonicPath - User-specified Tectonic path (highest priority)
 * @returns {string|null} - Path to Tectonic executable, or null if not found
 */
function resolveTectonicExecutable (options) {
  options = options || {}
  
  // Priority 1: User-specified Tectonic path
  if (options.tectonicPath) {
    const tectonicPath = path.resolve(options.tectonicPath)
    if (fs.existsSync(tectonicPath)) {
      try {
        // Make executable on Unix if needed
        if (process.platform !== 'win32') {
          fs.chmodSync(tectonicPath, 0o755)
        }
        return tectonicPath
      } catch (e) {
        // If can't make executable, still try to use it
        return tectonicPath
      }
    }
  }

  // Priority 2: Bundled binary from optional dependencies
  const bundledTectonic = resolveBundledTectonic()
  if (bundledTectonic) {
    return bundledTectonic
  }

  // Priority 3: System 'tectonic' in PATH
  try {
    const systemTectonic = findTectonicInPath()
    if (systemTectonic) {
      return systemTectonic
    }
  } catch (e) {
    // Ignore errors when checking PATH
  }

  return null
}

/**
 * Find Tectonic executable in system PATH
 * 
 * @returns {string|null} - Path to tectonic executable
 */
function findTectonicInPath () {
  const { execSync } = require('child_process')
  try {
    // Use 'which' on Unix, 'where' on Windows
    const command = process.platform === 'win32' ? 'where' : 'which'
    const result = execSync(command + ' tectonic', {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore']
    })
    
    if (result) {
      const tectonicPath = result.trim().split('\n')[0]
      if (tectonicPath && fs.existsSync(tectonicPath)) {
        return tectonicPath
      }
    }
  } catch (e) {
    // Tectonic not found in PATH
  }
  
  return null
}

/**
 * Verify Tectonic executable works
 * 
 * @param {string} tectonicPath - Path to Tectonic executable
 * @returns {Promise<boolean>} - True if Tectonic works
 */
function verifyTectonic (tectonicPath) {
  return new Promise(function (resolve) {
    try {
      const { spawn } = require('child_process')
      const child = spawn(tectonicPath, ['--version'], {
        stdio: 'pipe'
      })
      
      let hasOutput = false
      child.stdout.on('data', function () {
        hasOutput = true
      })
      
      child.on('close', function (code) {
        resolve(code === 0)
      })
      
      child.on('error', function () {
        resolve(false)
      })
      
      // Timeout after 5 seconds
      setTimeout(function () {
        child.kill()
        resolve(false)
      }, 5000)
    } catch (e) {
      resolve(false)
    }
  })
}

module.exports = {
  resolveTectonicExecutable: resolveTectonicExecutable,
  resolveBundledTectonic: resolveBundledTectonic,
  getRuntimePackageName: getRuntimePackageName,
  getExecutableName: getExecutableName,
  verifyTectonic: verifyTectonic
}

