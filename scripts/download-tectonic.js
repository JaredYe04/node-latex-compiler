#!/usr/bin/env node
'use strict'

/**
 * Download Tectonic binary for current platform from continuous release
 * This script dynamically parses filenames to identify platform and architecture
 */

const fs = require('fs')
const path = require('path')
const os = require('os')
const https = require('https')
const { execSync } = require('child_process')

const PLATFORM = os.platform()
const ARCH = os.arch()

// GitHub API endpoint for continuous release
const GITHUB_API_BASE = 'https://api.github.com'
const REPO_OWNER = 'tectonic-typesetting'
const REPO_NAME = 'tectonic'
const RELEASE_TAG = 'continuous'

/**
 * Parse platform and architecture from filename
 * Supports formats like:
 * - tectonic-0.15.0+20251006-x86_64-pc-windows-gnu.zip
 * - tectonic-0.15.0+20251006-x86_64-apple-darwin.tar.gz
 * - tectonic-0.15.0+20251006-x86_64-unknown-linux-gnu.tar.gz
 * - tectonic-0.15.0+20251006-aarch64-apple-darwin.tar.gz
 */
function parseAssetInfo (filename) {
  // Remove extension
  const baseName = filename.replace(/\.(zip|tar\.gz|tar)$/, '')
  
  // Pattern: tectonic-{version}-{target}
  const match = baseName.match(/^tectonic-[^-]+-(.+)$/)
  if (!match) {
    return null
  }
  
  const target = match[1]
  
  // Parse target triple
  // Format: {arch}-{vendor}-{os}-{abi}
  // Examples:
  // - x86_64-pc-windows-gnu
  // - x86_64-apple-darwin
  // - x86_64-unknown-linux-gnu
  // - aarch64-apple-darwin
  // - aarch64-unknown-linux-musl
  
  let platform = null
  let arch = null
  let toolchain = null // gnu, msvc, musl
  
  // Windows
  if (target.includes('pc-windows')) {
    platform = 'win32'
    if (target.includes('-gnu')) {
      toolchain = 'gnu'
    } else if (target.includes('-msvc')) {
      toolchain = 'msvc'
    }
    
    if (target.startsWith('x86_64-')) {
      arch = 'x64'
    } else if (target.startsWith('aarch64-') || target.startsWith('arm64-')) {
      arch = 'arm64'
    } else if (target.startsWith('i686-')) {
      arch = 'ia32'
    }
  }
  // macOS
  else if (target.includes('apple-darwin')) {
    platform = 'darwin'
    if (target.startsWith('x86_64-')) {
      arch = 'x64'
    } else if (target.startsWith('aarch64-')) {
      arch = 'arm64'
    }
  }
  // Linux
  else if (target.includes('unknown-linux')) {
    platform = 'linux'
    if (target.includes('-gnu')) {
      toolchain = 'gnu'
    } else if (target.includes('-musl')) {
      toolchain = 'musl'
    }
    
    if (target.startsWith('x86_64-')) {
      arch = 'x64'
    } else if (target.startsWith('aarch64-')) {
      arch = 'arm64'
    } else if (target.startsWith('i686-')) {
      arch = 'ia32'
    } else if (target.startsWith('arm-')) {
      arch = 'arm'
    }
  }
  
  return {
    platform,
    arch,
    toolchain,
    filename,
    target
  }
}

/**
 * Get current platform requirements
 */
function getCurrentPlatformRequirements () {
  const platform = PLATFORM
  let arch = ARCH
  
  // Normalize arch
  if (arch === 'x64' || arch === 'amd64') {
    arch = 'x64'
  } else if (arch === 'arm64' || arch === 'aarch64') {
    arch = 'arm64'
  } else if (arch === 'ia32' || arch === 'x86') {
    arch = 'ia32'
  }
  
  return { platform, arch }
}

/**
 * Match asset to current platform
 * Priority for Windows: gnu > msvc
 * Priority for Linux: gnu > musl
 */
function matchAsset (assetInfo, requirements) {
  if (assetInfo.platform !== requirements.platform) {
    return false
  }
  
  if (assetInfo.arch !== requirements.arch) {
    return false
  }
  
  return true
}

/**
 * Score asset for priority (higher is better)
 */
function scoreAsset (assetInfo, requirements) {
  if (!matchAsset(assetInfo, requirements)) {
    return 0
  }
  
  let score = 100
  
  // Windows: prefer gnu over msvc
  if (requirements.platform === 'win32') {
    if (assetInfo.toolchain === 'gnu') {
      score += 10
    } else if (assetInfo.toolchain === 'msvc') {
      score += 5
    }
  }
  
  // Linux: prefer gnu over musl
  if (requirements.platform === 'linux') {
    if (assetInfo.toolchain === 'gnu') {
      score += 10
    } else if (assetInfo.toolchain === 'musl') {
      score += 5
    }
  }
  
  return score
}

/**
 * Fetch GitHub release assets
 */
function fetchReleaseAssets () {
  return new Promise((resolve, reject) => {
    const url = `${GITHUB_API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/releases/tags/${RELEASE_TAG}`
    
    https.get(url, {
      headers: {
        'User-Agent': 'node-tectonic-compiler',
        'Accept': 'application/vnd.github.v3+json'
      }
    }, (res) => {
      let data = ''
      
      res.on('data', (chunk) => {
        data += chunk
      })
      
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`GitHub API error: ${res.statusCode} - ${data}`))
          return
        }
        
        try {
          const release = JSON.parse(data)
          resolve(release.assets || [])
        } catch (e) {
          reject(new Error(`Failed to parse GitHub API response: ${e.message}`))
        }
      })
    }).on('error', (err) => {
      reject(err)
    })
  })
}

/**
 * Download file with retry
 */
function downloadFile (url, outputPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(outputPath)
    
    https.get(url, {
      headers: {
        'User-Agent': 'node-tectonic-compiler',
        'Accept': 'application/octet-stream'
      }
    }, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        // Follow redirect
        file.close()
        fs.unlinkSync(outputPath)
        return downloadFile(response.headers.location, outputPath)
          .then(resolve)
          .catch(reject)
      }
      
      if (response.statusCode !== 200) {
        file.close()
        if (fs.existsSync(outputPath)) {
          fs.unlinkSync(outputPath)
        }
        reject(new Error(`Failed to download: ${response.statusCode}`))
        return
      }
      
      response.pipe(file)
      
      file.on('finish', () => {
        file.close()
        resolve()
      })
    }).on('error', (err) => {
      file.close()
      if (fs.existsSync(outputPath)) {
        fs.unlinkSync(outputPath)
      }
      reject(err)
    })
  })
}

/**
 * Extract archive
 */
function extractArchive (archivePath, extractDir) {
  if (PLATFORM === 'win32') {
    // Windows: use PowerShell to extract ZIP
    const extractScript = `
      Add-Type -AssemblyName System.IO.Compression.FileSystem
      [System.IO.Compression.ZipFile]::ExtractToDirectory("${archivePath.replace(/\\/g, '/')}", "${extractDir.replace(/\\/g, '/')}")
    `
    execSync(`powershell -Command "${extractScript}"`, { stdio: 'inherit' })
  } else {
    // Unix: use tar
    execSync(`tar -xzf "${archivePath}" -C "${extractDir}"`, { stdio: 'inherit' })
  }
}

/**
 * Main download function
 */
async function main () {
  const args = process.argv.slice(2)
  const isLatest = args.includes('--latest')
  
  console.log(`Fetching Tectonic continuous release for ${PLATFORM} ${ARCH}...`)
  
  try {
    // Fetch assets from GitHub API
    const assets = await fetchReleaseAssets()
    console.log(`Found ${assets.length} assets in continuous release`)
    
    // Parse asset information
    const assetInfos = assets
      .map(asset => {
        const info = parseAssetInfo(asset.name)
        if (info) {
          info.downloadUrl = asset.browser_download_url
          info.size = asset.size
        }
        return info
      })
      .filter(info => info !== null)
    
    // Get current platform requirements
    const requirements = getCurrentPlatformRequirements()
    console.log(`Looking for: ${requirements.platform} ${requirements.arch}`)
    
    // Score and sort assets
    const scoredAssets = assetInfos
      .map(info => ({
        info,
        score: scoreAsset(info, requirements)
      }))
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
    
    if (scoredAssets.length === 0) {
      throw new Error(`No matching binary found for ${requirements.platform} ${requirements.arch}`)
    }
    
    // Select best match
    const selected = scoredAssets[0].info
    console.log(`Selected: ${selected.filename} (${selected.toolchain || 'default'} toolchain)`)
    console.log(`Download URL: ${selected.downloadUrl}`)
    
    // Setup paths
    const tempDir = path.join(__dirname, '..', 'temp-download')
    const archivePath = path.join(tempDir, selected.filename)
    const extractDir = path.join(tempDir, 'extracted')
    const binDir = path.join(__dirname, '..', 'bin', `${requirements.platform}-${requirements.arch}`)
    
    // Create directories
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true })
    }
    if (!fs.existsSync(extractDir)) {
      fs.mkdirSync(extractDir, { recursive: true })
    }
    if (!fs.existsSync(binDir)) {
      fs.mkdirSync(binDir, { recursive: true })
    }
    
    // Download
    console.log('Downloading...')
    await downloadFile(selected.downloadUrl, archivePath)
    console.log('Download complete')
    
    // Extract
    console.log('Extracting archive...')
    extractArchive(archivePath, extractDir)
    
    // Find tectonic executable in extracted files
    const executableName = PLATFORM === 'win32' ? 'tectonic.exe' : 'tectonic'
    let foundExecutable = null
    
    function findExecutable (dir) {
      const files = fs.readdirSync(dir)
      for (const file of files) {
        const fullPath = path.join(dir, file)
        const stat = fs.statSync(fullPath)
        if (stat.isDirectory()) {
          const found = findExecutable(fullPath)
          if (found) return found
        } else if (file === executableName) {
          return fullPath
        }
      }
      return null
    }
    
    foundExecutable = findExecutable(extractDir)
    
    if (!foundExecutable) {
      throw new Error(`Tectonic executable not found in archive`)
    }
    
    // Copy to bin directory
    const targetPath = path.join(binDir, executableName)
    fs.copyFileSync(foundExecutable, targetPath)
    
    // Make executable on Unix
    if (PLATFORM !== 'win32') {
      fs.chmodSync(targetPath, 0o755)
    }
    
    console.log(`✅ Tectonic binary installed to: ${targetPath}`)
    
    // Cleanup
    fs.rmSync(tempDir, { recursive: true, force: true })
    
    console.log('✅ Download complete')
  } catch (error) {
    console.error('❌ Download failed:', error.message)
    // Cleanup on error
    const tempDir = path.join(__dirname, '..', 'temp-download')
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
    process.exit(1)
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
}

module.exports = { main, parseAssetInfo, getCurrentPlatformRequirements }
