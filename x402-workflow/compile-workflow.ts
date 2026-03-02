#!/usr/bin/env bun

import { existsSync, readFileSync, unlinkSync, writeFileSync, renameSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { $ } from 'bun'

// Import the workflow wrapper from SDK using absolute path
const sdkPath = path.resolve('./node_modules/@chainlink/cre-sdk/scripts/src')
const { wrapWorkflowCode } = await import(`${sdkPath}/workflow-wrapper.ts`)
const { main: compileToWasm } = await import(`${sdkPath}/compile-to-wasm.ts`)

const compileToJs = async (tsFilePath: string, outputFilePath: string) => {
  const resolvedInput = path.resolve(tsFilePath)
  console.info(`📁 Using input file: ${resolvedInput}`)

  const resolvedOutput = path.resolve(outputFilePath)

  // Ensure the output directory exists
  await mkdir(path.dirname(resolvedOutput), { recursive: true })

  // Wrap workflow code with automatic error handling
  const originalCode = readFileSync(resolvedInput, 'utf-8')
  const wrappedCode = wrapWorkflowCode(originalCode, resolvedInput)

  // Write wrapped code to temp file
  const tempFile = path.join(
    path.dirname(resolvedInput),
    `.workflow-temp-${Date.now()}-${Math.random().toString(36).slice(2)}.ts`,
  )
  writeFileSync(tempFile, wrappedCode, 'utf-8')

  try {
    // Build step with 'browser' target
    const buildResult = await Bun.build({
      entrypoints: [tempFile],
      outdir: path.dirname(resolvedOutput),
      target: 'browser',
      format: 'esm',
      // FIX 1: Mark buffer modules as external so Bun doesn't fail trying to bundle them
      external: ['node:buffer', 'buffer'], 
    })

    if (!buildResult.success) {
      console.error('❌ Build failed:')
      for (const log of buildResult.logs) {
        console.error(log)
      }
      process.exit(1)
    }

    // Rename the output file to the target name
    const generatedFile = tempFile.replace(/\.ts$/, '.js')
    const targetFile = path.join(path.dirname(resolvedOutput), path.basename(resolvedOutput))

    if (existsSync(generatedFile)) {
      renameSync(generatedFile, targetFile)
    } else {
       console.error(`❌ Generated build file not found at: ${generatedFile}`)
       process.exit(1)
    }

    if (!existsSync(targetFile)) {
      console.error(`❌ Expected file not found: ${targetFile}`)
      process.exit(1)
    }

    // Bundle into the final file
    await $`bun build ${targetFile} --target=browser --bundle --outfile=${resolvedOutput} --external:node:buffer --external:buffer`

    // FIX 2: Enhanced Polyfill injection
    let jsContent = readFileSync(resolvedOutput, 'utf-8')
    
    // Regex to find 'import { Buffer } from "node:buffer"' or similar
    const bufferImportRegex = /import\s*{?\s*Buffer\s*}?\s*from\s*['"](node:)?buffer['"];?/g
    
    // Minimal Buffer polyfill for Javy
    const bufferPolyfill = `
// Buffer polyfill for Javy
var Buffer = (() => {
  const _base64Decode = (str) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let result = '';
    str = str.replace(/=+$/, '');
    for (let i = 0; i < str.length; i += 4) {
      const a = chars.indexOf(str[i]);
      const b = chars.indexOf(str[i + 1]);
      const c = chars.indexOf(str[i + 2]);
      const d = chars.indexOf(str[i + 3]);
      const n = (a << 18) | (b << 12) | (c << 6) | d;
      result += String.fromCharCode((n >> 16) & 0xFF);
      if (c !== -1) result += String.fromCharCode((n >> 8) & 0xFF);
      if (d !== -1) result += String.fromCharCode(n & 0xFF);
    }
    return result;
  };

  const BufferImpl = function(data, encoding) {
    if (typeof data === 'string') {
      if (encoding === 'base64') {
        const binary = _base64Decode(data);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
      } else if (encoding === 'hex') {
        const bytes = new Uint8Array(data.length / 2);
        for (let i = 0; i < data.length; i += 2) {
          bytes[i / 2] = parseInt(data.substr(i, 2), 16);
        }
        return bytes;
      }
      return new TextEncoder().encode(data);
    }
    if (Array.isArray(data)) {
      return new Uint8Array(data);
    }
    return data;
  };

  BufferImpl.from = BufferImpl;
  BufferImpl.prototype = Uint8Array.prototype;
  BufferImpl.prototype.toString = function(encoding) {
    if (encoding === 'hex') return Array.from(this).map(b => b.toString(16).padStart(2, '0')).join('');
    if (encoding === 'base64') {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
      let result = '';
      const len = this.length;
      for (let i = 0; i < len; i += 3) {
        const b0 = this[i];
        const b1 = i + 1 < len ? this[i + 1] : 0;
        const b2 = i + 2 < len ? this[i + 2] : 0;
        const rem = len - i;
        result += chars[b0 >> 2];
        result += chars[((b0 & 3) << 4) | (b1 >> 4)];
        result += rem > 1 ? chars[((b1 & 15) << 2) | (b2 >> 6)] : '=';
        result += rem > 2 ? chars[b2 & 63] : '=';
      }
      return result;
    }
    return new TextDecoder().decode(this);
  };
  return BufferImpl;
})();
`

    if (bufferImportRegex.test(jsContent)) {
      console.info('📝 Post-processing: injecting Buffer polyfill...')
      jsContent = jsContent.replace(bufferImportRegex, '') // Remove the import
      jsContent = bufferPolyfill + '\n' + jsContent      // Prepend the polyfill
      writeFileSync(resolvedOutput, jsContent, 'utf-8')
    } else if (jsContent.includes('Buffer')) {
      // If Buffer is used but no import was found (global usage), prepend polyfill anyway
       console.info('📝 Post-processing: Buffer usage detected, injecting polyfill...')
       jsContent = bufferPolyfill + '\n' + jsContent
       writeFileSync(resolvedOutput, jsContent, 'utf-8')
    }

    console.info(`✅ Built JS: ${resolvedOutput}`)
    return resolvedOutput
  } finally {
    if (existsSync(tempFile)) {
      unlinkSync(tempFile)
    }
  }
}

const main = async () => {
  const cliArgs = process.argv.slice(2)
  const inputPath = cliArgs[0]
  const outputWasmPath = cliArgs[1]

  if (!inputPath || !outputWasmPath) {
    console.error('Usage: bun compile-workflow.ts <input.ts> <output.wasm>')
    process.exit(1)
  }

  console.log('🚀 Compiling workflow')
  console.log(`📁 Input:   ${path.resolve(inputPath)}`)
  
  const resolvedInput = path.resolve(inputPath)
  const resolvedWasmOutput = path.resolve(outputWasmPath)
  const resolvedJsOutput = resolvedWasmOutput.replace('.wasm', '.js')
  
  console.log(`🧪 JS out:  ${resolvedJsOutput}`)
  console.log(`🎯 WASM out:${resolvedWasmOutput}`)
  console.log('')
  console.log('📦 Step 1: Compiling JS...')
  
  await compileToJs(resolvedInput, resolvedJsOutput)

  if (!existsSync(resolvedJsOutput)) {
    throw new Error(`JS file not found: ${resolvedJsOutput}`)
  }

  console.log('📦 Step 2: Compiling WASM...')
  await compileToWasm(resolvedJsOutput, resolvedWasmOutput)

  console.log('✅ Compilation complete!')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})