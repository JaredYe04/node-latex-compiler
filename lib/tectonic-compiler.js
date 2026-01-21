'use strict'

const fs = require('fs')
const path = require('path')
const os = require('os')
const { exec } = require('child_process')
const platformResolver = require('./platform-resolver')

/**
 * Get temporary directory for compilation
 * Creates a temp directory in the project root if it doesn't exist
 */
function getTempDir () {
  const tempDir = path.join(__dirname, '..', 'temp')
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true })
  }
  return tempDir
}

/**
 * Tectonic Compiler Service
 * Supports multiple input/output formats:
 * - Input: file path, text string
 * - Output: file path, buffer
 */
class TectonicCompiler {
  constructor (options) {
    options = options || {}
    this.tectonicPath = options.tectonicPath || platformResolver.resolveTectonicExecutable(options)
    
    if (!this.tectonicPath) {
      throw new Error(
        'Tectonic executable not found. ' +
        'Please install @node-tectonic-compiler/bin-* package for your platform, ' +
        'or specify tectonicPath in options.'
      )
    }
  }

  /**
   * Check if Tectonic is available
   * @returns {boolean}
   */
  isAvailable () {
    return fs.existsSync(this.tectonicPath)
  }

  /**
   * Get Tectonic version
   * @returns {Promise<string|null>}
   */
  async getVersion () {
    return new Promise((resolve, reject) => {
      // Tectonic doesn't support --version, try --help and parse version from output
      const cmd = `"${this.tectonicPath}" --help`
      exec(cmd, { encoding: 'utf-8' }, (error, stdout, stderr) => {
        if (error) {
          resolve(null)
        } else {
          // Try to extract version from help output
          const output = stdout || stderr
          const versionMatch = output.match(/tectonic[-\s]+([\d.]+[\+\w-]*)/i)
          if (versionMatch) {
            resolve(versionMatch[1])
          } else {
            // If we can't parse version, at least confirm it's working
            resolve(output.includes('tectonic') ? 'unknown' : null)
          }
        }
      })
    })
  }

  /**
   * Compile LaTeX to PDF
   * 
   * @param {Object} config - Compilation configuration
   * @param {string} [config.tex] - LaTeX source text (if not using texFile)
   * @param {string} [config.texFile] - Path to .tex file
   * @param {string} [config.outputDir] - Output directory for PDF
   * @param {string} [config.outputFile] - Output PDF file path
   * @param {boolean} [config.returnBuffer] - If true, return PDF as Buffer instead of file path
   * @param {Function} [config.onStdout] - Callback for stdout data
   * @param {Function} [config.onStderr] - Callback for stderr data
   * @returns {Promise<Object>} - { status: 'success'|'failed', pdfPath?: string, pdfBuffer?: Buffer, exitCode?: number, stdout?: string, stderr?: string }
   */
  async compile (config) {
    config = config || {}
    
    // Determine input source
    let tempTexPath = null
    let shouldCleanupTemp = false
    let result = null
    
    try {
      // Get temp directory for all temporary files
      const tempDir = getTempDir()
      
      if (config.texFile) {
        // Use provided file
        if (!fs.existsSync(config.texFile)) {
          throw new Error(`LaTeX file not found: ${config.texFile}`)
        }
        tempTexPath = config.texFile
      } else if (config.tex) {
        // Create temporary file from text in temp directory
        tempTexPath = path.join(tempDir, `__temp_compile_${Date.now()}.tex`)
        fs.writeFileSync(tempTexPath, config.tex, 'utf-8')
        shouldCleanupTemp = true
      } else {
        throw new Error('Either tex or texFile must be provided')
      }

      // Determine output path
      // Use temp directory for intermediate files, but final output goes to specified outputDir
      const outputDir = config.outputDir || (config.texFile ? path.dirname(config.texFile) : tempDir)
      this.ensureDirectoryExists(outputDir)
      
      // For compilation, use temp directory to avoid polluting output directory
      const compileOutputDir = tempDir

      let finalPdfPath = null
      if (config.outputFile) {
        finalPdfPath = path.resolve(config.outputFile)
      } else if (config.texFile) {
        const baseName = path.basename(config.texFile, path.extname(config.texFile))
        finalPdfPath = path.join(outputDir, `${baseName}.pdf`)
      } else {
        const baseName = path.basename(tempTexPath, path.extname(tempTexPath))
        finalPdfPath = path.join(outputDir, `${baseName}.pdf`)
      }

      // Execute compilation (output to temp directory first)
      result = await this.executeCompilation({
        texPath: tempTexPath,
        outputDir: compileOutputDir,
        onStdout: config.onStdout,
        onStderr: config.onStderr
      })

      // Handle output
      if (result.status === 'success') {
        // Tectonic generates PDF with the same name as input file in compileOutputDir
        const tempPdfPath = this.getTempPdfPath(tempTexPath, compileOutputDir)
        
        if (fs.existsSync(tempPdfPath)) {
          if (config.returnBuffer) {
            // Read PDF as buffer
            const pdfBuffer = fs.readFileSync(tempPdfPath)
            
            // Cleanup temp PDF if it's different from final path
            if (tempPdfPath !== finalPdfPath) {
              fs.unlinkSync(tempPdfPath)
            }
            
            return {
              status: 'success',
              pdfBuffer: pdfBuffer,
              stdout: result.stdout,
              stderr: result.stderr
            }
          } else {
            // Move/rename to final path
            if (tempPdfPath !== finalPdfPath) {
              if (fs.existsSync(finalPdfPath)) {
                fs.unlinkSync(finalPdfPath)
              }
              fs.renameSync(tempPdfPath, finalPdfPath)
            }
            
            return {
              status: 'success',
              pdfPath: finalPdfPath,
              stdout: result.stdout,
              stderr: result.stderr
            }
          }
        } else {
          return {
            status: 'failed',
            exitCode: result.exitCode || -1,
            error: 'PDF file was not generated',
            stdout: result.stdout,
            stderr: result.stderr
          }
        }
      } else {
        return result
      }
    } finally {
      // Cleanup temporary files
      if (shouldCleanupTemp && tempTexPath && fs.existsSync(tempTexPath)) {
        try {
          fs.unlinkSync(tempTexPath)
        } catch (e) {
          // Ignore cleanup errors
        }
      }
      
      // Cleanup temporary PDF if it was created in temp directory and not moved
      if (result && result.status === 'success' && tempTexPath) {
        const tempPdfPath = this.getTempPdfPath(tempTexPath, getTempDir())
        if (fs.existsSync(tempPdfPath)) {
          // Only cleanup if it's in temp directory and not the final output
          const finalPdfPath = config.outputFile 
            ? path.resolve(config.outputFile)
            : (config.texFile 
              ? path.join(outputDir, path.basename(config.texFile, path.extname(config.texFile)) + '.pdf')
              : null)
          
          if (finalPdfPath && tempPdfPath !== finalPdfPath && tempPdfPath.startsWith(getTempDir())) {
            try {
              fs.unlinkSync(tempPdfPath)
            } catch (e) {
              // Ignore cleanup errors
            }
          }
        }
      }
    }
  }

  /**
   * Execute Tectonic compilation command
   * @private
   */
  executeCompilation (config) {
    return new Promise((resolve) => {
      const { texPath, outputDir, onStdout, onStderr } = config
      
      const cmd = `"${this.tectonicPath}" "${texPath}" --outdir="${outputDir}"`
      
      let stdout = ''
      let stderr = ''
      
      const child = exec(cmd, { encoding: 'utf-8' })
      
      if (child.stdout) {
        child.stdout.on('data', (data) => {
          const text = data.toString()
          stdout += text
          if (onStdout) {
            onStdout(text)
          }
        })
      }
      
      if (child.stderr) {
        child.stderr.on('data', (data) => {
          const text = data.toString()
          stderr += text
          if (onStderr) {
            onStderr(text)
          }
        })
      }
      
      child.on('close', (code) => {
        if (code === 0) {
          resolve({
            status: 'success',
            exitCode: 0,
            stdout: stdout,
            stderr: stderr
          })
        } else {
          resolve({
            status: 'failed',
            exitCode: code,
            stdout: stdout,
            stderr: stderr
          })
        }
      })
      
      child.on('error', (error) => {
        resolve({
          status: 'failed',
          exitCode: -1,
          error: error.message,
          stdout: stdout,
          stderr: stderr
        })
      })
    })
  }

  /**
   * Get temporary PDF path (Tectonic generates PDF with same name as input)
   * @private
   */
  getTempPdfPath (texPath, outputDir) {
    const baseName = path.basename(texPath, path.extname(texPath))
    return path.join(outputDir, `${baseName}.pdf`)
  }

  /**
   * Ensure directory exists
   * @private
   */
  ensureDirectoryExists (dirPath) {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true })
    }
  }
}

module.exports = TectonicCompiler

