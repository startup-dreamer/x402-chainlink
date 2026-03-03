import { describe, it, expect, beforeEach } from 'vitest';
import {
  ExtensionRegistry,
  globalRegistry,
  createExtensionRegistry,
} from '../../src/extensions/registry.js';

describe('ExtensionRegistry', () => {
  let registry: ExtensionRegistry;

  beforeEach(() => {
    registry = new ExtensionRegistry();
  });

  describe('register / has / get', () => {
    it('registers an extension and can retrieve it', () => {
      registry.register({ name: 'my-ext', description: 'test extension' });
      expect(registry.has('my-ext')).toBe(true);
      const ext = registry.get('my-ext');
      expect(ext).toBeDefined();
      expect(ext!.name).toBe('my-ext');
    });

    it('throws when registering duplicate name', () => {
      registry.register({ name: 'dup' });
      expect(() => registry.register({ name: 'dup' })).toThrow();
    });

    it('throws when registering extension without a name', () => {
      expect(() => registry.register({ name: '' } as never)).toThrow();
    });

    it('stores a copy of the extension (not the same reference)', () => {
      const ext = { name: 'copy-test', description: 'original' };
      registry.register(ext);
      const stored = registry.get('copy-test');
      expect(stored).not.toBe(ext);
      expect(stored!.description).toBe('original');
    });
  });

  describe('getNames', () => {
    it('returns empty array when no extensions registered', () => {
      expect(registry.getNames()).toEqual([]);
    });

    it('returns names of all registered extensions', () => {
      registry.register({ name: 'ext-a' });
      registry.register({ name: 'ext-b' });
      registry.register({ name: 'ext-c' });
      const names = registry.getNames();
      expect(names).toContain('ext-a');
      expect(names).toContain('ext-b');
      expect(names).toContain('ext-c');
      expect(names).toHaveLength(3);
    });
  });

  describe('unregister', () => {
    it('removes a registered extension', () => {
      registry.register({ name: 'to-remove' });
      expect(registry.unregister('to-remove')).toBe(true);
      expect(registry.has('to-remove')).toBe(false);
    });

    it('returns false when extension not found', () => {
      expect(registry.unregister('nonexistent')).toBe(false);
    });
  });

  describe('clear', () => {
    it('removes all registered extensions', () => {
      registry.register({ name: 'a' });
      registry.register({ name: 'b' });
      registry.clear();
      expect(registry.getNames()).toEqual([]);
      expect(registry.has('a')).toBe(false);
    });
  });

  describe('validate', () => {
    it('returns {valid:true} for extension without schema', () => {
      registry.register({ name: 'no-schema' });
      const result = registry.validate('no-schema', { anything: true });
      expect(result.valid).toBe(true);
    });

    it('returns {valid:false} for unregistered extension', () => {
      const result = registry.validate('not-registered', {});
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
    });

    it('validates string type constraint', () => {
      registry.register({
        name: 'typed',
        schema: { type: 'string' },
      });
      expect(registry.validate('typed', 'hello').valid).toBe(true);
      const fail = registry.validate('typed', 42);
      expect(fail.valid).toBe(false);
      expect(fail.errors![0]).toContain('string');
    });

    it('validates number type constraint', () => {
      registry.register({
        name: 'num-ext',
        schema: { type: 'number' },
      });
      expect(registry.validate('num-ext', 3.14).valid).toBe(true);
      expect(registry.validate('num-ext', 'not-a-number').valid).toBe(false);
    });

    it('validates required properties', () => {
      registry.register({
        name: 'req-ext',
        schema: {
          type: 'object',
          required: ['name', 'version'],
          properties: {
            name: { type: 'string' },
            version: { type: 'string' },
          },
        },
      });

      expect(registry.validate('req-ext', { name: 'foo', version: '1.0' }).valid).toBe(true);

      const missingVersion = registry.validate('req-ext', { name: 'foo' });
      expect(missingVersion.valid).toBe(false);
      expect(missingVersion.errors!.join(' ')).toContain('version');
    });

    it('validates enum constraint', () => {
      registry.register({
        name: 'enum-ext',
        schema: {
          type: 'string',
          enum: ['pdf', 'json', 'csv'],
        },
      });

      expect(registry.validate('enum-ext', 'pdf').valid).toBe(true);
      expect(registry.validate('enum-ext', 'xml').valid).toBe(false);
    });

    it('validates string minLength/maxLength', () => {
      registry.register({
        name: 'length-ext',
        schema: { type: 'string', minLength: 3, maxLength: 10 },
      });

      expect(registry.validate('length-ext', 'abc').valid).toBe(true);
      expect(registry.validate('length-ext', 'ab').valid).toBe(false);
      expect(registry.validate('length-ext', 'toolongstring').valid).toBe(false);
    });

    it('validates string pattern', () => {
      registry.register({
        name: 'pattern-ext',
        schema: { type: 'string', pattern: '^0x[0-9a-f]+$' },
      });

      expect(registry.validate('pattern-ext', '0xdeadbeef').valid).toBe(true);
      expect(registry.validate('pattern-ext', 'not-hex').valid).toBe(false);
    });

    it('validates number minimum/maximum', () => {
      registry.register({
        name: 'range-ext',
        schema: { type: 'number', minimum: 0, maximum: 100 },
      });

      expect(registry.validate('range-ext', 50).valid).toBe(true);
      expect(registry.validate('range-ext', -1).valid).toBe(false);
      expect(registry.validate('range-ext', 101).valid).toBe(false);
    });

    it('validates nested object properties', () => {
      registry.register({
        name: 'nested-ext',
        schema: {
          type: 'object',
          properties: {
            meta: {
              type: 'object',
              properties: {
                version: { type: 'number' },
              },
            },
          },
        },
      });

      expect(
        registry.validate('nested-ext', { meta: { version: 2 } }).valid
      ).toBe(true);

      const bad = registry.validate('nested-ext', { meta: { version: 'not-a-number' } });
      expect(bad.valid).toBe(false);
    });

    it('validates array items', () => {
      registry.register({
        name: 'array-ext',
        schema: {
          type: 'array',
          items: { type: 'string' },
        },
      });

      expect(registry.validate('array-ext', ['a', 'b']).valid).toBe(true);
      expect(registry.validate('array-ext', ['a', 2]).valid).toBe(false);
    });
  });
});

describe('globalRegistry', () => {
  it('is an instance of ExtensionRegistry', () => {
    expect(globalRegistry instanceof ExtensionRegistry).toBe(true);
  });

  it('is a singleton (same object on multiple imports)', async () => {
    const { globalRegistry: registry2 } = await import('../../src/extensions/registry.js');
    expect(globalRegistry).toBe(registry2);
  });
});

describe('createExtensionRegistry', () => {
  it('returns a new ExtensionRegistry instance', () => {
    const r1 = createExtensionRegistry();
    const r2 = createExtensionRegistry();
    expect(r1).not.toBe(r2);
    expect(r1 instanceof ExtensionRegistry).toBe(true);
  });

  it('new registry starts empty', () => {
    const registry = createExtensionRegistry();
    expect(registry.getNames()).toEqual([]);
  });
});
