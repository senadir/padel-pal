'use client'
import * as React from 'react'
import { ChevronDownIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

export function DatePicker({
  label,
  value,
  setValue,
  ariaInvalid,
}: {
  label: string
  value: Date
  setValue: (value: Date) => void
  ariaInvalid: boolean
}) {
  const [open, setOpen] = React.useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="w-full justify-between font-normal"
          aria-invalid={ariaInvalid}
        >
          {value ? value.toLocaleDateString() : label}
          <ChevronDownIcon />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto overflow-hidden p-0" align="start">
        <Calendar
          mode="single"
          selected={value}
          captionLayout="dropdown"
          disabled={{ before: new Date() }}
          onSelect={(date) => {
            setValue(date ?? value)
            setOpen(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}
