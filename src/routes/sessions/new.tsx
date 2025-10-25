import { createFileRoute, useRouter } from '@tanstack/react-router'
import { addMinutes, format, isAfter, parse } from 'date-fns'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
  FieldTitle,
} from '@/components/ui/field'

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { DatePicker } from '@/components/ui/date-picker'
import { Checkbox } from '@/components/ui/checkbox'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { formOptions, useForm } from '@tanstack/react-form'
import { createSession, createSessionValidator } from '@/utils/sessions'
import type { SessionForm } from '@/utils/types'

const defaultSession: SessionForm = {
  venueName: '',
  venueLocation: '',
  date: new Date(new Date().setDate(new Date().getDate() + 7)),
  time: parse('16:00', 'HH:mm', new Date()),
  levels: ['beginner', 'improver', 'intermediate'],
  timeBlocks: '60',
  timeSlots: [
    {
      id: '16:00-17:00',
      range: [
        parse('16:00', 'HH:mm', new Date()),
        parse('17:00', 'HH:mm', new Date()),
      ],
    },
    {
      id: '17:00-18:00',
      range: [
        parse('17:00', 'HH:mm', new Date()),
        parse('18:00', 'HH:mm', new Date()),
      ],
    },
    {
      id: '18:00-19:00',
      range: [
        parse('18:00', 'HH:mm', new Date()),
        parse('19:00', 'HH:mm', new Date()),
      ],
    },
  ],
  limitPlayers: false,
  playersPerSlot: 4,
}

export const Route = createFileRoute('/sessions/new')({
  component: NewSession,
  head: () => ({
    meta: [
      {
        title: 'Create a new session',
      },
    ],
  }),
})

function NewSession() {
  const router = useRouter()
  const sessionFormOptions = formOptions({
    defaultValues: defaultSession,
    validators: {
      onSubmit: createSessionValidator,
    },
    onSubmit: async ({ value }) => {
      try {
        const sessionId = await createSession({ data: value })

        // TODO: Navigae to the session page or sessions list
        router.navigate({
          to: '/sessions/$id',
          params: { id: sessionId },
        })
      } catch (error) {
        console.error('Error creating session:', error)

        // Show error toast
        const errorMessage =
          error instanceof Error
            ? error.message
            : 'An unexpected error occurred'
        toast.error('Failed to create session', {
          description: errorMessage,
        })

        // Re-throw the error to prevent form submission success
        throw error
      }
    },
  })
  const form = useForm(sessionFormOptions)

  // Generate time slots based on session time and time blocks
  const generateTimeSlots = (time: Date, timeBlocks: number) => {
    const slots: SessionForm['timeSlots'] = []

    // Set the maximum end time to 11:00 PM
    const maxEndTime = parse('23:00', 'HH:mm', new Date())
    let currentTime = time

    // Generate slots until 11 PM
    while (true) {
      const endTime = addMinutes(currentTime, timeBlocks)

      // Check if end time would go beyond 11 PM
      if (isAfter(endTime, maxEndTime)) {
        break
      }

      slots.push({
        id: format(currentTime, 'HH:mm') + '-' + format(endTime, 'HH:mm'),
        range: [currentTime, endTime],
      })
      currentTime = addMinutes(currentTime, timeBlocks)
    }

    return slots
  }
  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={async (e) => {
        e.preventDefault()
        e.stopPropagation()
        await form.handleSubmit()
      }}
    >
      <FieldSet>
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold">Create a new session</h1>
          <FieldLegend className="text-muted-foreground text-sm text-balance">
            Fill in the form below to create a new session
          </FieldLegend>
        </div>
        <form.Field
          name="venueName"
          children={(field) => {
            const isInvalid =
              field.state.meta.isTouched && !field.state.meta.isValid
            return (
              <Field data-invalid={isInvalid}>
                <FieldLabel htmlFor={field.name}>Venue Name</FieldLabel>
                <Input
                  id={field.name}
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  aria-invalid={isInvalid}
                  placeholder="Aurial Pàdel Cornellà"
                />
                {isInvalid && <FieldError errors={field.state.meta.errors} />}
              </Field>
            )
          }}
        />
        <form.Field
          name="venueLocation"
          children={(field) => {
            const isInvalid =
              field.state.meta.isTouched && !field.state.meta.isValid
            return (
              <Field data-invalid={isInvalid}>
                <FieldLabel htmlFor={field.name}>Venue Location</FieldLabel>
                <Input
                  id={field.name}
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  aria-invalid={isInvalid}
                  placeholder="https://maps.app.goo.gl/1234567890"
                />
                {isInvalid && <FieldError errors={field.state.meta.errors} />}
              </Field>
            )
          }}
        />
        <FieldGroup className="grid grid-cols-2 gap-3">
          <form.Field
            name="date"
            children={(field) => {
              const isInvalid =
                field.state.meta.isTouched && !field.state.meta.isValid
              return (
                <Field data-invalid={isInvalid}>
                  <FieldLabel htmlFor={field.name}>Session Date</FieldLabel>
                  <DatePicker
                    label="Select date"
                    value={field.state.value}
                    setValue={(value) => field.handleChange(value)}
                    ariaInvalid={isInvalid}
                  />
                  {isInvalid && <FieldError errors={field.state.meta.errors} />}
                </Field>
              )
            }}
          />
          <form.Field
            name="time"
            children={(field) => {
              const isInvalid =
                field.state.meta.isTouched && !field.state.meta.isValid
              return (
                <Field data-invalid={isInvalid}>
                  <FieldLabel htmlFor={field.name}>Session Time</FieldLabel>
                  <Input
                    type="time"
                    id={field.name}
                    min="07:00"
                    max="21:00"
                    step="1800"
                    value={format(field.state.value, 'HH:mm')}
                    aria-invalid={isInvalid}
                    onChange={(e) => {
                      const parsedTime = parse(
                        e.target.value,
                        'HH:mm',
                        new Date(),
                      )
                      // Only proceed if the parsed time is a valid Date
                      if (!isNaN(parsedTime.getTime())) {
                        // Round up to the nearest half hour
                        let minutes = parsedTime.getMinutes()
                        let hours = parsedTime.getHours()
                        if (minutes > 0 && minutes <= 30) {
                          minutes = 30
                        } else if (minutes > 30) {
                          hours += 1
                          minutes = 0
                        }
                        const roundedTime = new Date(parsedTime)
                        roundedTime.setHours(hours)
                        roundedTime.setMinutes(minutes)
                        field.handleChange(roundedTime)
                      }
                    }}
                    className="bg-background appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
                  />
                  {isInvalid && <FieldError errors={field.state.meta.errors} />}
                </Field>
              )
            }}
          />
        </FieldGroup>
        <FieldSeparator />
        <form.Field
          name="timeBlocks"
          children={(field) => {
            const isInvalid =
              field.state.meta.isTouched && !field.state.meta.isValid
            return (
              <Field data-invalid={isInvalid}>
                <FieldLabel htmlFor={field.name}>Time Blocks</FieldLabel>
                <ToggleGroup
                  id={field.name}
                  type="single"
                  className="w-full"
                  variant="outline"
                  size="lg"
                  value={field.state.value}
                  onValueChange={(value) => {
                    if (value) {
                      field.handleChange(value)
                      // Clear up selected timeSlots when this happens
                      field.form.setFieldValue?.('timeSlots', [])
                    }
                  }}
                  aria-invalid={isInvalid}
                >
                  <ToggleGroupItem value="60">60 minutes</ToggleGroupItem>
                  <ToggleGroupItem value="90">90 minutes</ToggleGroupItem>
                </ToggleGroup>
                {isInvalid && <FieldError errors={field.state.meta.errors} />}
                <FieldDescription>
                  Select the duration of the games.
                </FieldDescription>
              </Field>
            )
          }}
        />
        <form.Field
          name="levels"
          mode="array"
          children={(field) => {
            const isInvalid =
              field.state.meta.isTouched && !field.state.meta.isValid
            const levelOptions = [
              {
                value: 'beginner',
                label: 'Beginner',
                description: 'New to padel or learning the basics.',
              },
              {
                value: 'improver',
                label: 'Improver',
                description: 'Basic skills developed, ready to improve.',
              },
              {
                value: 'intermediate',
                label: 'Intermediate',
                description: 'Solid technique and game understanding.',
              },
              {
                value: 'advanced',
                label: 'Advanced',
                description: 'High-level play with advanced techniques.',
              },
            ]
            return (
              <FieldGroup data-invalid={isInvalid}>
                <FieldLabel htmlFor="levels">Available Levels</FieldLabel>
                <FieldDescription>
                  Select the set of levels available for the session.
                </FieldDescription>
                <div className="flex flex-col gap-3">
                  {levelOptions.map((option) => (
                    <FieldLabel
                      htmlFor={`level-${option.value}`}
                      key={option.value}
                    >
                      <Field orientation="horizontal" data-invalid={isInvalid}>
                        <FieldContent>
                          <FieldTitle>{option.label}</FieldTitle>
                          <FieldDescription>
                            {option.description}
                          </FieldDescription>
                        </FieldContent>
                        <Checkbox
                          id={`level-${option.value}`}
                          aria-invalid={isInvalid}
                          checked={field.state.value.includes(option.value)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              field.handleChange([
                                ...field.state.value,
                                option.value,
                              ])
                            } else {
                              field.handleChange(
                                field.state.value.filter(
                                  (val: string) => val !== option.value,
                                ),
                              )
                            }
                          }}
                        />
                      </Field>
                    </FieldLabel>
                  ))}
                </div>
                {isInvalid && <FieldError errors={field.state.meta.errors} />}
              </FieldGroup>
            )
          }}
        />
        <form.Subscribe
          selector={(state) => ({
            time: state.values.time,
            timeBlocks: state.values.timeBlocks,
          })}
          children={({ time, timeBlocks }) => (
            <form.Field
              name="timeSlots"
              mode="array"
              children={(field) => {
                const isInvalid =
                  field.state.meta.isTouched && !field.state.meta.isValid
                const timeSlotOptions = generateTimeSlots(
                  time,
                  parseInt(timeBlocks),
                )
                return (
                  <FieldGroup data-invalid={isInvalid}>
                    <FieldLabel htmlFor="time-slots">
                      Available Time Slots
                    </FieldLabel>
                    <FieldDescription>
                      Select the time slots available for the session.
                    </FieldDescription>
                    <div className="grid grid-cols-2 gap-3">
                      {timeSlotOptions.map(({ id, range }) => (
                        <FieldLabel key={id} htmlFor={`slot-${id}`}>
                          <Field
                            orientation="horizontal"
                            data-invalid={isInvalid}
                          >
                            <FieldContent>
                              <FieldTitle>{id}</FieldTitle>
                            </FieldContent>
                            <Checkbox
                              aria-invalid={isInvalid}
                              id={`slot-${id}`}
                              checked={field.state.value.some(
                                (timeSlot: { id: string }) =>
                                  timeSlot.id === id,
                              )}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  field.handleChange([
                                    ...field.state.value,
                                    { id, range },
                                  ])
                                } else {
                                  field.handleChange(
                                    field.state.value.filter(
                                      (timeSlot: { id: string }) =>
                                        timeSlot.id !== id,
                                    ),
                                  )
                                }
                              }}
                            />
                          </Field>
                        </FieldLabel>
                      ))}
                    </div>
                    {isInvalid && (
                      <FieldError errors={field.state.meta.errors} />
                    )}
                  </FieldGroup>
                )
              }}
            />
          )}
        />
        <form.Field name="limitPlayers">
          {(limitPlayersField) => (
            <>
              <Field orientation="horizontal">
                <Checkbox
                  id="limit-players"
                  checked={limitPlayersField.state.value}
                  onCheckedChange={(checked) =>
                    limitPlayersField.handleChange(!!checked)
                  }
                />
                <FieldContent>
                  <FieldLabel htmlFor="limit-players">
                    Limit players per slot
                  </FieldLabel>
                  <FieldDescription>
                    Limit the number of players who can sign up for a time slot
                    before closing it.
                  </FieldDescription>
                </FieldContent>
              </Field>
              {limitPlayersField.state.value && (
                <form.Field name="playersPerSlot">
                  {(field) => (
                    <Field
                      data-invalid={
                        field.state.meta.isTouched && !field.state.meta.isValid
                      }
                    >
                      <FieldLabel htmlFor="players-per-slot">
                        Players per slot
                      </FieldLabel>
                      <Input
                        id="players-per-slot"
                        placeholder="4"
                        type="number"
                        min={1}
                        value={field.state.value}
                        onChange={(e) =>
                          field.handleChange(parseInt(e.target.value))
                        }
                        aria-invalid={
                          field.state.meta.isTouched &&
                          !field.state.meta.isValid
                        }
                      />
                      {field.state.meta.isTouched &&
                        !field.state.meta.isValid && (
                          <FieldError errors={field.state.meta.errors} />
                        )}
                    </Field>
                  )}
                </form.Field>
              )}
            </>
          )}
        </form.Field>
        <form.Subscribe
          selector={(state) => {
            console.log('Submitting:', state.isSubmitting)
            return { isSubmitting: state.isSubmitting }
          }}
          children={({ isSubmitting }) => (
            <Field>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {isSubmitting ? 'Creating session...' : 'Create a session'}
              </Button>
              <Dialog>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    type="button"
                    className="w-full"
                    disabled={isSubmitting}
                  >
                    Save as a template
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>Save as a template</DialogTitle>
                    <DialogDescription>
                      Saving a session as a template will save all of your
                      selections except the date.
                    </DialogDescription>
                  </DialogHeader>
                  <FieldGroup>
                    <Field>
                      <FieldLabel htmlFor="template-name">Name</FieldLabel>
                      <Input
                        id="template-name"
                        name="name"
                        autoComplete="off"
                      />
                    </Field>
                  </FieldGroup>
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button variant="outline">Cancel</Button>
                    </DialogClose>
                    <Button type="submit">Save template</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </Field>
          )}
        />
      </FieldSet>
    </form>
  )
}
