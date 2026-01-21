# Tectonic LaTeX 编译架构文档

本文档梳理了当前项目中 Tectonic LaTeX 编译器的完整实现链路，包括可执行文件获取、命令构建、编译执行和输出处理等各个环节。本文档旨在为后续解耦和跨平台适配提供参考。

## 目录

- [架构概览](#架构概览)
- [可执行文件获取](#可执行文件获取)
- [命令构建与执行](#命令构建与执行)
- [编译流程](#编译流程)
- [输出处理](#输出处理)
- [跨平台适配问题](#跨平台适配问题)
- [建议的解耦方案](#建议的解耦方案)

---

## 架构概览

当前实现采用了 Electron 主进程 + 渲染进程的架构模式：

```
渲染进程 (LaTeXEditor.vue)
    ↓ IPC: compile-tex
主进程 IPC Handler (main-calls.ts)
    ↓ 调用
LaTeX 服务 (latex-service.ts)
    ↓ 执行命令
Tectonic 可执行文件 (tectonic.exe)
    ↓ 输出
PDF 文件 + 控制台输出
```

### 关键文件位置

- **服务实现**: `meta-doc/src/main/utils/latex-service.ts`
- **路径管理**: `meta-doc/src/main/utils/path-service.ts`
- **IPC 处理器**: `meta-doc/src/main/main-calls.ts` (第 2532 行)
- **前端调用**: `meta-doc/src/renderer/src/views/LaTeXEditor.vue` (第 2333 行)
- **类型定义**: `meta-doc/src/types/utils.ts`
- **可执行文件**: `meta-doc/resources/tectonic.exe`

---

## 可执行文件获取

### 1. 文件位置

Tectonic 可执行文件位于项目的 resources 目录：
```
meta-doc/resources/tectonic.exe
```

### 2. 路径解析逻辑

路径获取通过 `PathService` 实现：

**文件**: `meta-doc/src/main/utils/path-service.ts`

```typescript
/**
 * 获取tectonic可执行文件路径
 */
getTectonicPath(): FilePath {
  return this.getResourceFile('tectonic.exe');
}
```

### 3. Resources 路径配置

resources 路径根据打包状态动态确定：

**开发环境**:
```typescript
resourcesPath = path.resolve(__dirname, '../../resources');
```

**打包环境**:
```typescript
resourcesPath = path.join(process.resourcesPath, '/app.asar.unpacked/resources');
```

**注意**: 在 `electron-builder.yml` 配置中，`resources` 目录配置为 `asarUnpack`：

```yaml
asarUnpack:
  - resources/**
```

这确保了 `resources` 目录下的所有文件（包括 `tectonic.exe`）都会被解包到应用安装目录，而不是打包进 asar 归档文件中。这是必要的，因为可执行文件需要被直接调用，不能从 asar 归档中执行。

### 4. 可用性检查

在编译前会检查可执行文件是否存在：

```typescript
isTectonicAvailable(): boolean {
  return fs.existsSync(this.tectonicPath);
}
```

### 5. 版本信息获取

```typescript
async getTectonicVersion(): Promise<string | null> {
  // 执行: tectonic.exe --version
  const child = exec(`"${this.tectonicPath}" --version`);
  // 收集 stdout 输出并返回
}
```

---

## 命令构建与执行

### 1. 命令格式

**文件**: `meta-doc/src/main/utils/latex-service.ts` (第 108 行)

```typescript
const cmd = `"${this.tectonicPath}" "${tempTexPath}" --outdir="${outputDir}"`;
```

**命令结构**:
- 可执行文件路径（带引号处理路径空格）
- 临时 .tex 文件路径（带引号）
- `--outdir` 参数指定输出目录

**示例**:
```bash
"D:\MetaDoc\MetaDoc\meta-doc\resources\tectonic.exe" "D:\temp\__temp_compile_1234567890.tex" --outdir="D:\temp"
```

### 2. 执行方式

使用 Node.js 的 `child_process.exec()` 执行命令：

```typescript
const child: ChildProcess = exec(cmd);
```

**特点**:
- 同步等待进程完成
- 可以实时监听 stdout/stderr
- 通过 `close` 事件获取退出码

---

## 编译流程

### 1. 完整流程步骤

#### 步骤 1: 接收编译请求

**前端调用** (`LaTeXEditor.vue`):
```typescript
const compileResult = await ipcRenderer.invoke("compile-tex", {
    tex: currentTex.value,              // LaTeX 源码
    texPath: currentPath.value ?? '',   // 文件路径（用于确定输出目录）
    outputDir: "",                      // 可选的输出目录
    customPdfFileName: ""               // 可选的 PDF 文件名
});
```

#### 步骤 2: IPC Handler 处理

**主进程** (`main-calls.ts`):
```typescript
ipcMain.handle('compile-tex', async (event: IpcMainInvokeEvent, data: CompileTexData) => {
    const result = await compileLatexToPDF(
        data.texPath,
        data.tex,
        data.outputDir,
        mainWindow ?? undefined,
        data.customPdfFileName
    );
    // 发送成功/失败事件到渲染进程
    return result;
});
```

#### 步骤 3: 创建临时文件

```typescript
private createTempTexFile(outputDir: FilePath, tex: string): FilePath {
    const tempTexPath = path.join(outputDir, `__temp_compile_${Date.now()}.tex`);
    fs.writeFileSync(tempTexPath, tex, 'utf-8');
    return tempTexPath;
}
```

**特点**:
- 使用时间戳生成唯一文件名
- 文件保存在输出目录
- UTF-8 编码写入

#### 步骤 4: 确定输出路径

```typescript
const pdfFileName = customPdfFileName || 
    path.basename(texFilePath, path.extname(texFilePath)) + '.pdf';
const pdfPath = path.join(actualOutputDir, pdfFileName);
```

#### 步骤 5: 执行编译

调用 `executeCompilation()` 方法执行编译命令。

#### 步骤 6: 处理输出

详见 [输出处理](#输出处理) 章节。

#### 步骤 7: 清理临时文件

编译完成后删除临时 .tex 文件：
```typescript
this.cleanupTempFile(tempTexPath);
```

#### 步骤 8: 重命名 PDF 文件

Tectonic 会根据输入文件名生成 PDF，需要重命名为最终文件名：
```typescript
const tempPdfPath = this.getTempPdfPath(tempTexPath, outputDir);
if (fs.existsSync(tempPdfPath)) {
    fs.renameSync(tempPdfPath, finalPdfPath);
}
```

### 2. 输出目录处理

```typescript
const actualOutputDir = outputDir || path.dirname(texFilePath);
this.ensureDirectoryExists(actualOutputDir);
```

如果没有指定输出目录，使用 tex 文件所在目录。

---

## 输出处理

### 1. 标准输出 (stdout) 处理

```typescript
if (child.stdout) {
    child.stdout.on('data', (data: Buffer) => {
        if (mainWindow) {
            mainWindow.webContents.send('console-out', {
                key: 'latex',
                content: data.toString(),
                type: 'out'
            });
        }
    });
}
```

**传输方式**: IPC 消息 `console-out`
**接收方**: 渲染进程通过 `eventBus.on('console-out', ...)` 监听

### 2. 错误输出 (stderr) 处理

```typescript
if (child.stderr) {
    child.stderr.on('data', (data: Buffer) => {
        if (mainWindow) {
            mainWindow.webContents.send('console-err', {
                key: 'latex',
                content: data.toString(),
                type: 'err'
            });
        }
    });
}
```

**传输方式**: IPC 消息 `console-err`
**接收方**: 渲染进程通过 `eventBus.on('console-err', ...)` 监听

### 3. 编译完成处理

```typescript
child.on('close', (code: number | null) => {
    this.handleCompilationComplete(code, tempTexPath, outputDir, finalPdfPath, resolve);
});
```

**退出码判断**:
- `exitCode === 0`: 编译成功
- 其他值: 编译失败

### 4. 进程错误处理

```typescript
child.on('error', (error) => {
    logger.error('LaTeX compilation process error:', error);
    this.cleanupTempFile(tempTexPath);
    resolve({ status: 'failed', exitCode: -1 });
});
```

### 5. 编译结果

**成功**:
```typescript
{
    status: 'success',
    pdfPath: '/path/to/output.pdf'
}
```

**失败**:
```typescript
{
    status: 'failed',
    exitCode: 1  // 或 -1（进程启动失败）
}
```

### 6. 前端输出显示

**渲染进程** (`LaTeXEditor.vue`):
```typescript
const compileConsoleListeners = {
    onStdout: (payload: any) => {
        if (payload.key === 'latex') {
            compileConsoleOutput.stdout += payload.content;
        }
    },
    onStderr: (payload: any) => {
        if (payload.key === 'latex') {
            compileConsoleOutput.stderr += payload.content;
        }
    }
};

eventBus.on('console-out', compileConsoleListeners.onStdout);
eventBus.on('console-err', compileConsoleListeners.onStderr);
```

---

## 跨平台适配问题

### 1. 当前实现的问题

#### 问题 1: 硬编码 `.exe` 扩展名

**位置**: `path-service.ts:106`
```typescript
getTectonicPath(): FilePath {
  return this.getResourceFile('tectonic.exe');  // ❌ 硬编码 .exe
}
```

**影响**:
- Windows: `tectonic.exe` ✅
- macOS: 应该是 `tectonic` 或无扩展名 ❌
- Linux: 应该是 `tectonic` 或无扩展名 ❌

#### 问题 2: 路径分隔符

虽然 Node.js 的 `path.join()` 会自动处理路径分隔符，但在命令构建时使用了硬编码的引号，在某些情况下可能存在问题。

#### 问题 3: 可执行文件权限

Linux/macOS 可能需要可执行权限设置，当前实现未考虑。

### 2. 平台检测

当前代码中没有平台检测逻辑，需要添加：

```typescript
import os from 'os';

const platform = os.platform();  // 'win32' | 'darwin' | 'linux'
```

### 3. 平台特定文件名

不同平台的可执行文件命名：
- **Windows**: `tectonic.exe`
- **macOS**: `tectonic` 或 `tectonic-x86_64-apple-darwin`
- **Linux**: `tectonic` 或 `tectonic-x86_64-unknown-linux-gnu`

---

## 建议的解耦方案

### 1. 创建独立的 Node 包结构

```
@your-org/tectonic-compiler/
├── src/
│   ├── index.ts                    # 主入口
│   ├── compiler.ts                 # 编译服务
│   ├── platform.ts                 # 平台检测和路径解析
│   ├── executor.ts                 # 命令执行器
│   └── types.ts                    # 类型定义
├── bin/                            # 可执行文件目录（按平台组织）
│   ├── win32/
│   │   └── tectonic.exe
│   ├── darwin/
│   │   └── tectonic
│   └── linux/
│       └── tectonic
└── package.json
```

### 2. 平台自适应路径解析

```typescript
import os from 'os';
import path from 'path';

export function getTectonicExecutableName(): string {
  const platform = os.platform();
  switch (platform) {
    case 'win32':
      return 'tectonic.exe';
    case 'darwin':
    case 'linux':
      return 'tectonic';
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}

export function getTectonicPath(resourcesPath: string): string {
  const platform = os.platform();
  const executableName = getTectonicExecutableName();
  return path.join(resourcesPath, platform, executableName);
}
```

### 3. 统一的编译接口

```typescript
export interface TectonicCompilerConfig {
  tex: string;
  outputDir: string;
  texFilePath?: string;
  customPdfFileName?: string;
  onStdout?: (data: string) => void;
  onStderr?: (data: string) => void;
}

export interface TectonicCompileResult {
  status: 'success' | 'failed';
  pdfPath?: string;
  exitCode?: number;
  stdout?: string;
  stderr?: string;
}

export class TectonicCompiler {
  async compile(config: TectonicCompilerConfig): Promise<TectonicCompileResult> {
    // 实现编译逻辑
  }
}
```

### 4. 可执行文件管理

#### 方案 A: 打包到 npm 包

将各平台可执行文件打包到 npm 包中，安装时自动选择：

```json
{
  "bin": {
    "tectonic": "./bin/index.js"
  },
  "optionalDependencies": {
    "@tectonic/win32": "^0.1.0",
    "@tectonic/darwin": "^0.1.0",
    "@tectonic/linux": "^0.1.0"
  }
}
```

### 5. 命令执行抽象

```typescript
export interface CommandExecutor {
  execute(
    command: string,
    options?: {
      cwd?: string;
      env?: Record<string, string>;
      onStdout?: (data: string) => void;
      onStderr?: (data: string) => void;
    }
  ): Promise<{ exitCode: number; stdout: string; stderr: string }>;
}

export class NodeCommandExecutor implements CommandExecutor {
  // 使用 child_process 实现
}
```

### 6. 输出流处理改进

```typescript
export interface StreamHandler {
  onStdout(data: Buffer): void;
  onStderr(data: Buffer): void;
}

export class BufferedStreamHandler implements StreamHandler {
  private stdout: string = '';
  private stderr: string = '';
  
  onStdout(data: Buffer): void {
    this.stdout += data.toString();
  }
  
  onStderr(data: Buffer): void {
    this.stderr += data.toString();
  }
  
  getOutput(): { stdout: string; stderr: string } {
    return { stdout: this.stdout, stderr: this.stderr };
  }
}
```

### 7. 类型定义导出

```typescript
// types.ts
export type { TectonicCompilerConfig, TectonicCompileResult };
export type { StreamHandler };
export type { CommandExecutor };
```

---

## 总结

### 当前实现的核心流程

1. **路径获取**: `PathService.getTectonicPath()` → 硬编码 `tectonic.exe`
2. **命令构建**: `"${tectonicPath}" "${texPath}" --outdir="${outputDir}"`
3. **执行方式**: `child_process.exec()` 同步执行
4. **输出流**: 通过 IPC 实时传输到渲染进程
5. **结果处理**: 根据退出码和文件存在性判断成功/失败

### 主要痛点

1. ❌ **平台硬编码**: `.exe` 扩展名只适用于 Windows
2. ❌ **路径管理**: 资源路径与业务逻辑耦合
3. ❌ **命令构建**: 未考虑跨平台的命令格式差异
4. ❌ **可执行文件管理**: 没有版本管理和更新机制

### 解耦建议

1. ✅ **平台抽象层**: 统一平台检测和路径解析
2. ✅ **配置化**: 支持自定义可执行文件路径
3. ✅ **独立包**: 创建独立的 npm 包便于复用
4. ✅ **类型安全**: 完整的 TypeScript 类型定义
5. ✅ **扩展性**: 支持自定义命令执行器和输出处理器

---

## 附录

### A. 相关文件清单

- `meta-doc/src/main/utils/latex-service.ts` - 核心编译服务
- `meta-doc/src/main/utils/path-service.ts` - 路径管理服务
- `meta-doc/src/main/main-calls.ts` - IPC 处理器
- `meta-doc/src/renderer/src/views/LaTeXEditor.vue` - 前端调用
- `meta-doc/src/types/utils.ts` - 类型定义
- `meta-doc/resources/tectonic.exe` - 可执行文件

### B. 依赖关系

```
LaTeXEditor.vue
  → ipcRenderer.invoke('compile-tex')
    → main-calls.ts (IPC Handler)
      → latex-service.ts
        → path-service.ts (获取可执行文件路径)
        → child_process.exec() (执行命令)
          → tectonic.exe
```

### C. IPC 通信协议

**请求通道**: `compile-tex`
```typescript
interface CompileTexData {
  tex: string;
  texPath: string;
  outputDir?: string;
  customPdfFileName?: string;
}
```

**响应**: `LaTeXCompileResult`
```typescript
interface LaTeXCompileResult {
  status: 'success' | 'failed';
  pdfPath?: string;
  exitCode?: number;
}
```

**事件通道**:
- `console-out`: 标准输出流
- `console-err`: 错误输出流
- `compile-latex-success`: 编译成功通知
- `compile-latex-fail`: 编译失败通知

---

**文档版本**: 1.0  
**最后更新**: 2024-12-19  
**维护者**: MetaDoc Team
