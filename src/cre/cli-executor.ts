/**
 * CRE CLI Executor
 *
 * This module spawns the `cre workflow simulate` CLI command programmatically
 * to execute workflows locally while using the actual CRE workflow code.
 * This ensures simulation behavior matches production deployment.
 */

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { err } from '../errors.js';
import type { CREWorkflowRequest, CREWorkflowResponse } from './types.js';

/**
 * Configuration for CRE CLI execution
 */
export interface CRECLIConfig {
  /** Path to the workflow folder (e.g., "./x402-workflow") */
  workflowPath: string;

  /** Target settings name from workflow.yaml (e.g., "staging-settings") */
  target: string;

  /** Process timeout in milliseconds (default: 60000) */
  timeout?: number;

  /** Enable --broadcast flag for real transactions */
  broadcast?: boolean;

  /** Enable --engine-logs for debugging */
  engineLogs?: boolean;

  /** Working directory for the CRE CLI (defaults to process.cwd()) */
  cwd?: string;
}

/**
 * Result from parsing CLI output
 */
interface CLIParseResult {
  /** Parsed workflow response (if found) */
  response?: CREWorkflowResponse;

  /** Log lines from the CLI output */
  logs: string[];

  /** Raw stdout content */
  stdout: string;

  /** Raw stderr content */
  stderr: string;
}

/**
 * Execute a CRE workflow using the CLI simulator
 *
 * Spawns `cre workflow simulate` with the given request payload
 * and returns the parsed workflow response.
 *
 * @param config - CLI configuration
 * @param request - Workflow request payload
 * @returns Workflow response
 * @throws X402Error if CLI execution fails
 */
export async function executeCREWorkflow(
  config: CRECLIConfig,
  request: CREWorkflowRequest
): Promise<CREWorkflowResponse> {
  await validateCRECLI();

  const workflowPath = resolve(
    config.cwd ?? process.cwd(),
    config.workflowPath
  );
  if (!existsSync(workflowPath)) {
    throw err.notFound(
      `Workflow directory not found: ${workflowPath}. ` +
        'Ensure the x402-workflow folder exists.'
    );
  }

  // Pass the resolved absolute path so the CRE CLI finds the workflow
  // correctly regardless of what the caller's cwd is.
  const args = buildCLIArgs({ ...config, workflowPath }, request);
  const result = await spawnCREProcess(args, config);
  const parseResult = parseCLIOutput(result.stdout, result.stderr);

  if (!parseResult.response) {
    throw err.internal('Failed to parse CRE workflow response', {
      details: {
        stdout: result.stdout.slice(0, 2000),
        stderr: result.stderr.slice(0, 2000),
        logs: parseResult.logs,
      },
    });
  }

  return parseResult.response;
}

/**
 * Validate that the CRE CLI is available in PATH
 */
async function validateCRECLI(): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    const which = spawn('which', ['cre']);
    let stdout = '';

    which.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    which.on('close', (code) => {
      if (code !== 0 || !stdout.trim()) {
        reject(
          err.notFound(
            'CRE CLI not found. Install it from https://docs.chain.link/cre or run: cre login'
          )
        );
      } else {
        resolvePromise();
      }
    });

    which.on('error', () => {
      reject(
        err.notFound(
          'CRE CLI not found. Install it from https://docs.chain.link/cre or run: cre login'
        )
      );
    });
  });
}

/**
 * Build CLI arguments for cre workflow simulate
 */
function buildCLIArgs(
  config: CRECLIConfig,
  request: CREWorkflowRequest
): string[] {
  const args = [
    'workflow',
    'simulate',
    config.workflowPath,
    '--target',
    config.target,
    '--non-interactive',
    '--trigger-index',
    '0',
    '--http-payload',
    JSON.stringify(request),
  ];

  // CRE CLI v1.1.0 has a bug that corrupts the last 2 bytes of --http-payload.
  // Appending '!!' (non-whitespace, non-JSON) means the actual closing braces
  // of the JSON are preserved while the '!!' bytes absorb the corruption.
  // The workflow's main.ts strips everything after the last '}' as a fix.
  args[args.length - 1] = (args[args.length - 1] as string) + '!!';

  if (config.broadcast) {
    args.push('--broadcast');
  }

  if (config.engineLogs) {
    args.push('--engine-logs');
  }

  return args;
}

/**
 * Spawn the CRE CLI process and capture output
 */
async function spawnCREProcess(
  args: string[],
  config: CRECLIConfig
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolvePromise, reject) => {
    const timeout = config.timeout ?? 60000;
    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const proc = spawn('cre', args, {
      cwd: config.cwd ?? process.cwd(),
      env: process.env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    // Set up timeout
    const timeoutId = setTimeout(() => {
      timedOut = true;
      proc.kill('SIGTERM');
      // Give it a moment to clean up, then force kill
      setTimeout(() => {
        if (!proc.killed) {
          proc.kill('SIGKILL');
        }
      }, 1000);
    }, timeout);

    proc.stdout.on('data', (data: Buffer) => {
      const text = data.toString();
      stdout += text;
      if (config.engineLogs) {
        // Stream each non-empty line to the parent process stdout in real-time
        for (const line of text.split('\n')) {
          if (line.trim()) process.stdout.write(`\x1b[2m[CRE] ${line}\x1b[0m\n`);
        }
      }
    });

    proc.stderr.on('data', (data: Buffer) => {
      const text = data.toString();
      stderr += text;
      if (config.engineLogs) {
        for (const line of text.split('\n')) {
          if (line.trim()) process.stderr.write(`\x1b[2m[CRE] ${line}\x1b[0m\n`);
        }
      }
    });

    proc.on('close', (code) => {
      clearTimeout(timeoutId);

      if (timedOut) {
        reject(err.timeout(timeout));
        return;
      }

      // CRE CLI may return non-zero for workflow errors
      // We still try to parse the response
      resolvePromise({
        stdout,
        stderr,
        exitCode: code ?? 0,
      });
    });

    proc.on('error', (error) => {
      clearTimeout(timeoutId);
      reject(
        err.internal(`Failed to spawn CRE CLI: ${error.message}`, {
          cause: error,
        })
      );
    });
  });
}

/**
 * Parse CLI output to extract workflow response and logs
 */
function parseCLIOutput(stdout: string, stderr: string): CLIParseResult {
  const logs: string[] = [];
  let response: CREWorkflowResponse | undefined;
  const lines = stdout.split('\n');

  // Try to find JSON response in stdout
  // The response is typically the last valid JSON object
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i]?.trim() ?? '';

    if (!line) continue;

    if (line.startsWith('{')) {
      try {
        const parsed = JSON.parse(line) as unknown;
        if (isWorkflowResponse(parsed)) {
          response = parsed;
          break;
        }
      } catch {
        // Not valid JSON, continue searching
      }
    }

    if (
      line.startsWith('[') ||
      line.startsWith('Warning:') ||
      line.startsWith('Error:')
    ) {
      logs.unshift(line);
    }
  }

  // If no JSON found in stdout, try stderr
  if (!response) {
    const stderrLines = stderr.split('\n');
    for (let i = stderrLines.length - 1; i >= 0; i--) {
      const line = stderrLines[i]?.trim() ?? '';
      if (line.startsWith('{')) {
        try {
          const parsed = JSON.parse(line) as unknown;
          if (isWorkflowResponse(parsed)) {
            response = parsed;
            break;
          }
        } catch {
          // Continue searching
        }
      }
    }
  }

  // If still no response, try to find JSON object anywhere in the output
  if (!response) {
    response = extractJSONFromText(stdout) ?? extractJSONFromText(stderr);
  }

  return {
    ...(response !== undefined ? { response } : {}),
    logs,
    stdout,
    stderr,
  };
}

/**
 * Check if an object looks like a CREWorkflowResponse
 */
function isWorkflowResponse(obj: unknown): obj is CREWorkflowResponse {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }

  const response = obj as Record<string, unknown>;

  return (
    typeof response.success === 'boolean' && typeof response.action === 'string'
  );
}

/**
 * Try to extract a JSON object from text
 */
function extractJSONFromText(text: string): CREWorkflowResponse | undefined {
  let depth = 0;
  let start = -1;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (char === '{') {
      if (depth === 0) {
        start = i;
      }
      depth++;
    } else if (char === '}') {
      depth--;
      if (depth === 0 && start !== -1) {
        // Found a complete JSON object
        const jsonStr = text.slice(start, i + 1);
        try {
          const parsed = JSON.parse(jsonStr) as unknown;
          if (isWorkflowResponse(parsed)) {
            return parsed;
          }
        } catch {
          // Not valid JSON, continue
        }
        start = -1;
      }
    }
  }

  return undefined;
}

/**
 * Check if CRE CLI is installed and available
 *
 * @returns true if CRE CLI is available, false otherwise
 */
export async function isCRECLIAvailable(): Promise<boolean> {
  try {
    await validateCRECLI();
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the CRE CLI version
 *
 * @returns Version string or undefined if not available
 */
export async function getCRECLIVersion(): Promise<string | undefined> {
  return new Promise((resolvePromise) => {
    const proc = spawn('cre', ['--version']);
    let stdout = '';

    proc.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    proc.on('close', (code) => {
      if (code === 0 && stdout.trim()) {
        resolvePromise(stdout.trim());
      } else {
        resolvePromise(undefined);
      }
    });

    proc.on('error', () => {
      resolvePromise(undefined);
    });
  });
}
