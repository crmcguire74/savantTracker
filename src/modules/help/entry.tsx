import type { ModuleProps } from '@sdk'
import { HelpView } from './HelpView'

export default function HelpModule({ location }: ModuleProps) {
  return <HelpView location={location} />
}
