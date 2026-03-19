import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { LanguageModel } from 'ai';

// Mock the AI SDK provider factories BEFORE importing the modules under test
vi.mock('@ai-sdk/anthropic', () => ({
  createAnthropic: vi.fn((config: { apiKey: string }) => {
    return (model: string): LanguageModel =>
      ({
        specificationVersion: 'v1',
        provider: 'anthropic',
        modelId: model,
        doGenerate: vi.fn(),
        doStream: vi.fn(),
      }) as unknown as LanguageModel;
  }),
}));

vi.mock('@ai-sdk/openai', () => ({
  createOpenAI: vi.fn((config: { apiKey: string }) => {
    return (model: string): LanguageModel =>
      ({
        specificationVersion: 'v1',
        provider: 'openai',
        modelId: model,
        doGenerate: vi.fn(),
        doStream: vi.fn(),
      }) as unknown as LanguageModel;
  }),
}));

vi.mock('@ai-sdk/google', () => ({
  createGoogleGenerativeAI: vi.fn((config: { apiKey: string }) => {
    return (model: string): LanguageModel =>
      ({
        specificationVersion: 'v1',
        provider: 'google',
        modelId: model,
        doGenerate: vi.fn(),
        doStream: vi.fn(),
      }) as unknown as LanguageModel;
  }),
}));

vi.mock('@openrouter/ai-sdk-provider', () => ({
  createOpenRouter: vi.fn((config: { apiKey: string }) => {
    return {
      chat: (model: string): LanguageModel =>
        ({
          specificationVersion: 'v1',
          provider: 'openrouter',
          modelId: model,
          doGenerate: vi.fn(),
          doStream: vi.fn(),
        }) as unknown as LanguageModel,
    };
  }),
}));

vi.mock('ollama-ai-provider-v2', () => ({
  createOllama: vi.fn((config: { baseURL?: string }) => {
    return (model: string): LanguageModel =>
      ({
        specificationVersion: 'v1',
        provider: 'ollama',
        modelId: model,
        doGenerate: vi.fn(),
        doStream: vi.fn(),
      }) as unknown as LanguageModel;
  }),
}));

// Mock streamText and generateText from 'ai'
vi.mock('ai', () => ({
  streamText: vi.fn(),
  generateText: vi.fn(),
}));

import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { createOllama } from 'ollama-ai-provider-v2';
import { streamText, generateText } from 'ai';

import { getModel } from '@/lib/llm/providers';
import { streamLLM, generateLLM } from '@/lib/llm/gateway';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getModel — provider factory registry', () => {
  it('returns LanguageModel for anthropic', () => {
    const model = getModel('anthropic', 'claude-3-haiku-20240307', {
      apiKey: 'test-key',
    });
    expect(model).toBeDefined();
    expect(model.doGenerate).toBeDefined();
  });

  it('returns LanguageModel for openai', () => {
    const model = getModel('openai', 'gpt-4o-mini', { apiKey: 'test-key' });
    expect(model).toBeDefined();
    expect(model.doGenerate).toBeDefined();
  });

  it('returns LanguageModel for google', () => {
    const model = getModel('google', 'gemini-2.0-flash', {
      apiKey: 'test-key',
    });
    expect(model).toBeDefined();
    expect(model.doGenerate).toBeDefined();
  });

  it('returns LanguageModel for openrouter', () => {
    const model = getModel(
      'openrouter',
      'meta-llama/llama-3.1-8b-instruct:free',
      { apiKey: 'test-key' },
    );
    expect(model).toBeDefined();
    expect(model.doGenerate).toBeDefined();
  });

  it('returns LanguageModel for ollama (no apiKey needed)', () => {
    const model = getModel('ollama', 'llama3.2', {});
    expect(model).toBeDefined();
    expect(model.doGenerate).toBeDefined();
  });

  it('throws descriptive error for unknown provider', () => {
    expect(() => getModel('unknown' as any, 'some-model', {})).toThrowError(
      'Unknown provider',
    );
  });

  it('apiKey is passed explicitly to anthropic factory — not read from env', () => {
    getModel('anthropic', 'claude-3-haiku-20240307', {
      apiKey: 'explicit-key',
    });
    expect(createAnthropic).toHaveBeenCalledWith({ apiKey: 'explicit-key' });
  });

  it('apiKey is passed explicitly to openai factory', () => {
    getModel('openai', 'gpt-4o-mini', { apiKey: 'my-openai-key' });
    expect(createOpenAI).toHaveBeenCalledWith({ apiKey: 'my-openai-key' });
  });

  it('apiKey is passed explicitly to google factory', () => {
    getModel('google', 'gemini-2.0-flash', { apiKey: 'my-google-key' });
    expect(createGoogleGenerativeAI).toHaveBeenCalledWith({
      apiKey: 'my-google-key',
    });
  });

  it('apiKey is passed explicitly to openrouter factory', () => {
    getModel('openrouter', 'meta-llama/llama-3.1-8b-instruct:free', {
      apiKey: 'my-openrouter-key',
    });
    expect(createOpenRouter).toHaveBeenCalledWith({
      apiKey: 'my-openrouter-key',
    });
  });

  it('ollama uses custom baseURL when provided', () => {
    getModel('ollama', 'llama3.2', {
      baseUrl: 'http://custom-host:11434/api',
    });
    expect(createOllama).toHaveBeenCalledWith({
      baseURL: 'http://custom-host:11434/api',
    });
  });

  it('ollama uses default baseURL when no baseUrl in config', () => {
    getModel('ollama', 'llama3.2', {});
    expect(createOllama).toHaveBeenCalledWith({
      baseURL: 'http://localhost:11434/api',
    });
  });
});

describe('streamLLM', () => {
  it('calls streamText with correct parameters', async () => {
    const mockStreamResult = { textStream: [], text: Promise.resolve('') };
    vi.mocked(streamText).mockReturnValue(mockStreamResult as any);

    const request = {
      provider: 'anthropic' as const,
      model: 'claude-3-haiku-20240307',
      config: { apiKey: 'test-key' },
      system: 'You are a helpful assistant',
      messages: [{ role: 'user' as const, content: 'Hello' }],
      temperature: 0.8,
      abortSignal: new AbortController().signal,
    };

    streamLLM(request);

    expect(streamText).toHaveBeenCalledOnce();
    const callArgs = vi.mocked(streamText).mock.calls[0][0];
    expect(callArgs.model).toBeDefined();
    expect(callArgs.system).toBe('You are a helpful assistant');
    expect(callArgs.messages).toEqual([{ role: 'user', content: 'Hello' }]);
    expect(callArgs.temperature).toBe(0.8);
    expect(callArgs.abortSignal).toBeDefined();
  });

  it('defaults temperature to 0.7 when not provided', () => {
    vi.mocked(streamText).mockReturnValue({
      textStream: [],
      text: Promise.resolve(''),
    } as any);

    streamLLM({
      provider: 'anthropic',
      model: 'claude-3-haiku-20240307',
      config: { apiKey: 'test-key' },
      messages: [{ role: 'user', content: 'Hello' }],
    });

    const callArgs = vi.mocked(streamText).mock.calls[0][0];
    expect(callArgs.temperature).toBe(0.7);
  });
});

describe('generateLLM', () => {
  it('calls generateText with correct parameters and returns text', async () => {
    vi.mocked(generateText).mockResolvedValue({
      text: 'Hello, World!',
    } as any);

    const request = {
      provider: 'openai' as const,
      model: 'gpt-4o-mini',
      config: { apiKey: 'test-key' },
      system: 'You are a coder',
      messages: [{ role: 'user' as const, content: 'Write hello world' }],
      temperature: 0.3,
    };

    const result = await generateLLM(request);

    expect(generateText).toHaveBeenCalledOnce();
    const callArgs = vi.mocked(generateText).mock.calls[0][0];
    expect(callArgs.model).toBeDefined();
    expect(callArgs.system).toBe('You are a coder');
    expect(callArgs.messages).toEqual([
      { role: 'user', content: 'Write hello world' },
    ]);
    expect(callArgs.temperature).toBe(0.3);
    expect(result).toBe('Hello, World!');
  });

  it('defaults temperature to 0.7 when not provided', async () => {
    vi.mocked(generateText).mockResolvedValue({ text: 'ok' } as any);

    await generateLLM({
      provider: 'anthropic',
      model: 'claude-3-haiku-20240307',
      config: { apiKey: 'test-key' },
      messages: [{ role: 'user', content: 'test' }],
    });

    const callArgs = vi.mocked(generateText).mock.calls[0][0];
    expect(callArgs.temperature).toBe(0.7);
  });
});
