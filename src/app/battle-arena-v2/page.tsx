'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

export default function BattleArenaV2Page() {
  const searchParams = useSearchParams();

  useEffect(() => {
    // Build the URL with query params preserved
    const params = searchParams.toString();
    const url = `/battle-arena-v2/index.html${params ? `?${params}` : ''}`;
    window.location.replace(url);
  }, [searchParams]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-black">
      <div className="text-white text-xl">Loading Battle Arena...</div>
    </div>
  );
}

