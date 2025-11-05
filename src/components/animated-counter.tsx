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
    return <span>{value}</span>
  }

  return (
    <NumberFlow
      value={value}
      locales="en-US"
      animated
      isolate
      willChange
      opacityTiming={{
        duration: 200,
        easing: 'ease-out',
      }}
      transformTiming={{
        duration: 350,
        easing: 'ease-out',
      }}
    />
  )
}
