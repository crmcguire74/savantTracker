import type { ModuleProps } from '@sdk'
import { ReportPreview } from './ReportPreview'

export default function OnePagerModule({ location }: ModuleProps) {
  return <ReportPreview pillar={location.params.pillar} />
}
