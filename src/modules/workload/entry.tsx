import type { ModuleProps } from '@sdk'
import { workloadLayout } from './routes'
import { WorkloadView } from './WorkloadView'

export default function WorkloadModule({ location }: ModuleProps) {
  return <WorkloadView layout={workloadLayout(location)} />
}
