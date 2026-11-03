export declare const CAPTURE_FORMAT: 'monday-capture'
export declare const CAPTURE_VERSION: 1
export declare class CaptureError extends Error {}
export interface MondayCapture {
  format: 'monday-capture'
  version: 1
  capturedAt?: string
  workspaceId?: string
  folders: Array<{ id: string; name: string; parent?: { id: string } | null; children?: Array<{ id: string; name: string }> }>
  boards: Array<{ id: string; name: string; columns: Array<{ id: string; title: string; type: string }>; items: unknown[] }>
}
export declare function validateCapture(capture: unknown): MondayCapture
export declare function describeCapture(capture: MondayCapture): {
  capturedAt: string
  workspaceId: string
  folders: number
  boards: number
  items: number
}
