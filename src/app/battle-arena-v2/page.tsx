import { redirect } from 'next/navigation'

export const metadata = {
  title: 'Battle Arena V2 | Sharp Siege',
  description: 'Battle Arena V2 - Multi-game tabbed interface',
}

export default function BattleArenaV2Page() {
  // Redirect to the static Vite-built HTML file
  redirect('/battle-arena-v2/index.html')
}

