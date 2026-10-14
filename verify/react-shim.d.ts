// ⚠️ Verification-only type shims.
//
// This session's environment blocks the npm registry, so `@types/react` could
// not be installed to typecheck the port. These loose declarations let `tsc`
// check every line of application code (domain types, storage contract,
// repository, rollups, props flowing between components) while treating the
// React API surface as `any`.
//
// Delete this folder after running `npm install` on a machine with registry
// access: the real @types/react is strictly better.

declare module 'react' {
  export type ReactNode = any
  export type CSSProperties = any
  export type ChangeEvent<T = any> = any
  export type MouseEvent<T = any> = any
  export type KeyboardEvent<T = any> = any
  export type FC<P = any> = (props: P) => any
  export const StrictMode: any
  export function useState<S>(initial: S | (() => S)): [S, (value: S | ((prev: S) => S)) => void]
  export function useEffect(effect: () => void | (() => void), deps?: readonly unknown[]): void
  export function useCallback<T>(fn: T, deps: readonly unknown[]): T
  export function useMemo<T>(factory: () => T, deps: readonly unknown[]): T
  export function useRef<T>(initial: T): { current: T }
  const React: any
  export default React
}

declare module 'react/jsx-runtime' {
  export const jsx: any
  export const jsxs: any
  export const Fragment: any
}

declare module 'react-dom/client' {
  export function createRoot(container: any): { render(node: any): void }
}

declare module 'react-dom/server' {
  export function renderToString(node: any): string
}

declare namespace React {
  type ReactNode = any
  type CSSProperties = any
  type ChangeEvent<T = any> = any
  type MouseEvent<T = any> = any
  type KeyboardEvent<T = any> = any
  type HTMLInputElement = any
}

declare namespace JSX {
  interface Element {
    [key: string]: any
  }
  interface ElementClass {
    render: any
  }
  interface IntrinsicElements {
    [tag: string]: any
  }
  interface IntrinsicAttributes {
    key?: any
  }
}

interface ImportMeta {
  env?: Record<string, string>
}

declare module '*.css'

declare module 'vitest' {
  export const describe: any
  export const it: any
  export const expect: any
  export const beforeEach: any
  export const afterEach: any
  export const vi: any
}

declare module 'vitest/config' {
  export function defineConfig(config: any): any
}

declare module 'fake-indexeddb/auto'
