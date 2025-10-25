import * as React from 'react'
import {
  usePhoneInput,
  CountryIso2,
  defaultCountries,
  parseCountry,
} from 'react-international-phone'
import { cn } from '@/lib/utils'
import { Input } from './input'
import { Popover, PopoverContent, PopoverTrigger } from './popover'
import { Button } from './button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from './command'
import { Check } from 'lucide-react'

// Convert country ISO2 code to flag emoji
const getFlagEmoji = (countryCode: string) => {
  return countryCode
    .toUpperCase()
    .split('')
    .map((char) => String.fromCodePoint(127397 + char.charCodeAt(0)))
    .join('')
}

interface InputPhoneNumberProps
  extends Omit<React.ComponentProps<'input'>, 'value' | 'onChange'> {
  value?: string
  onChange?: (phone: string) => void
  defaultCountry?: CountryIso2
}

export function InputPhoneNumber({
  className,
  value,
  onChange,
  defaultCountry = 'es',
  ...props
}: InputPhoneNumberProps) {
  const phoneInput = usePhoneInput({
    defaultCountry,
    value,
    onChange: (data) => {
      onChange?.(data.phone)
    },
  })

  const [open, setOpen] = React.useState(false)

  const countries = React.useMemo(
    () => defaultCountries.map((country) => parseCountry(country)),
    [],
  )

  return (
    <div className="flex gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="h-12 w-[60px] shrink-0 px-2"
          >
            <span className="text-xl leading-none">
              {getFlagEmoji(phoneInput.country.iso2)}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[280px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search country..." />
            <CommandList>
              <CommandEmpty>No country found.</CommandEmpty>
              <CommandGroup>
                {countries.map((country) => (
                  <CommandItem
                    key={country.iso2}
                    value={`${country.name} ${country.iso2} ${country.dialCode}`}
                    onSelect={() => {
                      phoneInput.setCountry(country.iso2)
                      setOpen(false)
                    }}
                  >
                    <span className="text-lg">
                      {getFlagEmoji(country.iso2)}
                    </span>
                    <span className="flex-1">{country.name}</span>
                    <span className="text-foreground">+{country.dialCode}</span>
                    <Check
                      className={cn(
                        'ml-2 h-4 w-4',
                        country.iso2 === phoneInput.country.iso2
                          ? 'opacity-100'
                          : 'opacity-0',
                      )}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <Input
        type="tel"
        placeholder="Phone number"
        value={phoneInput.inputValue}
        onChange={phoneInput.handlePhoneValueChange}
        ref={phoneInput.inputRef}
        className={className}
        {...props}
      />
    </div>
  )
}
