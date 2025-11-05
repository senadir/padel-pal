import { formOptions, useForm } from '@tanstack/react-form'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ClientOnly,
  createFileRoute,
  redirect,
  useRouter,
  useSearch,
} from '@tanstack/react-router'
import { addMinutes, format, isAfter, parse } from 'date-fns'
import { ChevronDown, ChevronsUpDown, Loader2, Save } from 'lucide-react'
import { toast } from 'sonner'
import { useEffect, useState } from 'react'
import type { SessionForm } from '@/utils/types'
import { AnimatedCounter } from '@/components/ui/animated-counter'
import { PlaceSearchCombobox } from '@/components/place-search-combobox'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ButtonGroup } from '@/components/ui/button-group'
import { Checkbox } from '@/components/ui/checkbox'
import { DateTimePicker } from '@/components/ui/datetime-picker'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import {
  createSession,
  createSessionValidator,
  fetchSessionTemplates,
  saveSessionTemplate,
} from '@/utils/sessions'

const defaultSession: SessionForm = {
  venueName: '',
  venueLocation: '',
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
  validateSearch: (search: Record<string, unknown>) => {
    return {
      templateId: search.templateId as string | undefined,
    }
  },
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
        title: 'Create a new session',
      },
    ],
  }),
})

// Helper function to generate time slots (defined outside component)
const generateTimeSlots = (date: Date, timeBlocks: number) => {
  const slots: SessionForm['timeSlots'] = []

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

  return slots
}

function NewSession() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const search = useSearch({ from: '/sessions/new' })
  const [saveTemplateDialogOpen, setSaveTemplateDialogOpen] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [isSavingTemplate, setIsSavingTemplate] = useState(false)

  // Fetch templates
  const { data: templates } = useQuery({
    queryKey: ['session-templates'],
    queryFn: () => fetchSessionTemplates(),
  })

  const sessionFormOptions = formOptions({
    defaultValues: defaultSession,
    validators: {
      onSubmit: createSessionValidator,
    },
    onSubmit: async ({ value }) => {
      // This will be triggered by direct form submission (not used anymore)
      // We'll handle submission via custom functions below
    },
  })
  const form = useForm(sessionFormOptions)

  // Load template from URL if templateId is present
  useEffect(() => {
    if (search.templateId && templates) {
      handleLoadTemplate(search.templateId)
    }
  }, [search.templateId, templates])

  // Handle session creation with specified status
  const handleCreateSession = async (
    status: 'draft' | 'voting',
  ): Promise<void> => {
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

      // Show success message
      if (status === 'draft') {
        toast.success('Session saved as draft')
      } else {
        toast.success('Session published successfully')
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
    }
  }

  // Handle loading a template
  const handleLoadTemplate = (templateId: string) => {
    const template = templates?.find((t) => t.id.toString() === templateId)
    if (!template) return

    const templateData = template.template_data as any

    // Transform ISO strings back to Date objects
    const levels = templateData.levels.map((level: any) => ({
      level: level.level,
      timeSlots: level.timeSlots.map((slot: any) => ({
        id: slot.id,
        range: [new Date(slot.range[0]), new Date(slot.range[1])] as [
          Date,
          Date,
        ],
      })),
    }))

    // Set form values
    form.setFieldValue('venueName', templateData.venueName || '')
    form.setFieldValue('venueLocation', templateData.venueLocation || '')
    form.setFieldValue('venuePlaceId', templateData.venuePlaceId)
    form.setFieldValue('levels', levels)
    form.setFieldValue('timeBlocks', templateData.timeBlocks)
    form.setFieldValue('limitPlayers', templateData.limitPlayers)
    form.setFieldValue('playersPerSlot', templateData.playersPerSlot)

    toast.success('Template loaded successfully')
  }

  // Handle saving as template
  const handleSaveTemplate = async () => {
    if (!templateName.trim()) {
      toast.error('Please enter a template name')
      return
    }

    try {
      setIsSavingTemplate(true)
      const formValues = form.state.values

      // Transform dates to ISO strings for JSON storage
      const templateData = {
        venueName: formValues.venueName,
        venueLocation: formValues.venueLocation,
        venuePlaceId: formValues.venuePlaceId,
        levels: formValues.levels.map((level) => ({
          level: level.level,
          timeSlots: level.timeSlots.map((slot) => ({
            id: slot.id,
            range: [
              slot.range[0].toISOString(),
              slot.range[1].toISOString(),
            ] as [string, string],
          })),
        })),
        timeBlocks: formValues.timeBlocks,
        limitPlayers: formValues.limitPlayers,
        playersPerSlot: formValues.playersPerSlot,
      }

      await saveSessionTemplate({
        data: {
          name: templateName,
          templateData,
        },
      })

      toast.success('Template saved successfully')
      setSaveTemplateDialogOpen(false)
      setTemplateName('')
      await queryClient.invalidateQueries({ queryKey: ['session-templates'] })
    } catch (error) {
      console.error('Error saving template:', error)
      const errorMessage =
        error instanceof Error ? error.message : 'An unexpected error occurred'
      toast.error('Failed to save template', {
        description: errorMessage,
      })
    } finally {
      setIsSavingTemplate(false)
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

        <form.Subscribe
          selector={(state) => ({
            venueName: state.values.venueName,
            venueLocation: state.values.venueLocation,
          })}
        >
          {({ venueName, venueLocation }) => (
            <Field>
              <FieldLabel htmlFor="venue">Venue</FieldLabel>
              <PlaceSearchCombobox
                value={
                  venueName
                    ? { name: venueName, location: venueLocation }
                    : undefined
                }
                onSelect={(place) => {
                  // Update all venue fields in form state
                  form.setFieldValue('venueName', place.name)
                  form.setFieldValue('venueLocation', place.location)
                  form.setFieldValue('venuePlaceId', place.placeId)
                }}
                placeholder="Search for a padel venue..."
              />
              <FieldDescription>
                Search for a venue or select from previously used locations.
              </FieldDescription>
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
                    if (value) {
                      field.handleChange(value)
                      // Clear up selected timeSlots for all levels when this happens
                      const currentLevels = field.form.getFieldValue('levels')
                      if (currentLevels) {
                        field.form.setFieldValue(
                          'levels',
                          currentLevels.map((level: any) => ({
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
                      {levelOptions.map((option, levelIndex) => {
                        const levelData = field.state.value.find(
                          (l: any) => l.level === option.value,
                        )

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
                                                (l: any) =>
                                                  l.level === option.value,
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
                                                  ]
                                                : existingLevel.timeSlots.filter(
                                                    (ts: any) => ts.id !== id,
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
        <form.Subscribe
          selector={(state) => {
            return { isSubmitting: state.isSubmitting }
          }}
        >
          {({ isSubmitting }) => (
            <ButtonGroup className="w-full">
              <Button
                type="button"
                onClick={() => handleCreateSession('voting')}
                disabled={isSubmitting}
                className="flex-1 rounded-r-none"
              >
                {isSubmitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {isSubmitting ? 'Creating session...' : 'Publish'}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    disabled={isSubmitting}
                    className="rounded-l-none border-l"
                    size="icon"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onSelect={() => handleCreateSession('voting')}
                  >
                    Publish
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => handleCreateSession('draft')}
                  >
                    Save as draft
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </ButtonGroup>
          )}
        </form.Subscribe>
      </FieldSet>
    </form>
  )
}
