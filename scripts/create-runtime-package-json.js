#!/usr/bin/env node
'use strict'

/**
 * Create package.json for runtime package
 * 
 * Usage:
 *   node scripts/create-runtime-package-json.js <platform> <arch> <version> [output-dir]
 */

const fs = require('fs')
const path = require('path')

const PLATFORM = process.argv[2]
const ARCH = process.argv[3]
const VERSION = process.argv[4]
const OUTPUT_DIR = process.argv[5] || path.join(__dirname, '..', 'runtimes', '@node-tectonic-compiler', 'bin-' + PLATFORM + '-' + ARCH)

if (!PLATFORM || !ARCH || !VERSION) {
  console.error('Usage: node scripts/create-runtime-package-json.js <platform> <arch> <version> [output-dir]')
  process.exit(1)
}

// Normalize platform names
let normalizedPlatform = PLATFORM
if (PLATFORM === 'macos' || PLATFORM === 'osx') {
  normalizedPlatform = 'darwin'
} else if (PLATFORM === 'windows' || PLATFORM === 'cygwin' || PLATFORM === 'msys') {
  normalizedPlatform = 'win32'
}

// Normalize architecture
let normalizedArch = ARCH
if (ARCH === 'x86_64' || ARCH === 'amd64') {
  normalizedArch = 'x64'
} else if (ARCH === 'aarch64') {
  normalizedArch = 'arm64'
}

const packageName = '@node-tectonic-compiler/bin-' + normalizedPlatform + '-' + normalizedArch

const packageJson = {
  name: packageName,
  version: VERSION,
  description: 'Tectonic binary for node-tectonic-compiler on ' + normalizedPlatform + ' ' + normalizedArch,
  os: [normalizedPlatform],
  cpu: [normalizedArch],
  keywords: [
    'tectonic',
    'latex',
    'tex',
    'compiler',
    'runtime'
  ],
  files: [
    'bin/**'
  ],
  repository: {
    type: 'git',
    url: '',
    directory: 'runtimes/@node-tectonic-compiler/bin-' + normalizedPlatform + '-' + normalizedArch
  },
  license: 'MIT',
  author: ''
}

// Create output directory if it doesn't exist
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true })
}

const packageJsonPath = path.join(OUTPUT_DIR, 'package.json')
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n')

console.log('Created package.json:', packageJsonPath)
console.log('Package:', packageName + '@' + VERSION)

