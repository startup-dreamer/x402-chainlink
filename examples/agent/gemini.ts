/**
 * Gemini AI client with get_weather tool calling.
 *
 * Uses @google/generative-ai with function declarations so that Gemini
 * decides when to fetch weather data. The agent intercepts those tool calls
 * and runs the x402 payment flow before returning the result.
 */

import {
  GoogleGenerativeAI,
  type ChatSession,
  SchemaType,
  type Tool,
  type Part,
  GoogleGenerativeAIResponseError,
} from '@google/generative-ai';

const weatherTool: Tool = {
  functionDeclarations: [
    {
      name: 'get_weather',
      description:
        'Fetch real-time weather data from the x402-protected backend API. ' +
        'This tool costs 0.001 USDC per call via the x402 payment protocol ' +
        'settled through Chainlink CRE on Base Sepolia. Only call this when ' +
        'the user is asking about current weather conditions or forecasts.',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          query: {
            type: SchemaType.STRING,
            description:
              'The weather question or location string from the user',
          },
        },
        required: ['query'],
      },
    },
  ],
};

const SYSTEM_INSTRUCTION = `You are a helpful AI assistant with access to a real-time weather data tool.

Key capabilities:
- Answer general knowledge questions conversationally (blockchain, tech, science, etc.)
- Fetch current weather data using the get_weather tool when the user asks about weather

Important notes about the weather tool:
- It costs 0.001 USDC per call (paid via x402 on Base Sepolia through Chainlink CRE)
- The user will be shown the payment details and must confirm before the call is made
- When you receive weather data back, format it as a clear, friendly natural language response
- The weather data is live from Open-Meteo and supports any city worldwide

For casual conversation, greetings, or non-weather questions, respond directly without using any tools.`;

export type GeminiResponse =
  | { type: 'text'; text: string }
  | { type: 'tool_call'; name: string; args: Record<string, unknown> };

export const DEFAULT_MODEL = 'gemini-2.0-flash-lite';

const MAX_RETRIES = 5;
const INITIAL_DELAY_MS = 10000;

function isRateLimit(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes('429') ||
    msg.includes('Too Many Requests') ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    (err instanceof GoogleGenerativeAIResponseError &&
      String(err.message).includes('429'))
  );
}

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isRateLimit(err)) throw err;
      const delayMs = INITIAL_DELAY_MS * Math.pow(2, attempt);
      const secs = (delayMs / 1000).toFixed(1);
      process.stderr.write(
        `  [Rate limit] Waiting ${secs}s before retry (${attempt + 1}/${MAX_RETRIES})...\n`
      );
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw lastErr;
}

export function createGeminiClient(apiKey: string, model = DEFAULT_MODEL) {
  const genAI = new GoogleGenerativeAI(apiKey);

  return genAI.getGenerativeModel({
    model,
    tools: [weatherTool],
    systemInstruction: SYSTEM_INSTRUCTION,
  });
}

export function createChatSession(
  apiKey: string,
  model = DEFAULT_MODEL
): ChatSession {
  return createGeminiClient(apiKey, model).startChat({ history: [] });
}

export async function sendMessage(
  chat: ChatSession,
  text: string
): Promise<GeminiResponse> {
  const result = await withRetry(() => chat.sendMessage(text));
  const response = result.response;

  const functionCalls = response.functionCalls();
  if (functionCalls && functionCalls.length > 0) {
    const call = functionCalls[0];
    return {
      type: 'tool_call',
      name: call.name,
      args: call.args as Record<string, unknown>,
    };
  }

  return { type: 'text', text: response.text() };
}

export async function sendToolResult(
  chat: ChatSession,
  toolName: string,
  result: unknown
): Promise<string> {
  const toolResultPart: Part = {
    functionResponse: {
      name: toolName,
      response: { content: result },
    },
  };

  const followUp = await withRetry(() => chat.sendMessage([toolResultPart]));
  return followUp.response.text();
}
