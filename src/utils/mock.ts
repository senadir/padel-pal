import { parse } from 'date-fns'
import { v4 as uuidv4 } from 'uuid'
import chunk from 'lodash/chunk'
import shuffle from 'lodash/shuffle'
import sample from 'lodash/sample'
import random from 'lodash/random'
import type { Match, Option, Session } from './types'

const session: Session = {
  id: uuidv4(),
  venueName: 'Aurial Pàdel Cornellà',
  venueLocation: 'https://maps.app.goo.gl/1234567890',
  date: parse('2025-10-12', 'yyyy-MM-dd', new Date()),
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
      options: [],
    },
    {
      id: '17:00-18:00',
      range: [
        parse('17:00', 'HH:mm', new Date()),
        parse('18:00', 'HH:mm', new Date()),
      ],
      options: [],
    },
    {
      id: '18:00-19:00',
      range: [
        parse('18:00', 'HH:mm', new Date()),
        parse('19:00', 'HH:mm', new Date()),
      ],
      options: [],
    },
  ],
  limitPlayers: false,
  playersPerSlot: 4,
}

session.timeSlots.forEach((slot) => {
  const pollOfPlayers = new Array(20).fill(0).map((_, index) => index + 1)
  session.levels.forEach((level) => {
    // Safely ensure options array exists and is an array
    if (!Array.isArray(slot.options)) {
      slot.options = []
    }
    const players: Option['players'] = []
    pollOfPlayers.forEach((number, index) => {
      if (Math.random() < 0.5) {
        players.push({
          id: index.toString(),
          name: `Player ${number}`,
          avatar: `https://avatar.iran.liara.run/public/${number}`,
          phone: '+1234567890',
          level: random(0.5, 3).toFixed(2),
          votedAt: (() => {
            const now = new Date()
            const startOfDay = new Date(
              now.getFullYear(),
              now.getMonth(),
              now.getDate(),
              0,
              0,
              0,
              0,
            )
            const endOfDay = new Date(
              now.getFullYear(),
              now.getMonth(),
              now.getDate(),
              23,
              59,
              59,
              999,
            )
            const randomTime = new Date(
              startOfDay.getTime() +
                Math.random() * (endOfDay.getTime() - startOfDay.getTime()),
            )
            return randomTime
          })(),
        })

        delete pollOfPlayers[index]
      }
    })

    slot.options.push({
      id: uuidv4(),
      level,
      players,
      slot: {
        id: slot.id,
        range: slot.range,
      },
    })
  })
})

const matches: Array<Match> = session.timeSlots.flatMap((slot) =>
  slot.options.flatMap((option) => {
    const playerGroups = chunk(shuffle(option.players), 4)
    return playerGroups.map((group) => ({
      id: uuidv4(),
      sessionId: session.id,
      playtomicMatchId: null,
      status: 'scheduled',
      players: group.map(({ votedAt, ...player }) => ({
        ...player,
        status: sample(['paid', 'pending', 'draft']),
      })),
      slot: option.slot,
      level: option.level,
    }))
  }),
)

export { session as mockSession, matches as mockMatches }
