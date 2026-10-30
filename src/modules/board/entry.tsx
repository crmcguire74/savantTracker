import type { ModuleProps } from '@sdk'
import { BoardView } from './BoardView'
import { boardLayout } from './routes'

export default function BoardModule({ location }: ModuleProps) {
  return <BoardView layout={boardLayout(location)} />
}
