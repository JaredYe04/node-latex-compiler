# node-tectonic-compiler

Node.js wrapper for [Tectonic](https://tectonic-typesetting.github.io/) LaTeX compiler with automatic binary download. Supports multiple input/output formats.

## Features

- ✅ **Automatic binary download** - Automatically downloads the correct Tectonic binary for your platform
- ✅ **Multiple input formats** - Compile from file path or text string
- ✅ **Multiple output formats** - Output to file or get PDF as Buffer
- ✅ **Real-time streaming** - Capture stdout/stderr during compilation
- ✅ **Cross-platform** - Supports Windows, macOS (Intel & ARM), and Linux
- ✅ **TypeScript support** - Full TypeScript definitions included

## Installation

```bash
npm install node-tectonic-compiler
```

The package will automatically download the appropriate Tectonic binary for your platform during installation.

## Quick Start

### Compile from file

```javascript
const { compile } = require('node-tectonic-compiler')

const result = await compile({
  texFile: './document.tex',
  outputDir: './output'
})

if (result.status === 'success') {
  console.log('PDF generated:', result.pdfPath)
} else {
  console.error('Compilation failed:', result.stderr)
}
```

### Compile from text

```javascript
const { compile } = require('node-tectonic-compiler')

const tex = `\\documentclass{article}
\\begin{document}
Hello, World!
\\end{document}`

const result = await compile({
  tex: tex,
  outputDir: './output'
})

if (result.status === 'success') {
  console.log('PDF generated:', result.pdfPath)
}
```

### Get PDF as Buffer

```javascript
const { compile } = require('node-tectonic-compiler')

const result = await compile({
  tex: tex,
  returnBuffer: true
})

if (result.status === 'success') {
  const pdfBuffer = result.pdfBuffer
  // Use the buffer directly
  fs.writeFileSync('output.pdf', pdfBuffer)
}
```

### With stdout/stderr callbacks

```javascript
const { compile } = require('node-tectonic-compiler')

const result = await compile({
  tex: tex,
  outputDir: './output',
  onStdout: (data) => {
    console.log('stdout:', data)
  },
  onStderr: (data) => {
    console.error('stderr:', data)
  }
})
```

## API

### `compile(config)`

Compile LaTeX to PDF.

**Parameters:**
- `config.tex` (string, optional) - LaTeX source text
- `config.texFile` (string, optional) - Path to .tex file
- `config.outputDir` (string, optional) - Output directory for PDF
- `config.outputFile` (string, optional) - Output PDF file path
- `config.returnBuffer` (boolean, optional) - If true, return PDF as Buffer
- `config.onStdout` (function, optional) - Callback for stdout data
- `config.onStderr` (function, optional) - Callback for stderr data
- `config.tectonicPath` (string, optional) - Custom path to Tectonic executable

**Returns:** Promise resolving to:
```javascript
{
  status: 'success' | 'failed',
  pdfPath?: string,        // File path (if returnBuffer is false)
  pdfBuffer?: Buffer,      // PDF buffer (if returnBuffer is true)
  exitCode?: number,        // Exit code (0 for success)
  stdout?: string,         // Standard output
  stderr?: string          // Standard error
}
```

### `createCompiler(options)`

Create a compiler instance.

**Parameters:**
- `options.tectonicPath` (string, optional) - Custom path to Tectonic executable

**Returns:** `TectonicCompiler` instance

### `isAvailable(options)`

Check if Tectonic is available.

**Returns:** boolean

### `getVersion(options)`

Get Tectonic version.

**Returns:** Promise<string | null>

## Platform Support

The package automatically downloads the correct binary for your platform:

- **Windows x64** - Uses GNU toolchain (smaller size)
- **macOS Intel (x64)** - x86_64-apple-darwin
- **macOS Apple Silicon (ARM64)** - aarch64-apple-darwin
- **Linux x64** - x86_64-unknown-linux-gnu

## Development

### Run tests

```bash
npm test
```

### Download binary manually

```bash
npm run download
```

## License

MIT

