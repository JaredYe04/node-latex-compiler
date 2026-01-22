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
const OUTPUT_DIR = process.argv[5] || path.join(__dirname, '..', 'runtimes', '@node-latex-compiler', 'bin-' + PLATFORM + '-' + ARCH)

if (!PLATFORM || !ARCH || !VERSION) {
  console.error('Usage: node scripts/create-runtime-package-json.js <platform> <arch> <version> [output-dir]')
  process.exit(1)
}

// Trim and validate version
if (!VERSION || typeof VERSION !== 'string') {
  console.error('❌ Error: Version must be a non-empty string')
  console.error('Received version:', JSON.stringify(VERSION))
  console.error('Type:', typeof VERSION)
  process.exit(1)
}

const cleanVersion = VERSION.trim()
if (!cleanVersion) {
  console.error('❌ Error: Version cannot be empty after trimming')
  console.error('Received version:', JSON.stringify(VERSION))
  process.exit(1)
}

// Validate version format (semver) - more lenient to allow pre-release versions
// Basic semver: major.minor.patch[-prerelease][+build]
const semverRegex = /^\d+\.\d+\.\d+(-[\da-z\-]+(\.[\da-z\-]+)*)?(\+[\da-z\-]+(\.[\da-z\-]+)*)?$/i
if (!semverRegex.test(cleanVersion)) {
  console.error(`❌ Error: Invalid version format: "${cleanVersion}"`)
  console.error('Version must follow semantic versioning (e.g., 1.0.0, 1.0.0-beta.1)')
  console.error('Received raw version:', JSON.stringify(VERSION))
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

const packageName = '@node-latex-compiler/bin-' + normalizedPlatform + '-' + normalizedArch

// Ensure version is a valid string (not empty, not null, not undefined)
if (!cleanVersion || typeof cleanVersion !== 'string' || cleanVersion.length === 0) {
  console.error('❌ Error: Version must be a non-empty string')
  console.error('Received version:', JSON.stringify(VERSION))
  console.error('Cleaned version:', JSON.stringify(cleanVersion))
  process.exit(1)
}

const packageJson = {
  name: packageName,
  version: cleanVersion,  // Must be a valid semver string
  description: 'Tectonic binary for node-latex-compiler on ' + normalizedPlatform + ' ' + normalizedArch,
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
    url: 'https://github.com/JaredYe04/node-latex-compiler.git',
    directory: 'runtimes/@node-latex-compiler/bin-' + normalizedPlatform + '-' + normalizedArch
  },
  license: 'MIT',
  author: ''
}

// Final validation: ensure version field is set correctly
if (!packageJson.version || packageJson.version.length === 0) {
  console.error('❌ Error: Version field is empty in package.json object')
  process.exit(1)
}

// Final validation: ensure version field is set correctly
if (!packageJson.version || packageJson.version.length === 0) {
  console.error('❌ Error: Version field is empty in package.json object')
  process.exit(1)
}

// Create output directory if it doesn't exist
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true })
}

const packageJsonPath = path.join(OUTPUT_DIR, 'package.json')

// Write package.json
const packageJsonString = JSON.stringify(packageJson, null, 2) + '\n'
fs.writeFileSync(packageJsonPath, packageJsonString)

// Verify the written file
const writtenPackageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))
if (!writtenPackageJson.version || writtenPackageJson.version.length === 0) {
  console.error('❌ Error: Version is empty in written package.json')
  console.error('Package.json content:')
  console.error(packageJsonString)
  process.exit(1)
}

console.log('Created package.json:', packageJsonPath)
console.log('Package:', packageName + '@' + cleanVersion)
console.log('Version:', cleanVersion)
console.log('✅ Package.json verified - version is valid')

