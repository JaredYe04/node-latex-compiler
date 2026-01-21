<div align="center">

# 🚀 node-tectonic-compiler

**The Ultimate LaTeX Compiler for Node.js - Zero Configuration, Zero Dependencies**

[![npm version](https://img.shields.io/npm/v/node-tectonic-compiler.svg)](https://www.npmjs.com/package/node-tectonic-compiler)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D14.x-brightgreen.svg)](https://nodejs.org/)

**✨ Automatically downloads the right binary for your platform**  
**📦 No system dependencies required**  
**🎯 LaTeX packages auto-downloaded on-the-fly**

[English](#english) | [中文](#中文)

</div>

---

<a name="english"></a>
## 🌟 English

### What Makes This Special?

**node-tectonic-compiler** is a powerful, zero-configuration LaTeX compiler wrapper that brings the full power of [Tectonic](https://tectonic-typesetting.github.io/) to your Node.js applications. Unlike traditional LaTeX distributions, it requires **zero setup** and **zero system dependencies**.

#### 🎯 Key Features

- ✅ **🔄 Auto-Download Binary** - Automatically detects your platform and downloads the correct Tectonic binary (Windows, macOS Intel/ARM, Linux)
- ✅ **📦 Zero System Dependencies** - Pure Node.js environment, no need to install Tectonic, LaTeX, or any system packages
- ✅ **📚 Auto Package Management** - LaTeX packages are automatically downloaded from CTAN as needed (powered by Tectonic's bundle system)
- ✅ **🎨 Multiple I/O Formats** - Compile from file paths or text strings, output to files or get PDF as Buffer
- ✅ **📡 Real-time Streaming** - Capture stdout/stderr during compilation for live feedback
- ✅ **🌍 Cross-platform** - Works seamlessly on Windows, macOS (Intel & Apple Silicon), and Linux
- ✅ **📘 TypeScript Ready** - Full TypeScript definitions included

### 🚀 Quick Start

#### Installation

```bash
npm install node-tectonic-compiler
```

That's it! The package automatically downloads the correct binary for your platform during installation. No manual setup required.

#### Basic Usage

**Compile from a file:**

```javascript
const { compile } = require('node-tectonic-compiler')

const result = await compile({
  texFile: './document.tex',
  outputDir: './output'
})

if (result.status === 'success') {
  console.log('✅ PDF generated:', result.pdfPath)
} else {
  console.error('❌ Compilation failed:', result.stderr)
}
```

**Compile from text string:**

```javascript
const { compile } = require('node-tectonic-compiler')

const tex = `\\documentclass{article}
\\usepackage{amsmath}
\\begin{document}
Hello, World! This is a test document.

\\[
E = mc^2
\\]
\\end{document}`

const result = await compile({
  tex: tex,
  outputDir: './output'
})
```

**Get PDF as Buffer (for in-memory processing):**

```javascript
const { compile } = require('node-tectonic-compiler')
const fs = require('fs')

const result = await compile({
  tex: tex,
  returnBuffer: true  // Returns PDF as Buffer instead of file
})

if (result.status === 'success') {
  // Use the buffer directly - perfect for APIs, cloud storage, etc.
  fs.writeFileSync('output.pdf', result.pdfBuffer)
  // Or upload to S3, send via HTTP, etc.
}
```

**Real-time compilation feedback:**

```javascript
const { compile } = require('node-tectonic-compiler')

const result = await compile({
  tex: tex,
  outputDir: './output',
  onStdout: (data) => {
    console.log('📝', data.trim())  // Compilation progress
  },
  onStderr: (data) => {
    console.warn('⚠️', data.trim())  // Warnings and errors
  }
})
```

### 📖 API Reference

#### `compile(config)`

Compile LaTeX source to PDF.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `tex` | `string` | LaTeX source text (mutually exclusive with `texFile`) |
| `texFile` | `string` | Path to `.tex` file (mutually exclusive with `tex`) |
| `outputDir` | `string` | Output directory for PDF (default: same as input file or current directory) |
| `outputFile` | `string` | Specific output PDF file path |
| `returnBuffer` | `boolean` | If `true`, return PDF as `Buffer` instead of file path |
| `onStdout` | `function` | Callback for stdout data: `(data: string) => void` |
| `onStderr` | `function` | Callback for stderr data: `(data: string) => void` |
| `tectonicPath` | `string` | Custom path to Tectonic executable (optional) |

**Returns:** `Promise<CompileResult>`

```typescript
interface CompileResult {
  status: 'success' | 'failed'
  pdfPath?: string        // File path (when returnBuffer is false)
  pdfBuffer?: Buffer      // PDF buffer (when returnBuffer is true)
  exitCode?: number       // Exit code (0 for success)
  stdout?: string         // Standard output
  stderr?: string         // Standard error
  error?: string          // Error message (when status is 'failed')
}
```

#### `createCompiler(options)`

Create a compiler instance for advanced usage.

```javascript
const { createCompiler } = require('node-tectonic-compiler')

const compiler = createCompiler({
  tectonicPath: '/custom/path/to/tectonic'  // Optional
})

const result = await compiler.compile({ tex: '...', outputDir: './output' })
```

#### `isAvailable(options)`

Check if Tectonic is available on the system.

```javascript
const { isAvailable } = require('node-tectonic-compiler')

if (isAvailable()) {
  console.log('✅ Tectonic is ready to use!')
}
```

#### `getVersion(options)`

Get the version of the installed Tectonic binary.

```javascript
const { getVersion } = require('node-tectonic-compiler')

const version = await getVersion()
console.log('Tectonic version:', version)
```

### 🎨 Advanced Examples

#### Compile with custom output filename

```javascript
const result = await compile({
  tex: tex,
  outputDir: './output',
  outputFile: './output/my-custom-name.pdf'
})
```

#### Compile and upload to cloud storage

```javascript
const { compile } = require('node-tectonic-compiler')
const AWS = require('aws-sdk')

const result = await compile({
  tex: tex,
  returnBuffer: true
})

if (result.status === 'success') {
  const s3 = new AWS.S3()
  await s3.putObject({
    Bucket: 'my-bucket',
    Key: 'document.pdf',
    Body: result.pdfBuffer
  }).promise()
}
```

#### Batch compilation

```javascript
const { compile } = require('node-tectonic-compiler')
const files = ['doc1.tex', 'doc2.tex', 'doc3.tex']

const results = await Promise.all(
  files.map(file => compile({
    texFile: file,
    outputDir: './output'
  }))
)

const successful = results.filter(r => r.status === 'success')
console.log(`✅ Compiled ${successful.length}/${files.length} documents`)
```

### 🌐 Platform Support

The package automatically downloads the correct binary for your platform:

| Platform | Architecture | Binary Type |
|----------|--------------|-------------|
| **Windows** | x64 | MSVC toolchain (no runtime dependencies) |
| **macOS** | Intel (x64) | x86_64-apple-darwin |
| **macOS** | Apple Silicon (ARM64) | aarch64-apple-darwin |
| **Linux** | x64 | x86_64-unknown-linux-gnu |

### 🔧 Development

#### Run tests

```bash
npm test
```

#### Download binary manually

```bash
npm run download
```

### 💡 How It Works

1. **Automatic Binary Detection**: On installation, the package detects your OS and architecture
2. **Smart Download**: Downloads the appropriate Tectonic binary from GitHub releases
3. **Package Management**: Tectonic automatically downloads LaTeX packages from CTAN as needed
4. **Zero Configuration**: Everything works out of the box - no LaTeX installation required!

### 📝 License

MIT

---

<a name="中文"></a>
## 🌟 中文

### 为什么选择这个包？

**node-tectonic-compiler** 是一个强大的、零配置的 LaTeX 编译器封装，将 [Tectonic](https://tectonic-typesetting.github.io/) 的强大功能带到您的 Node.js 应用中。与传统的 LaTeX 发行版不同，它**无需任何设置**，**无需系统依赖**。

#### 🎯 核心特性

- ✅ **🔄 自动下载二进制文件** - 自动检测您的平台并下载正确的 Tectonic 二进制文件（Windows、macOS Intel/ARM、Linux）
- ✅ **📦 零系统依赖** - 纯 Node.js 环境，无需安装 Tectonic、LaTeX 或任何系统包
- ✅ **📚 自动包管理** - LaTeX 宏包会根据需要自动从 CTAN 下载（由 Tectonic 的 bundle 系统提供支持）
- ✅ **🎨 多种输入输出格式** - 支持从文件路径或文本字符串编译，输出到文件或获取 PDF Buffer
- ✅ **📡 实时流式输出** - 捕获编译过程中的 stdout/stderr，提供实时反馈
- ✅ **🌍 跨平台支持** - 在 Windows、macOS（Intel 和 Apple Silicon）和 Linux 上无缝工作
- ✅ **📘 TypeScript 支持** - 包含完整的 TypeScript 类型定义

### 🚀 快速开始

#### 安装

```bash
npm install node-tectonic-compiler
```

就这么简单！包会在安装时自动为您的平台下载正确的二进制文件。无需手动设置。

#### 基本用法

**从文件编译：**

```javascript
const { compile } = require('node-tectonic-compiler')

const result = await compile({
  texFile: './document.tex',
  outputDir: './output'
})

if (result.status === 'success') {
  console.log('✅ PDF 已生成:', result.pdfPath)
} else {
  console.error('❌ 编译失败:', result.stderr)
}
```

**从文本字符串编译：**

```javascript
const { compile } = require('node-tectonic-compiler')

const tex = `\\documentclass{article}
\\usepackage{amsmath}
\\begin{document}
你好，世界！这是一个测试文档。

\\[
E = mc^2
\\]
\\end{document}`

const result = await compile({
  tex: tex,
  outputDir: './output'
})
```

**获取 PDF Buffer（用于内存处理）：**

```javascript
const { compile } = require('node-tectonic-compiler')
const fs = require('fs')

const result = await compile({
  tex: tex,
  returnBuffer: true  // 返回 PDF Buffer 而不是文件路径
})

if (result.status === 'success') {
  // 直接使用 buffer - 完美适用于 API、云存储等场景
  fs.writeFileSync('output.pdf', result.pdfBuffer)
  // 或上传到 S3、通过 HTTP 发送等
}
```

**实时编译反馈：**

```javascript
const { compile } = require('node-tectonic-compiler')

const result = await compile({
  tex: tex,
  outputDir: './output',
  onStdout: (data) => {
    console.log('📝', data.trim())  // 编译进度
  },
  onStderr: (data) => {
    console.warn('⚠️', data.trim())  // 警告和错误
  }
})
```

### 📖 API 参考

#### `compile(config)`

将 LaTeX 源代码编译为 PDF。

**参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `tex` | `string` | LaTeX 源代码文本（与 `texFile` 互斥） |
| `texFile` | `string` | `.tex` 文件路径（与 `tex` 互斥） |
| `outputDir` | `string` | PDF 输出目录（默认：与输入文件相同或当前目录） |
| `outputFile` | `string` | 指定的输出 PDF 文件路径 |
| `returnBuffer` | `boolean` | 如果为 `true`，返回 PDF `Buffer` 而不是文件路径 |
| `onStdout` | `function` | stdout 数据回调：`(data: string) => void` |
| `onStderr` | `function` | stderr 数据回调：`(data: string) => void` |
| `tectonicPath` | `string` | Tectonic 可执行文件的自定义路径（可选） |

**返回：** `Promise<CompileResult>`

```typescript
interface CompileResult {
  status: 'success' | 'failed'
  pdfPath?: string        // 文件路径（当 returnBuffer 为 false 时）
  pdfBuffer?: Buffer      // PDF buffer（当 returnBuffer 为 true 时）
  exitCode?: number       // 退出码（0 表示成功）
  stdout?: string         // 标准输出
  stderr?: string         // 标准错误
  error?: string          // 错误消息（当 status 为 'failed' 时）
}
```

#### `createCompiler(options)`

创建编译器实例用于高级用法。

```javascript
const { createCompiler } = require('node-tectonic-compiler')

const compiler = createCompiler({
  tectonicPath: '/custom/path/to/tectonic'  // 可选
})

const result = await compiler.compile({ tex: '...', outputDir: './output' })
```

#### `isAvailable(options)`

检查系统上是否可用 Tectonic。

```javascript
const { isAvailable } = require('node-tectonic-compiler')

if (isAvailable()) {
  console.log('✅ Tectonic 已就绪！')
}
```

#### `getVersion(options)`

获取已安装的 Tectonic 二进制文件的版本。

```javascript
const { getVersion } = require('node-tectonic-compiler')

const version = await getVersion()
console.log('Tectonic 版本:', version)
```

### 🎨 高级示例

#### 使用自定义输出文件名编译

```javascript
const result = await compile({
  tex: tex,
  outputDir: './output',
  outputFile: './output/my-custom-name.pdf'
})
```

#### 编译并上传到云存储

```javascript
const { compile } = require('node-tectonic-compiler')
const AWS = require('aws-sdk')

const result = await compile({
  tex: tex,
  returnBuffer: true
})

if (result.status === 'success') {
  const s3 = new AWS.S3()
  await s3.putObject({
    Bucket: 'my-bucket',
    Key: 'document.pdf',
    Body: result.pdfBuffer
  }).promise()
}
```

#### 批量编译

```javascript
const { compile } = require('node-tectonic-compiler')
const files = ['doc1.tex', 'doc2.tex', 'doc3.tex']

const results = await Promise.all(
  files.map(file => compile({
    texFile: file,
    outputDir: './output'
  }))
)

const successful = results.filter(r => r.status === 'success')
console.log(`✅ 已编译 ${successful.length}/${files.length} 个文档`)
```

### 🌐 平台支持

包会自动为您的平台下载正确的二进制文件：

| 平台 | 架构 | 二进制类型 |
|------|------|-----------|
| **Windows** | x64 | MSVC 工具链（无需运行时依赖） |
| **macOS** | Intel (x64) | x86_64-apple-darwin |
| **macOS** | Apple Silicon (ARM64) | aarch64-apple-darwin |
| **Linux** | x64 | x86_64-unknown-linux-gnu |

### 🔧 开发

#### 运行测试

```bash
npm test
```

#### 手动下载二进制文件

```bash
npm run download
```

### 💡 工作原理

1. **自动二进制检测**：安装时，包会检测您的操作系统和架构
2. **智能下载**：从 GitHub releases 下载相应的 Tectonic 二进制文件
3. **包管理**：Tectonic 会根据需要自动从 CTAN 下载 LaTeX 宏包
4. **零配置**：开箱即用 - 无需安装 LaTeX！

### 📝 许可证

MIT

---

<div align="center">

**Made with ❤️ for the LaTeX community**

[Report Bug](https://github.com/JaredYe04/node-tectonic-compiler/issues) · [Request Feature](https://github.com/JaredYe04/node-tectonic-compiler/issues)

</div>
