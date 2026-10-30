import type { ModuleProps } from '@sdk'
import { PortfolioView } from './PortfolioView'
import { portfolioLayout } from './routes'

export default function PortfolioModule({ location }: ModuleProps) {
  return <PortfolioView layout={portfolioLayout(location)} pillar={location.params.pillar} initiative={location.params.initiative} />
}
