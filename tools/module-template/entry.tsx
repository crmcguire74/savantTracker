import type { ModuleProps } from '@sdk'
import { __COMPONENT__View } from './__COMPONENT__View'

export default function __COMPONENT__Module({ location }: ModuleProps) {
  return <__COMPONENT__View filter={location.params.filter} />
}
