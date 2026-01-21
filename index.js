#!/usr/bin/env node
'use strict'

const LatexCompiler = require('./lib/latex-compiler')
const platformResolver = require('./lib/platform-resolver')

/**
 * Create a Tectonic compiler instance
 * 
 * @param {Object} [options] - Options
 * @param {string} [options.tectonicPath] - Custom path to Tectonic executable
 * @returns {LatexCompiler} - Compiler instance
 */
function createCompiler (options) {
  return new LatexCompiler(options)
}

/**
 * Compile LaTeX to PDF (convenience function)
 * 
 * @param {Object} config - Compilation configuration
 * @param {string} [config.tex] - LaTeX source text
 * @param {string} [config.texFile] - Path to .tex file
 * @param {string} [config.outputDir] - Output directory
 * @param {string} [config.outputFile] - Output PDF file path
 * @param {boolean} [config.returnBuffer] - Return PDF as Buffer
 * @param {Function} [config.onStdout] - Callback for stdout
 * @param {Function} [config.onStderr] - Callback for stderr
 * @param {string} [config.tectonicPath] - Custom Tectonic path
 * @returns {Promise<Object>} - Compilation result
 */
async function compile (config) {
  const compiler = createCompiler(config)
  return compiler.compile(config)
}

/**
 * Check if Tectonic is available
 * 
 * @param {Object} [options] - Options
 * @param {string} [options.tectonicPath] - Custom Tectonic path
 * @returns {boolean}
 */
function isAvailable (options) {
  try {
    const compiler = createCompiler(options)
    return compiler.isAvailable()
  } catch (e) {
    return false
  }
}

/**
 * Get Tectonic version
 * 
 * @param {Object} [options] - Options
 * @param {string} [options.tectonicPath] - Custom Tectonic path
 * @returns {Promise<string|null>}
 */
async function getVersion (options) {
  try {
    const compiler = createCompiler(options)
    return compiler.getVersion()
  } catch (e) {
    return null
  }
}

module.exports = {
  createCompiler,
  compile,
  isAvailable,
  getVersion,
  LatexCompiler,
  platformResolver
}

