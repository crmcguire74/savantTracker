import type { ModuleProps } from '@sdk'
import { WorkView } from './WorkView'

export default function WorkModule({ location }: ModuleProps) {
  return <WorkView person={location.params.person} />
}
