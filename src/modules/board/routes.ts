// 🧭 The board module's URL: `#/board?layout=status`; phase is the default.

import type { Location } from '@sdk'

export type BoardLayout = 'phase' | 'status'

export const boardLayout = (location: Location): BoardLayout => (location.params.layout === 'status' ? 'status' : 'phase')
