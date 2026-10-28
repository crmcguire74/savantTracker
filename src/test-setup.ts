import 'fake-indexeddb/auto'

// jsdom has no structuredClone before Node's global leaks in; the memory
// adapter relies on it for value isolation.
if (typeof globalThis.structuredClone !== 'function') {
  globalThis.structuredClone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T
}
