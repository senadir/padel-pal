'use client'

import { useEffect, useState } from 'react'

interface AnimatedCounterProps {
  value: number
}

export function AnimatedCounter({ value }: AnimatedCounterProps) {
  const [NumberFlow, setNumberFlow] = useState<any>(null)

  useEffect(() => {
    // Dynamically import NumberFlow only on client side
    import('@number-flow/react').then((mod) => {
      setNumberFlow(() => mod.default)
    })
  }, [])

  // Fallback to static number during SSR or before client hydration
  if (!NumberFlow) {
    return (
      <span className="absolute bottom-8 left-1/2 -translate-x-1/2 text-lg font-semibold">
        {value}
      </span>
    )
  }

  return <NumberFlow locales="en-US" value={value} animated isolate />
}
