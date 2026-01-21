#!/usr/bin/env node
'use strict'

/**
 * Test script to verify compilation pipeline
 * Tests file input, text input, and buffer output
 */

const fs = require('fs')
const path = require('path')
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

