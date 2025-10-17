import { Link, createFileRoute } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { addMinutes, format, isAfter, parse } from 'date-fns'
import {
  Field,
  FieldContent,
  FieldDescription,
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

type Session = {
  venueName: string
  venueLocation: string
  date: Date
  time: Date
  levels: Array<string>
  timeBlocks: string
  timeSlots: Array<{ id: string; range: [Date, Date] }>
  limitPlayers: boolean
  playersPerSlot: number
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
  const [session, setSession] = useState<Session>({
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
  })

  const games = useMemo(() => {
    const games = []
    for (const slot of session.timeSlots) {
      for (const level of session.levels) {
        games.push({
          slot,
          level,
        })
      }
    }
    return games
  }, [session.timeSlots, session.levels])

  // Generate time slots based on session time and time blocks
  const generateTimeSlots = () => {
    const slots: Session['timeSlots'] = []

    // Set the maximum end time to 11:00 PM
    const maxEndTime = parse('23:00', 'HH:mm', new Date())
    let currentTime = session.time
    const timeBlocks = parseInt(session.timeBlocks)

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
    <form className="flex flex-col gap-6">
      <FieldSet>
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold">Create a new session</h1>
          <FieldLegend className="text-muted-foreground text-sm text-balance">
            Fill in the form below to create a new session
          </FieldLegend>
        </div>
        <Field>
          <FieldLabel htmlFor="venue-name">Venue Name</FieldLabel>
          <Input
            id="venue-name"
            type="text"
            placeholder="Aurial Pàdel Cornellà"
            required
            value={session.venueName}
            onChange={(e) => {
              setSession({ ...session, venueName: e.target.value })
            }}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="venue-location">
            Venue Google Maps Location
          </FieldLabel>
          <Input
            id="venue-location"
            type="url"
            placeholder="https://maps.app.goo.gl/1234567890"
            required
            value={session.venueLocation}
            onChange={(e) => {
              setSession({ ...session, venueLocation: e.target.value })
            }}
          />
        </Field>
        <FieldGroup className="grid grid-cols-2 gap-3">
          <DatePicker
            label="Session Date"
            value={session.date}
            setValue={(value) => setSession({ ...session, date: value })}
          />

          <Field>
            <FieldLabel htmlFor="time-picker">Session Time</FieldLabel>
            <Input
              type="time"
              id="time-picker"
              min="07:00"
              max="21:00"
              step="1800"
              value={format(session.time, 'HH:mm')}
              onChange={(e) => {
                const inputTime = parse(e.target.value, 'HH:mm', new Date())
                // Round up to the nearest half hour
                let minutes = inputTime.getMinutes()
                let hours = inputTime.getHours()
                if (minutes > 0 && minutes <= 30) {
                  minutes = 30
                } else if (minutes > 30) {
                  hours += 1
                  minutes = 0
                }
                const roundedTime = new Date(inputTime)
                roundedTime.setHours(hours)
                roundedTime.setMinutes(minutes)
                setSession({
                  ...session,
                  time: roundedTime,
                })
              }}
              className="bg-background appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
            />
          </Field>
        </FieldGroup>
        <FieldSeparator />
        <Field>
          <FieldLabel htmlFor="time-blocks">Time Blocks</FieldLabel>
          <ToggleGroup
            id="time-blocks"
            type="single"
            className="w-full"
            variant="outline"
            size="lg"
            value={session.timeBlocks}
            onValueChange={(value) => {
              if (value) {
                setSession({
                  ...session,
                  timeBlocks: value,
                  timeSlots: [],
                })
              }
            }}
          >
            <ToggleGroupItem value="60">60 minutes</ToggleGroupItem>
            <ToggleGroupItem value="90">90 minutes</ToggleGroupItem>
          </ToggleGroup>
          <FieldDescription>Select the duration of the games.</FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="levels">Available Levels</FieldLabel>
          <FieldDescription>
            Select the set of levels available for the session.
          </FieldDescription>
          <div className="flex flex-col gap-3">
            <FieldLabel htmlFor="beginner-level">
              <Field orientation="horizontal">
                <FieldContent>
                  <FieldTitle>Beginner</FieldTitle>
                  <FieldDescription>
                    New to padel or learning the basics.
                  </FieldDescription>
                </FieldContent>
                <Checkbox
                  id="beginner-level"
                  checked={session.levels.includes('beginner')}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSession({
                        ...session,
                        levels: [...session.levels, 'beginner'],
                      })
                    } else {
                      setSession({
                        ...session,
                        levels: session.levels.filter(
                          (level) => level !== 'beginner',
                        ),
                      })
                    }
                  }}
                />
              </Field>
            </FieldLabel>
            <FieldLabel htmlFor="improver-level">
              <Field orientation="horizontal">
                <FieldContent>
                  <FieldTitle>Improver</FieldTitle>
                  <FieldDescription>
                    Basic skills developed, ready to improve.
                  </FieldDescription>
                </FieldContent>
                <Checkbox
                  id="improver-level"
                  checked={session.levels.includes('improver')}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSession({
                        ...session,
                        levels: [...session.levels, 'improver'],
                      })
                    } else {
                      setSession({
                        ...session,
                        levels: session.levels.filter(
                          (level) => level !== 'improver',
                        ),
                      })
                    }
                  }}
                />
              </Field>
            </FieldLabel>
            <FieldLabel htmlFor="intermediate-level">
              <Field orientation="horizontal">
                <FieldContent>
                  <FieldTitle>Intermediate</FieldTitle>
                  <FieldDescription>
                    Solid technique and game understanding.
                  </FieldDescription>
                </FieldContent>
                <Checkbox
                  id="intermediate-level"
                  checked={session.levels.includes('intermediate')}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSession({
                        ...session,
                        levels: [...session.levels, 'intermediate'],
                      })
                    } else {
                      setSession({
                        ...session,
                        levels: session.levels.filter(
                          (level) => level !== 'intermediate',
                        ),
                      })
                    }
                  }}
                />
              </Field>
            </FieldLabel>
            <FieldLabel htmlFor="advanced-level">
              <Field orientation="horizontal">
                <FieldContent>
                  <FieldTitle>Advanced</FieldTitle>
                  <FieldDescription>
                    High-level play with advanced techniques.
                  </FieldDescription>
                </FieldContent>
                <Checkbox
                  id="advanced-level"
                  checked={session.levels.includes('advanced')}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSession({
                        ...session,
                        levels: [...session.levels, 'advanced'],
                      })
                    } else {
                      setSession({
                        ...session,
                        levels: session.levels.filter(
                          (level) => level !== 'advanced',
                        ),
                      })
                    }
                  }}
                />
              </Field>
            </FieldLabel>
          </div>
        </Field>
        <Field>
          <FieldLabel htmlFor="time-slots">Available Time Slots</FieldLabel>
          <FieldDescription>
            Select the time slots available for the session.
          </FieldDescription>
          <div className="grid grid-cols-2 gap-3">
            {generateTimeSlots().map(({ id, range }) => (
              <FieldLabel key={id} htmlFor={`slot-${id}`}>
                <Field orientation="horizontal">
                  <FieldContent>
                    <FieldTitle>{id}</FieldTitle>
                  </FieldContent>
                  <Checkbox
                    id={`slot-${id}`}
                    checked={session.timeSlots.some(
                      (timeSlot) => timeSlot.id === id,
                    )}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        console.log({
                          ...session,
                          timeSlots: [...session.timeSlots, { id, range }],
                        })
                        setSession({
                          ...session,
                          timeSlots: [...session.timeSlots, { id, range }],
                        })
                      } else {
                        setSession({
                          ...session,
                          timeSlots: session.timeSlots.filter(
                            (timeSlot) => timeSlot.id !== id,
                          ),
                        })
                      }
                    }}
                  />
                </Field>
              </FieldLabel>
            ))}
          </div>
        </Field>
        <Field orientation="horizontal">
          <Checkbox
            id="limit-players"
            checked={session.limitPlayers}
            onCheckedChange={(checked) => {
              setSession({ ...session, limitPlayers: !!checked })
            }}
          />
          <FieldContent>
            <FieldLabel htmlFor="limit-players">
              Limit players per slot
            </FieldLabel>
            <FieldDescription>
              Limit the number of players who can sign up for a time slot before
              closing it.
            </FieldDescription>
          </FieldContent>
        </Field>
        {session.limitPlayers && (
          <Field>
            <FieldLabel htmlFor="players-per-slot">Players per slot</FieldLabel>
            <Input
              id="players-per-slot"
              placeholder="4"
              type="number"
              min={1}
              value={session.playersPerSlot}
              onChange={(e) => {
                setSession({
                  ...session,
                  playersPerSlot: parseInt(e.target.value),
                })
              }}
            />
          </Field>
        )}
        <Field>
          <Button type="submit" disabled={games.length === 0}>
            <Link to="/sessions/1234">
              {games.length === 0
                ? 'Create a session'
                : `Create a session with ${games.length} games`}
            </Link>
          </Button>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" type="button" className="w-full">
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
                    defaultValue={`${session.venueName} - ${session.time}`}
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
      </FieldSet>
    </form>
  )
}
