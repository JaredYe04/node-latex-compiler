export interface CompileConfig {
  /** LaTeX source text (if not using texFile) */
  tex?: string;
  /** Path to .tex file */
  texFile?: string;
  /** Output directory for PDF */
  outputDir?: string;
  /** Output PDF file path */
  outputFile?: string;
  /** If true, return PDF as Buffer instead of file path */
  returnBuffer?: boolean;
  /** Callback for stdout data */
  onStdout?: (data: string) => void;
  /** Callback for stderr data */
  onStderr?: (data: string) => void;
  /** Custom path to Tectonic executable */
  tectonicPath?: string;
}

export interface CompileResult {
  status: 'success' | 'failed';
  pdfPath?: string;
  pdfBuffer?: Buffer;
  exitCode?: number;
  error?: string;
  stdout?: string;
  stderr?: string;
}

export interface CompilerOptions {
  tectonicPath?: string;
}

export declare class LatexCompiler {
  constructor(options?: CompilerOptions);
  isAvailable(): boolean;
  getVersion(): Promise<string | null>;
  compile(config: CompileConfig): Promise<CompileResult>;
}

export declare function createCompiler(options?: CompilerOptions): LatexCompiler;
export declare function compile(config: CompileConfig): Promise<CompileResult>;
export declare function isAvailable(options?: CompilerOptions): boolean;
export declare function getVersion(options?: CompilerOptions): Promise<string | null>;

