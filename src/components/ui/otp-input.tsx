import * as React from 'react'
import { cn } from '@/lib/utils'

export interface OTPInputProps {
  value: string
  onChange: (value: string) => void
  length?: number
  className?: string
  disabled?: boolean
}

const OTPInput = React.forwardRef<HTMLDivElement, OTPInputProps>(
  ({ value, onChange, length = 6, className, disabled, ...props }, ref) => {
    const inputRefs = React.useRef<Array<HTMLInputElement | null>>([])

    const handleChange = (index: number, inputValue: string) => {
      if (inputValue.length > 1) return // Prevent multiple characters

      const newValue = value.split('')
      newValue[index] = inputValue
      const updatedValue = newValue.join('').slice(0, length)
      onChange(updatedValue)

      // Auto-focus next input
      if (inputValue && index < length - 1) {
        inputRefs.current[index + 1]?.focus()
      }
    }

    const handleKeyDown = (
      index: number,
      e: React.KeyboardEvent<HTMLInputElement>,
    ) => {
      if (e.key === 'Backspace' && !value[index] && index > 0) {
        inputRefs.current[index - 1]?.focus()
      }
    }

    const handlePaste = (e: React.ClipboardEvent) => {
      e.preventDefault()
      const pastedData = e.clipboardData.getData('text').slice(0, length)
      onChange(pastedData)

      // Focus the last filled input or the first empty one
      const lastFilledIndex = Math.min(pastedData.length - 1, length - 1)
      inputRefs.current[lastFilledIndex]?.focus()
    }

    return (
      <div
        ref={ref}
        className={cn('flex gap-2', className)}
        onPaste={handlePaste}
        {...props}
      >
        {Array.from({ length }, (_, index) => (
          <input
            autoComplete="off"
            key={index}
            ref={(el) => {
              inputRefs.current[index] = el
            }}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={1}
            value={value[index] || ''}
            onChange={(e) => handleChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            disabled={disabled}
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-md border border-input bg-background text-center text-sm ring-offset-background transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              'disabled:cursor-not-allowed disabled:opacity-50',
              'placeholder:text-muted-foreground',
            )}
          />
        ))}
      </div>
    )
  },
)

OTPInput.displayName = 'OTPInput'

export { OTPInput }
