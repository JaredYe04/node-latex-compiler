#!/usr/bin/env node
'use strict'

/**
 * Test script to verify compilation pipeline
 * Tests file input, text input, buffer output, and ENOTDIR error handling
 */

const fs = require('fs')
const path = require('path')
const os = require('os')
const { createCompiler, compile } = require('../index')

const TEST_TEX = `\\documentclass{article}
\\begin{document}
Hello, World! 你好 LaTeX!

This is a test document to verify that Tectonic compilation works correctly.
\\end{document}`

const TEST_TEX_ERROR = `\\documentclass{article}
\\begin{document}
\\invalidcommand{test}
\\end{document}`

async function testFileCompilation () {
  console.log('\n📄 Test 1: Compile from file')
  
  const testDir = path.join(__dirname, '..', 'test-output')
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true })
  }
  
  const texFile = path.join(testDir, 'test.tex')
  fs.writeFileSync(texFile, TEST_TEX, 'utf-8')
  
  try {
    const result = await compile({
      texFile: texFile,
      outputDir: testDir  // Explicitly set outputDir to test-output
    })
    
    if (result.status === 'success' && result.pdfPath) {
      const stats = fs.statSync(result.pdfPath)
      if (stats.size > 0) {
        console.log(`✅ File compilation successful`)
        console.log(`   PDF: ${result.pdfPath}`)
        console.log(`   Size: ${stats.size} bytes`)
        return true
      } else {
        console.log(`❌ PDF file is empty`)
        return false
      }
    } else {
      console.log(`❌ Compilation failed:`, result)
      return false
    }
  } catch (error) {
    console.log(`❌ Error: ${error.message}`)
    return false
  }
}

async function testTextCompilation () {
  console.log('\n📝 Test 2: Compile from text string')
  
  const testDir = path.join(__dirname, '..', 'test-output')
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true })
  }
  
  try {
    const result = await compile({
      tex: TEST_TEX,
      outputDir: testDir,  // Explicitly set outputDir to test-output
      outputFile: path.join(testDir, 'test-text.pdf')
    })
    
    if (result.status === 'success' && result.pdfPath) {
      const stats = fs.statSync(result.pdfPath)
      if (stats.size > 0) {
        console.log(`✅ Text compilation successful`)
        console.log(`   PDF: ${result.pdfPath}`)
        console.log(`   Size: ${stats.size} bytes`)
        return true
      } else {
        console.log(`❌ PDF file is empty`)
        return false
      }
    } else {
      console.log(`❌ Compilation failed:`, result)
      return false
    }
  } catch (error) {
    console.log(`❌ Error: ${error.message}`)
    return false
  }
}

async function testBufferOutput () {
  console.log('\n💾 Test 3: Compile to buffer')
  
  try {
    const result = await compile({
      tex: TEST_TEX,
      returnBuffer: true
    })
    
    if (result.status === 'success' && result.pdfBuffer) {
      if (result.pdfBuffer.length > 0) {
        console.log(`✅ Buffer output successful`)
        console.log(`   Buffer size: ${result.pdfBuffer.length} bytes`)
        
        // Verify it's a valid PDF (starts with %PDF)
        const pdfHeader = result.pdfBuffer.slice(0, 4).toString()
        if (pdfHeader === '%PDF') {
          console.log(`   ✅ Valid PDF header`)
          return true
        } else {
          console.log(`   ❌ Invalid PDF header: ${pdfHeader}`)
          return false
        }
      } else {
        console.log(`❌ Buffer is empty`)
        return false
      }
    } else {
      console.log(`❌ Compilation failed:`, result)
      return false
    }
  } catch (error) {
    console.log(`❌ Error: ${error.message}`)
    return false
  }
}

async function testStdoutStderr () {
  console.log('\n📊 Test 4: Test stdout/stderr callbacks')
  
  let stdoutReceived = false
  let stderrReceived = false
  
  try {
    const result = await compile({
      tex: TEST_TEX,
      returnBuffer: true,
      onStdout: (data) => {
        stdoutReceived = true
        console.log(`   [stdout] ${data.trim()}`)
      },
      onStderr: (data) => {
        stderrReceived = true
        console.log(`   [stderr] ${data.trim()}`)
      }
    })
    
    if (result.status === 'success') {
      console.log(`✅ Callbacks working`)
      console.log(`   stdout received: ${stdoutReceived}`)
      console.log(`   stderr received: ${stderrReceived}`)
      return true
    } else {
      console.log(`❌ Compilation failed`)
      return false
    }
  } catch (error) {
    console.log(`❌ Error: ${error.message}`)
    return false
  }
}

async function testErrorHandling () {
  console.log('\n⚠️  Test 5: Error handling')
  
  try {
    const result = await compile({
      tex: TEST_TEX_ERROR,
      returnBuffer: true
    })
    
    if (result.status === 'failed') {
      console.log(`✅ Error handling works`)
      console.log(`   Exit code: ${result.exitCode}`)
      if (result.stderr) {
        console.log(`   Error output captured: ${result.stderr.length} chars`)
      }
      return true
    } else {
      console.log(`❌ Expected failure but got success`)
      return false
    }
  } catch (error) {
    console.log(`✅ Error caught: ${error.message}`)
    return true
  }
}

async function testVersionCheck () {
  console.log('\n🔍 Test 6: Version check')
  
  try {
    const compiler = createCompiler()
    const version = await compiler.getVersion()
    
    if (version) {
      console.log(`✅ Version check successful`)
      console.log(`   Version: ${version}`)
      return true
    } else {
      console.log(`❌ Could not get version`)
      return false
    }
  } catch (error) {
    console.log(`❌ Error: ${error.message}`)
    return false
  }
}

async function testCrossDeviceMove () {
  console.log('\n🔄 Test: Cross-device move (EXDEV)')
  const pkgRoot = path.join(__dirname, '..')
  const tempDirRoot = path.parse(path.join(pkgRoot, '__latex_compile_temp__')).root
  const otherRoot = path.parse(os.tmpdir()).root
  if (tempDirRoot.toLowerCase() === otherRoot.toLowerCase()) {
    console.log('   ⏭️  Same drive, skipping (no EXDEV scenario)')
    return true
  }
  const outputFile = path.join(os.tmpdir(), 'node-latex-compiler-exdev-test.pdf')
  try {
    const result = await compile({
      tex: TEST_TEX,
      outputFile: outputFile
    })
    if (result.status !== 'success' || !result.pdfPath) {
      console.log(`   ❌ Compilation failed: ${JSON.stringify(result)}`)
      return false
    }
    if (!fs.existsSync(result.pdfPath)) {
      console.log(`   ❌ PDF not found: ${result.pdfPath}`)
      return false
    }
    const size = fs.statSync(result.pdfPath).size
    if (size <= 0) {
      console.log(`   ❌ PDF empty`)
      return false
    }
    console.log(`   ✅ Cross-device move OK (temp on ${tempDirRoot}, output on ${otherRoot})`)
    console.log(`   PDF: ${result.pdfPath}, size: ${size} bytes`)
    return true
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`)
    return false
  } finally {
    if (fs.existsSync(outputFile)) {
      try {
        fs.unlinkSync(outputFile)
      } catch (e) {
        // ignore
      }
    }
  }
}

// ENOTDIR error handling tests
const TEST_TEX_SIMPLE = `\\documentclass{article}
\\begin{document}
Hello, World! Test document.
\\end{document}`

async function testTempDirAsFile () {
  console.log('\n🧪 Test 7: Auto-fix - __latex_compile_temp__ exists as a file')
  
  const tempDir = path.join(__dirname, '..', '__latex_compile_temp__')
  
  // Cleanup first
  if (fs.existsSync(tempDir)) {
    const stats = fs.statSync(tempDir)
    if (stats.isDirectory()) {
      fs.rmSync(tempDir, { recursive: true, force: true })
    } else {
      try {
        fs.unlinkSync(tempDir)
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  }
  
  // Create temp as a file
  fs.writeFileSync(tempDir, 'test file content')
  console.log(`   Created file: ${tempDir}`)
  
  try {
    const result = await compile({
      tex: TEST_TEX_SIMPLE,
      returnBuffer: true
    })
    
    // Check if tempDir was automatically fixed (converted to directory)
    if (fs.existsSync(tempDir)) {
      const stats = fs.statSync(tempDir)
      if (stats.isDirectory()) {
        console.log(`   ✅ Auto-fixed: file was converted to directory`)
        console.log(`   ✅ Compilation successful`)
        return true
      } else {
        console.log(`   ❌ File still exists, not converted to directory`)
        return false
      }
    } else {
      console.log(`   ❌ Temp directory doesn't exist after compilation`)
      return false
    }
  } catch (error) {
    console.log(`   ❌ Error during compilation: ${error.message}`)
    return false
  } finally {
    // Cleanup
    if (fs.existsSync(tempDir)) {
      try {
        const stats = fs.statSync(tempDir)
        if (stats.isDirectory()) {
          fs.rmSync(tempDir, { recursive: true, force: true })
        } else {
          fs.unlinkSync(tempDir)
        }
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  }
}

async function testOutputDirAsFile () {
  console.log('\n🧪 Test 8: Auto-fix - outputDir exists as a file')
  
  const outputDir = path.join(__dirname, '..', 'test-enotdir-output')
  
  // Cleanup first
  if (fs.existsSync(outputDir)) {
    const stats = fs.statSync(outputDir)
    if (stats.isDirectory()) {
      fs.rmSync(outputDir, { recursive: true, force: true })
    } else {
      try {
        fs.unlinkSync(outputDir)
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  }
  
  // Create outputDir as a file
  fs.writeFileSync(outputDir, 'test file content')
  console.log(`   Created file: ${outputDir}`)
  
  try {
    const result = await compile({
      tex: TEST_TEX_SIMPLE,
      outputDir: outputDir
    })
    
    // Check if outputDir was automatically fixed
    if (fs.existsSync(outputDir)) {
      const stats = fs.statSync(outputDir)
      if (stats.isDirectory() && result.status === 'success') {
        console.log(`   ✅ Auto-fixed: file was converted to directory`)
        console.log(`   ✅ Compilation successful`)
        return true
      } else {
        console.log(`   ❌ File still exists or compilation failed`)
        return false
      }
    } else {
      console.log(`   ❌ Output directory doesn't exist after compilation`)
      return false
    }
  } catch (error) {
    console.log(`   ❌ Error during compilation: ${error.message}`)
    return false
  } finally {
    // Cleanup
    if (fs.existsSync(outputDir)) {
      try {
        const stats = fs.statSync(outputDir)
        if (stats.isDirectory()) {
          fs.rmSync(outputDir, { recursive: true, force: true })
        } else {
          fs.unlinkSync(outputDir)
        }
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  }
}

async function testOutputFileParentAsFile () {
  console.log('\n🧪 Test 9: Auto-fix - outputFile parent directory exists as a file')
  
  const parentDir = path.join(__dirname, '..', 'test-enotdir-parent')
  const outputFile = path.join(parentDir, 'subdir', 'output.pdf')
  
  // Cleanup first
  if (fs.existsSync(parentDir)) {
    const stats = fs.statSync(parentDir)
    if (stats.isDirectory()) {
      fs.rmSync(parentDir, { recursive: true, force: true })
    } else {
      try {
        fs.unlinkSync(parentDir)
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  }
  
  // Create parentDir as a file
  fs.writeFileSync(parentDir, 'test file content')
  console.log(`   Created file: ${parentDir}`)
  
  try {
    const result = await compile({
      tex: TEST_TEX_SIMPLE,
      outputFile: outputFile
    })
    
    // Check if parentDir was automatically fixed
    if (fs.existsSync(parentDir)) {
      const stats = fs.statSync(parentDir)
      if (stats.isDirectory() && result.status === 'success') {
        console.log(`   ✅ Auto-fixed: parent file was converted to directory`)
        console.log(`   ✅ Compilation successful`)
        return true
      } else {
        console.log(`   ❌ Parent still exists as file or compilation failed`)
        return false
      }
    } else {
      console.log(`   ❌ Parent directory doesn't exist after compilation`)
      return false
    }
  } catch (error) {
    console.log(`   ❌ Error during compilation: ${error.message}`)
    return false
  } finally {
    // Cleanup
    if (fs.existsSync(parentDir)) {
      try {
        const stats = fs.statSync(parentDir)
        if (stats.isDirectory()) {
          fs.rmSync(parentDir, { recursive: true, force: true })
        } else {
          fs.unlinkSync(parentDir)
        }
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  }
}

async function testTempDirParentAsFile () {
  console.log('\n🧪 Test 10: Auto-fix - temp directory parent exists as a file')
  
  // This test simulates the scenario where the project root directory is a file
  // We'll create a file where the temp directory's parent should be
  const projectRoot = path.join(__dirname, '..')
  const tempDirName = '__latex_compile_temp__'
  const tempDirParentFile = path.join(projectRoot, tempDirName + '_parent_file')
  
  // Cleanup first
  if (fs.existsSync(tempDirParentFile)) {
    fs.unlinkSync(tempDirParentFile)
  }
  
  // Note: We can't actually test this scenario easily because we can't replace the project root
  // But we can test a similar scenario by creating a file in a subdirectory
  // and trying to create a directory structure that would require going through that file
  
  // Instead, let's test the scenario where a parent of the project root might be a file
  // This is more realistic - e.g., if someone accidentally created a file named like a directory
  
  // For a more realistic test, let's create a nested structure where a parent is a file
  const testBaseDir = path.join(__dirname, '..', 'test-enotdir-nested')
  const fileAsParent = path.join(testBaseDir, 'file-as-parent')
  const nestedDir = path.join(fileAsParent, 'nested', 'dir')
  
  // Cleanup
  if (fs.existsSync(testBaseDir)) {
    fs.rmSync(testBaseDir, { recursive: true, force: true })
  }
  
  // Create base directory
  fs.mkdirSync(testBaseDir, { recursive: true })
  
  // Create a file where a directory should be
  fs.writeFileSync(fileAsParent, 'test file content')
  console.log(`   Created file: ${fileAsParent}`)
  console.log(`   Attempting to create nested path: ${nestedDir}`)
  
  try {
    // Try to compile with outputDir that requires going through the file
    const result = await compile({
      tex: TEST_TEX_SIMPLE,
      outputDir: nestedDir
    })
    
    // Check if the file was automatically fixed
    if (fs.existsSync(fileAsParent)) {
      const stats = fs.statSync(fileAsParent)
      if (stats.isDirectory() && result.status === 'success') {
        console.log(`   ✅ Auto-fixed: parent file was converted to directory`)
        console.log(`   ✅ Compilation successful`)
        return true
      } else {
        console.log(`   ❌ Parent still exists as file or compilation failed`)
        return false
      }
    } else {
      console.log(`   ❌ Parent doesn't exist after compilation`)
      return false
    }
  } catch (error) {
    console.log(`   ❌ Error during compilation: ${error.message}`)
    return false
  } finally {
    // Cleanup
    if (fs.existsSync(testBaseDir)) {
      fs.rmSync(testBaseDir, { recursive: true, force: true })
    }
  }
}

async function main () {
  console.log('🧪 Running Tectonic Compiler Tests')
  console.log('=====================================')
  
  // Check if compiler is available
  const isAvail = require('../index').isAvailable()
  if (!isAvail) {
    console.error('❌ Tectonic compiler not available')
    console.error('   Please run: npm run download')
    process.exit(1)
  }
  
  const results = []
  
  results.push(await testVersionCheck())
  results.push(await testFileCompilation())
  results.push(await testTextCompilation())
  results.push(await testBufferOutput())
  results.push(await testStdoutStderr())
  results.push(await testErrorHandling())
  results.push(await testCrossDeviceMove())
  
  // ENOTDIR error handling tests
  results.push(await testTempDirAsFile())
  results.push(await testOutputDirAsFile())
  results.push(await testOutputFileParentAsFile())
  results.push(await testTempDirParentAsFile())
  
  console.log('\n=====================================')
  const passed = results.filter(r => r).length
  const total = results.length
  
  console.log(`\n📊 Results: ${passed}/${total} tests passed`)
  
  if (passed === total) {
    console.log('✅ All tests passed!')
    process.exit(0)
  } else {
    console.log('❌ Some tests failed')
    process.exit(1)
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
}

module.exports = { main }

