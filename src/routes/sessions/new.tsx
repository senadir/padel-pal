import { formOptions, useForm } from '@tanstack/react-form'
import { useQueryClient } from '@tanstack/react-query'
import {
  ClientOnly,
  createFileRoute,
  redirect,
  useRouter,
} from '@tanstack/react-router'
import { addMinutes, format, isAfter } from 'date-fns'
import { ChevronDown, ChevronsUpDown, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'
import { useState } from 'react'
import type { SessionForm } from '@/utils/types'
import { AnimatedCounter } from '@/components/ui/animated-counter'
import { PlaceSearchCombobox } from '@/components/place-search-combobox'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ButtonGroup } from '@/components/ui/button-group'
import { Checkbox } from '@/components/ui/checkbox'
import { DateTimePicker } from '@/components/ui/datetime-picker'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { createSession, createSessionValidator } from '@/utils/sessions'

const defaultSession: SessionForm = {
  venues: [
    {
      name: '',
      location: '',
      placeId: undefined,
      isPrimary: true,
    },
  ],
  date: (() => {
    const date = new Date()
    date.setDate(date.getDate() + 7)
    date.setHours(16, 0, 0, 0)
    return date
  })(),
  votingClosesAt: undefined,
  levels: [
    { level: 'beginner', timeSlots: [] },
    { level: 'improver', timeSlots: [] },
    { level: 'intermediate', timeSlots: [] },
    { level: 'advanced', timeSlots: [] },
  ],
  timeBlocks: '60',
  limitPlayers: false,
  playersPerSlot: 4,
}

export const Route = createFileRoute('/sessions/new')({
  beforeLoad: async ({ context, location }) => {
    const { authData } = context

    // Check if user is authenticated
    if (!authData?.user) {
      throw redirect({
        to: '/login',
        search: {
          redirect: location.href,
        },
      })
    }

    // Check if user is an organizer
    if (authData.role !== 'organizer') {
      throw redirect({
        to: '/',
        search: {
          error: 'unauthorized',
          message: 'Only organizers can create sessions',
        },
      })
    }
  },
  component: NewSession,
  head: () => ({
    meta: [
      {
        title: 'Create Session | Padel Pal',
      },
      {
        property: 'og:title',
        content: 'Create Session | Padel Pal',
      },
      {
        property: 'og:description',
        content: 'Create a new padel session and invite players to vote.',
      },
      {
        property: 'og:image',
        content:
          '/api/og?title=Create%20Session&subtitle=Organize%20a%20new%20padel%20session&type=session',
      },
      {
        name: 'twitter:title',
        content: 'Create Session | Padel Pal',
      },
      {
        name: 'twitter:description',
        content: 'Create a new padel session and invite players to vote.',
      },
      {
        name: 'twitter:image',
        content:
          '/api/og?title=Create%20Session&subtitle=Organize%20a%20new%20padel%20session&type=session',
      },
    ],
  }),
})

// Helper function to generate time slots (defined outside component)
const generateTimeSlots = (date: Date, timeBlocks: number) => {
  const slots: SessionForm['levels'][number]['timeSlots'] = []

  // Set the maximum end time to 11:00 PM on the same day as the input date
  const maxEndTime = new Date(date)
  maxEndTime.setHours(23, 0, 0, 0)

  let currentTime = new Date(date)

  // Generate slots until 11 PM
  while (true) {
    const endTime = addMinutes(currentTime, timeBlocks)

    // Check if end time would go beyond 11 PM
    if (isAfter(endTime, maxEndTime)) {
      break
    }

    slots.push({
      id: `${format(currentTime, 'HH:mm')} - ${format(endTime, 'HH:mm')}`,
      range: [new Date(currentTime), new Date(endTime)],
    })
    currentTime = endTime
  }

  // Sort slots by start time (they should already be sorted, but ensuring it)
  return slots.sort((a, b) => a.range[0].getTime() - b.range[0].getTime())
}

function NewSession() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [isCreating, setIsCreating] = useState(false)

  const sessionFormOptions = formOptions({
    defaultValues: defaultSession,
    validators: {
      onSubmit: createSessionValidator,
    },
  })
  const form = useForm(sessionFormOptions)

  // Handle session creation with specified status
  const handleCreateSession = async (
    status: 'draft' | 'voting',
  ): Promise<void> => {
    setIsCreating(true)
    try {
      // Validate form first
      await form.handleSubmit()

      // If validation passed, create session
      const formValues = form.state.values
      const sessionId = await createSession({
        data: { ...formValues, status },
      })

      // Invalidate venues query to refresh the list with the newly added venue
      await queryClient.invalidateQueries({ queryKey: ['venues'] })

      // Show success message only for drafts
      if (status === 'draft') {
        toast.success('Session saved as draft')
      }

      // Navigate to the session page
      router.navigate({
        to: '/sessions/$id',
        params: { id: sessionId },
      })
    } catch (error) {
      console.error('Error creating session:', error)

      // Show error toast
      const errorMessage =
        error instanceof Error ? error.message : 'An unexpected error occurred'
      toast.error('Failed to create session', {
        description: errorMessage,
      })
    } finally {
      setIsCreating(false)
    }
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
        <form.Subscribe selector={(state) => ({ venues: state.values.venues })}>
          {({ venues }) => (
            <Field>
              <FieldLabel htmlFor="venue">Venues</FieldLabel>
              <FieldDescription>
                Add the session venue and any additional venues needed.
              </FieldDescription>
              <div className="flex flex-col gap-3">
                {venues.map((venue, index) => (
                  <div key={index} className="flex gap-2 items-start relative">
                    <div className="flex-1">
                      <PlaceSearchCombobox
                        value={
                          venue.name
                            ? { name: venue.name, location: venue.location }
                            : undefined
                        }
                        onSelect={(place) => {
                          form.setFieldValue(
                            `venues[${index}].name`,
                            place.name,
                          )
                          form.setFieldValue(
                            `venues[${index}].location`,
                            place.location,
                          )
                          form.setFieldValue(
                            `venues[${index}].placeId`,
                            place.placeId,
                          )
                        }}
                        placeholder={
                          index === 0
                            ? 'Search for a venue...'
                            : 'Search for additional venue...'
                        }
                      />
                    </div>
                    {index > 0 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          const newVenues = venues.filter((_, i) => i !== index)
                          form.setFieldValue('venues', newVenues)
                        }}
                        className="absolute right-0 h-10 w-10"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  form.setFieldValue('venues', [
                    ...venues,
                    {
                      name: '',
                      location: '',
                      placeId: undefined,
                      isPrimary: false,
                    },
                  ])
                }}
                className="!w-fit ps-0 text-muted-foreground hover:bg-transparent dark:hover:bg-transparent -top-2 relative"
              >
                + Add additional venue
              </Button>
            </Field>
          )}
        </form.Subscribe>
        <form.Field name="date">
          {(field) => {
            const isInvalid =
              field.state.meta.isTouched && !field.state.meta.isValid
            return (
              <Field data-invalid={isInvalid}>
                <FieldLabel htmlFor={field.name}>
                  Session Date & Time
                </FieldLabel>
                <DateTimePicker
                  value={field.state.value}
                  setValue={(value) => field.handleChange(value)}
                />
                {isInvalid && <FieldError errors={field.state.meta.errors} />}
              </Field>
            )
          }}
        </form.Field>
        <FieldSeparator />
        <form.Field name="timeBlocks">
          {(field) => {
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
                    if (value && (value === '60' || value === '90')) {
                      field.handleChange(value)
                      // Clear up selected timeSlots for all levels when this happens
                      const currentLevels = field.form.getFieldValue('levels')
                      if (currentLevels) {
                        field.form.setFieldValue(
                          'levels',
                          currentLevels.map((level) => ({
                            ...level,
                            timeSlots: [],
                          })),
                        )
                      }
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
        </form.Field>
        <form.Subscribe
          selector={(state) => ({
            date: state.values.date,
            timeBlocks: state.values.timeBlocks,
          })}
        >
          {({ date, timeBlocks }) => (
            <form.Field name="levels" mode="array">
              {(field) => {
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

                const timeSlotOptions = generateTimeSlots(
                  new Date(date),
                  parseInt(timeBlocks, 10),
                )
                return (
                  <FieldGroup data-invalid={isInvalid}>
                    <FieldLabel htmlFor="levels">Available Levels</FieldLabel>
                    <FieldDescription>
                      Select the set of levels available for the session.
                    </FieldDescription>
                    <div className="flex flex-col gap-3">
                      {levelOptions.map((option) => {
                        const levelData = field.state.value.find(
                          (l: SessionForm['levels'][number]) =>
                            l.level === option.value,
                        ) ?? { level: option.value, timeSlots: [] }

                        return (
                          <Collapsible
                            key={option.value}
                            className="border py-3 flex flex-col gap-2"
                          >
                            <div className="flex items-center justify-between gap-4 px-4">
                              <div className="flex items-center gap-2">
                                <h4 className="text-sm">{option.label}</h4>
                                <Badge
                                  className="font-mono w-8 h-6 p-0 flex items-center justify-center"
                                  variant={
                                    levelData.timeSlots.length === 0
                                      ? 'outline'
                                      : 'default'
                                  }
                                >
                                  <ClientOnly
                                    fallback={levelData.timeSlots.length}
                                  >
                                    <AnimatedCounter
                                      value={levelData.timeSlots.length}
                                    />
                                  </ClientOnly>
                                </Badge>
                              </div>
                              <CollapsibleTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-8"
                                >
                                  <ChevronsUpDown />
                                  <span className="sr-only">Toggle</span>
                                </Button>
                              </CollapsibleTrigger>
                            </div>
                            <CollapsibleContent className="px-4 overflow-hidden">
                              <ScrollArea className="whitespace-nowrap">
                                <div className="flex w-max gap-2">
                                  {timeSlotOptions.map(({ id, range }) => (
                                    <FieldLabel
                                      key={`${option.value}-${id}`}
                                      htmlFor={`slot-${option.value}-${id}`}
                                    >
                                      <Field
                                        orientation="horizontal"
                                        data-invalid={isInvalid}
                                        className="!p-2"
                                      >
                                        <FieldContent>
                                          <FieldTitle>{id}</FieldTitle>
                                        </FieldContent>
                                        <Checkbox
                                          hidden
                                          aria-invalid={isInvalid}
                                          id={`slot-${option.value}-${id}`}
                                          checked={
                                            levelData?.timeSlots.some(
                                              (timeSlot: { id: string }) =>
                                                timeSlot.id === id,
                                            ) ?? false
                                          }
                                          onCheckedChange={(checked) => {
                                            const currentLevels =
                                              field.state.value
                                            const existingLevelIndex =
                                              currentLevels.findIndex(
                                                (l) => l.level === option.value,
                                              )

                                            if (existingLevelIndex >= 0) {
                                              // Level exists, update its timeSlots
                                              const existingLevel =
                                                currentLevels[
                                                  existingLevelIndex
                                                ]
                                              const updatedTimeSlots = checked
                                                ? [
                                                    ...existingLevel.timeSlots,
                                                    { id, range },
                                                  ].sort(
                                                    (a, b) =>
                                                      a.range[0].getTime() -
                                                      b.range[0].getTime(),
                                                  )
                                                : existingLevel.timeSlots.filter(
                                                    (ts) => ts.id !== id,
                                                  )

                                              const updatedLevels = [
                                                ...currentLevels,
                                              ]
                                              updatedLevels[
                                                existingLevelIndex
                                              ] = {
                                                ...existingLevel,
                                                timeSlots: updatedTimeSlots,
                                              }
                                              field.handleChange(updatedLevels)
                                            } else if (checked) {
                                              // Level doesn't exist, add it with the time slot
                                              field.handleChange([
                                                ...currentLevels,
                                                {
                                                  level: option.value,
                                                  timeSlots: [{ id, range }],
                                                },
                                              ])
                                            }
                                          }}
                                        />
                                      </Field>
                                    </FieldLabel>
                                  ))}
                                </div>
                                <ScrollBar
                                  orientation="horizontal"
                                  className="hidden"
                                />
                              </ScrollArea>
                            </CollapsibleContent>
                          </Collapsible>
                        )
                      })}
                    </div>
                    {isInvalid && (
                      <FieldError errors={field.state.meta.errors} />
                    )}
                  </FieldGroup>
                )
              }}
            </form.Field>
          )}
        </form.Subscribe>
        <FieldSeparator />
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
                    Limit players per slot (Optional)
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
                          field.handleChange(parseInt(e.target.value, 10))
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
        <form.Field name="votingClosesAt">
          {(field) => {
            const isInvalid =
              field.state.meta.isTouched && !field.state.meta.isValid
            return (
              <Field data-invalid={isInvalid}>
                <FieldLabel htmlFor={field.name}>
                  Voting Deadline (Optional)
                </FieldLabel>
                <DateTimePicker
                  value={field.state.value}
                  setValue={(value) => field.handleChange(value)}
                  showClearButton={true}
                  onClear={() => field.handleChange(undefined)}
                />
                <FieldDescription>
                  Set a deadline for when voting closes.
                </FieldDescription>
                {isInvalid && <FieldError errors={field.state.meta.errors} />}
              </Field>
            )
          }}
        </form.Field>
        <ButtonGroup className="w-full">
          <Button
            type="button"
            onClick={() => handleCreateSession('voting')}
            disabled={isCreating}
            className="flex-1 rounded-r-none"
          >
            {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isCreating ? 'Publishing...' : 'Publish'}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                disabled={isCreating}
                className="rounded-l-none border-l"
                size="icon"
              >
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => handleCreateSession('voting')}>
                Publish
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => handleCreateSession('draft')}>
                Save as draft
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </ButtonGroup>
      </FieldSet>
    </form>
  )
}
