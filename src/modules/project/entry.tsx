import type { ModuleProps } from '@sdk'
import { ProjectView } from './ProjectView'

export default function ProjectModule({ location }: ModuleProps) {
  return <ProjectView id={location.id ?? ''} />
}
