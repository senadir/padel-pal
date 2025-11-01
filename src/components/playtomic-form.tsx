import { useNavigate, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldGroup } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from './ui/dialog'
import type { PlaytomicProfile } from '@/utils/types'
import { linkPlaytomicProfile } from '@/utils/auth'
import { searchPlaytomicByEmail as serverSearchPlaytomicByEmail } from '@/utils/playtomic'
import { useServerFn } from '@tanstack/react-start'
import { Spinner } from './ui/spinner'

const PlaytomicLogo = ({ className }: { className?: string }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="7.512 0 32.976 48"
      height="48px"
      className={cn('fill-current', className)}
    >
      <path
        d="M 26.349 0 L 7.512 0 L 7.512 37.291 L 17.84 37.291 L 17.84 48 L 26.349 48 C 34.139 48 40.488 42.036 40.488 34.709 L 40.488 13.294 C 40.476 5.964 34.139 0 26.349 0 Z M 24.694 44.68 L 21.151 44.68 L 21.151 26.582 L 24.694 26.582 L 24.694 44.68 Z M 37.168 34.698 C 37.168 39.683 33.186 43.826 28.006 44.564 L 28.006 37.183 C 32.264 36.674 35.613 34.449 37.168 31.929 L 37.168 34.698 Z M 37.168 23.992 C 37.168 28.974 33.183 33.106 28.006 33.844 L 28.006 26.491 C 32.264 25.982 35.613 23.757 37.168 21.237 L 37.168 23.992 Z M 26.349 23.276 L 17.84 23.276 L 17.84 33.982 L 10.824 33.982 L 10.824 3.312 L 26.349 3.312 C 32.315 3.312 37.168 7.791 37.168 13.294 C 37.168 18.797 32.315 23.276 26.349 23.276 Z"
        style={{ strokeWidth: '2.906' }}
      />
    </svg>
  )
}

type PlaytomicFormProps = React.ComponentProps<'div'> & {
  playtomicProfile: PlaytomicProfile | null | undefined
  searchMethod: 'phone' | 'email' | 'none'
}

export function PlaytomicForm({
  playtomicProfile,
  searchMethod,
  className,
  ...props
}: PlaytomicFormProps) {
  const [searchByEmailOpen, setSearchByEmailOpen] = useState(false)
  const [emailInput, setEmailInput] = useState('')
  const navigate = useNavigate()
  const router = useRouter()
  const queryClient = useQueryClient()

  const linkProfile = useServerFn(linkPlaytomicProfile)
  const searchByEmailFn = useServerFn(serverSearchPlaytomicByEmail)

  // Mutation for linking profile
  const linkMutation = useMutation({
    mutationFn: async (profile: PlaytomicProfile) => {
      return linkProfile({
        data: {
          playtomicId: profile.user_id,
          name: profile.full_name,
          avatar: profile.picture,
        },
      })
    },
    onSuccess: () => {
      // Invalidate auth query to refresh
      queryClient.invalidateQueries({ queryKey: ['user'] })
      toast.success('Profile linked successfully!')
      // Redirect to home
      router.invalidate()
      navigate({ to: '/' })
    },
    onError: (error) => {
      console.error('Error linking profile:', error)
      toast.error('Failed to link profile', {
        description: error.message,
      })
    },
  })

  // Mutation for email search
  const emailSearchMutation = useMutation({
    mutationFn: async (email: string) => {
      return searchByEmailFn({ data: { email } })
    },
    onSuccess: (profile) => {
      if (profile) {
        setSearchByEmailOpen(false)
        // Update URL with email query param
        navigate({
          to: '/login/playtomic',
          search: { email: emailInput },
        })
      } else {
        toast.error('No profile found with that email')
      }
    },
    onError: (error) => {
      console.error('Error searching by email:', error)
      toast.error('Failed to search by email', {
        description: error.message,
      })
    },
  })

  const handleLinkProfile = () => {
    if (playtomicProfile) {
      linkMutation.mutate(playtomicProfile)
    }
  }

  const handleEmailSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (emailInput) {
      emailSearchMutation.mutate(emailInput)
    }
  }

  return (
    <div className={cn('flex flex-col', className)} {...props}>
      <FieldGroup>
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-[#335fff] p-3 mb-4">
            <PlaytomicLogo className="fill-white w-full h-full" />
          </div>
          <h1 className="text-xl font-bold">
            {playtomicProfile
              ? 'Is this your Playtomic profile?'
              : 'Find your Playtomic profile'}
          </h1>
        </div>

        {playtomicProfile && (
          <PlaytomicCard playtomicProfile={playtomicProfile} />
        )}

        {!playtomicProfile && (
          <div className="text-center text-muted-foreground py-4">
            <p>We couldn't find a Playtomic profile with your phone number.</p>
            <p className="mt-2">Try searching by email instead.</p>
          </div>
        )}

        <div className="flex flex-col gap-2">
          {playtomicProfile && (
            <Button
              variant="default"
              onClick={handleLinkProfile}
              disabled={linkMutation.isPending}
            >
              {linkMutation.isPending ? (
                <>
                  <Spinner className="mr-2" />
                  Linking...
                </>
              ) : (
                'Link Profile'
              )}
            </Button>
          )}

          {searchMethod === 'email' && (
            <Button
              variant={playtomicProfile ? 'outline' : 'default'}
              onClick={() => navigate({ to: '/login/playtomic' })}
            >
              Search with phone again
            </Button>
          )}

          <Dialog open={searchByEmailOpen} onOpenChange={setSearchByEmailOpen}>
            <DialogTrigger asChild>
              <Button variant={playtomicProfile ? 'outline' : 'default'}>
                {searchMethod === 'email' ? 'Search with another email' : 'Search using email'}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Search using email</DialogTitle>
              </DialogHeader>
              <DialogDescription>
                Enter your email address to search for your Playtomic profile.
              </DialogDescription>
              <form onSubmit={handleEmailSearch} className="space-y-4">
                <Input
                  type="email"
                  placeholder="your.email@example.com"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  required
                />
                <Button
                  variant="default"
                  type="submit"
                  disabled={emailSearchMutation.isPending}
                  className="w-full"
                >
                  {emailSearchMutation.isPending ? (
                    <>
                      <Spinner className="mr-2" />
                      Searching...
                    </>
                  ) : (
                    'Search'
                  )}
                </Button>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog>
            <DialogTrigger asChild>
              <Button variant="ghost" className="text-sm text-muted-foreground">
                I don't have a Playtomic profile
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>You need a Playtomic profile</DialogTitle>
              </DialogHeader>
              <DialogDescription>
                You can create a profile by signing up for a free account on
                Playtomic.
              </DialogDescription>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="default" asChild>
                    <a
                      href="https://app.playtomic.io/download-app"
                      target="_blank"
                    >
                      Download Playtomic App
                    </a>
                  </Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </FieldGroup>
    </div>
  )
}

const PlaytomicCard = ({
  playtomicProfile,
}: {
  playtomicProfile: PlaytomicProfile
}) => {
  return (
    <Empty className="p-2 md:p-4 border border-solid rounded-lg">
      <EmptyHeader>
        <EmptyMedia variant="default">
          <Avatar className="size-12">
            <AvatarImage src={playtomicProfile.picture} />
            <AvatarFallback>
              {playtomicProfile.full_name.charAt(0)}
            </AvatarFallback>
          </Avatar>
        </EmptyMedia>
        <EmptyTitle>{playtomicProfile.full_name}</EmptyTitle>
        <EmptyDescription>
          Linked to{' '}
          {playtomicProfile.email ||
            playtomicProfile.phone ||
            playtomicProfile.user_id}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>{playtomicProfile.bio}</EmptyContent>
    </Empty>
  )
}
