import { useRouterState } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

export function NavigationProgress() {
  const { isLoading, isTransitioning } = useRouterState({
    select: (state) => ({
      isLoading: state.isLoading,
      isTransitioning: state.isTransitioning,
    }),
  })
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    if (!isLoading && !isTransitioning) {
      // Complete the progress bar
      setProgress(100)
      // Reset after animation completes
      const timeout = setTimeout(() => setProgress(0), 300)
      return () => clearTimeout(timeout)
    }

    // Start at 0 when navigation begins
    setProgress(0)

    // Simulate progress
    const intervals: Array<number> = []

    // Quick start: 0 -> 50% in 200ms
    intervals.push(
      window.setTimeout(() => setProgress(50), 100) as unknown as number,
    )

    // Slow middle: 50% -> 80% in 800ms
    intervals.push(
      window.setTimeout(() => setProgress(70), 300) as unknown as number,
    )
    intervals.push(
      window.setTimeout(() => setProgress(80), 600) as unknown as number,
    )

    // Very slow end: 80% -> 90% in 1s (waiting for actual completion)
    intervals.push(
      window.setTimeout(() => setProgress(90), 1200) as unknown as number,
    )

    return () => {
      intervals.forEach(clearTimeout)
    }
  }, [isLoading, isTransitioning])

  if (progress === 0 && !isLoading && !isTransitioning) return null

  const style: React.CSSProperties = {
    transform: `scaleX(${progress / 100})`,
    opacity: progress === 100 ? 0 : 1,
    viewTransitionName: 'none',
  }

  return (
    <div
      className="fixed top-0 left-0 right-0 z-50 h-px bg-primary transition-all duration-300 ease-out origin-left shadow-[0_0_10px_var(--primary)]"
      style={style}
    />
  )
}
