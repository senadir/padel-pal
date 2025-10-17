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
import { Field, FieldLabel } from '@/components/ui/field'

export function DatePicker({
  label,
  value,
  setValue,
}: {
  label: string
  value: Date
  setValue: (value: Date) => void
}) {
  const [open, setOpen] = React.useState(false)
  return (
    <Field className="flex flex-col gap-3">
      <FieldLabel htmlFor="date">{label}</FieldLabel>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            id="date"
            className="w-full justify-between font-normal"
          >
            {value ? value.toLocaleDateString() : 'Select date'}
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
    </Field>
  )
}
