import { createServerFn } from '@tanstack/react-start'
import { parsePhoneNumberFromString } from 'libphonenumber-js'
import type { PlaytomicProfile } from './types'
import { withSentry } from './sentry'

export const searchPlaytomicByEmail = createServerFn({
  method: 'POST',
})
  .inputValidator((d: { email: string }) => d)
  .handler(
    withSentry(async ({ data }) => {
      const response = await fetch(
        `https://api.playtomic.io/v2/users?email=${encodeURIComponent(data.email)}`,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        },
      )

      if (!response.ok) {
        console.error(
          'Playtomic API error:',
          response.status,
          response.statusText,
        )
        return null
      }

      const responseData = (await response.json()) as PlaytomicProfile[]
      return responseData[0] || null
    }),
  )

export const searchPlaytomicByPhone = createServerFn({
  method: 'POST',
})
  .inputValidator((d: { phone: string }) => d)
  .handler(
    withSentry(async ({ data }) => {
      const { phone } = data
      // Ensure phone always starts with "+" before parsing
      let phoneWithPlus = phone.startsWith('+') ? phone : `+${phone}`
      const parsedPhone = parsePhoneNumberFromString(phoneWithPlus)

      if (!parsedPhone) {
        throw new Error('Invalid phone number')
      }
      // Playtomic requires a space between the country calling code and the national number.
      const playtomicPhone = `+${parsedPhone.countryCallingCode} ${parsedPhone.nationalNumber}`
      const response = await fetch(
        `https://api.playtomic.io/v2/users?phone=${encodeURIComponent(playtomicPhone)}`,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        },
      )

      if (!response.ok) {
        console.error(
          'Playtomic API error:',
          response.status,
          response.statusText,
        )
        return null
      }

      const responseData = (await response.json()) as PlaytomicProfile[]
      return responseData[0] || null
    }),
  )
