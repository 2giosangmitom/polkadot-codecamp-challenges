import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { LunoKitProvider } from '@luno-kit/ui'
import { createConfig } from '@luno-kit/react'
import { 
  westend, 
  westendAssetHub,
  polkadot, 
  polkadotAssetHub,
  kusama,
  kusamaAssetHub,
  paseo,
  paseoAssetHub
} from '@luno-kit/react/chains'
import { 
  polkadotjsConnector, 
  subwalletConnector, 
  talismanConnector 
} from '@luno-kit/react/connectors'
import '@luno-kit/ui/styles.css'
import App from './App.tsx'
import './index.css'

// Create LunoKit config with Asset Hub chains for staking
const lunoConfig = createConfig({
  appName: 'Nomination Staking Agent',
  chains: [
    // Testnets (recommended for testing)
    westendAssetHub,
    westend,
    paseoAssetHub,
    paseo,
    // Mainnets
    polkadotAssetHub,
    polkadot,
    kusamaAssetHub,
    kusama,
  ],
  connectors: [
    polkadotjsConnector(),
    subwalletConnector(),
    talismanConnector(),
  ],
})

// Create React Query client
const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <LunoKitProvider config={lunoConfig}>
        <App />
      </LunoKitProvider>
    </QueryClientProvider>
  </StrictMode>,
)
