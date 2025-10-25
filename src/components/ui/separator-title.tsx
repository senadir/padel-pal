import * as React from 'react'
import * as SeparatorPrimitive from '@radix-ui/react-separator'

import { cn } from '@/lib/utils'

type SeparatorWithTitleProps = {
  title?: string
  leftTitle?: string
  rightTitle?: string
  titlePosition?: 'center' | 'left' | 'right'
  className?: string
} & React.ComponentProps<typeof SeparatorPrimitive.Root>

/**
 * SeparatorWithTitle now supports:
 * - `title` and `titlePosition`: For a single label at center, left, or right (backwards-compatible)
 * - `leftTitle` and `rightTitle`: To place a label pinned left and/or right (will override conflicting `title`)
 */
function SeparatorWithTitle({
  className,
  decorative = true,
  title,
  leftTitle,
  rightTitle,
  titlePosition = 'center',
  ...props
}: SeparatorWithTitleProps) {
  // Only horizontal separator supported.
  return (
    <div
      className={cn('relative w-full flex items-center h-8', className)}
      data-slot="separator-with-title"
    >
      <SeparatorPrimitive.Root
        decorative={decorative}
        orientation="horizontal"
        className={cn('bg-border shrink-0 h-px w-full')}
        {...props}
      />
      {/* If left/right titles provided, show them. Otherwise, fallback to legacy title+titlePosition */}
      {leftTitle || rightTitle ? (
        <>
          {leftTitle && (
            <span
              className={cn(
                'absolute left-0 top-1/2 -translate-y-1/2 pr-2 text-xs text-muted-foreground font-semibold select-none whitespace-nowrap bg-background uppercase',
              )}
              data-slot="separator-title-left"
            >
              {leftTitle}
            </span>
          )}
          {rightTitle && (
            <span
              className={cn(
                'absolute right-0 top-1/2 -translate-y-1/2 pl-2 text-xs text-muted-foreground font-semibold select-none whitespace-nowrap bg-background uppercase',
              )}
              data-slot="separator-title-right"
            >
              {rightTitle}
            </span>
          )}
        </>
      ) : (
        title && (
          <span
            className={cn(
              'absolute text-xs text-muted-foreground font-semibold select-none whitespace-nowrap bg-background uppercase',
              titlePosition === 'center' &&
                'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 px-2',
              titlePosition === 'left' &&
                'left-0 top-1/2 -translate-y-1/2 pr-2',
              titlePosition === 'right' &&
                'right-0 top-1/2 -translate-y-1/2 pl-2',
            )}
            data-slot="separator-title"
          >
            {title}
          </span>
        )
      )}
    </div>
  )
}

export { SeparatorWithTitle }
