import * as React from 'react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

function useMediaQuery(query: string) {
  const [value, setValue] = React.useState(false)

  React.useEffect(() => {
    function onChange(event: MediaQueryListEvent) {
      setValue(event.matches)
    }

    const result = matchMedia(query)
    result.addEventListener('change', onChange)
    setValue(result.matches)

    return () => result.removeEventListener('change', onChange)
  }, [query])

  return value
}

export function DrawerDialog({
  children,
  open,
  setOpen,
}: {
  children: React.ReactNode
  open: boolean
  setOpen: (open: boolean) => void
}) {
  const isDesktop = useMediaQuery('(min-width: 768px)')

  if (isDesktop) {
    return (
      <Dialog
        open={open}
        onOpenChange={(open) => {
          setOpen(open)
        }}
      >
        {children}
      </Dialog>
    )
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      {children}
    </Drawer>
  )
}

export function DrawerDialogContent({
  children,
  ...props
}: React.ComponentProps<typeof DrawerContent>) {
  const isDesktop = useMediaQuery('(min-width: 768px)')

  if (isDesktop) {
    return <DialogContent {...props}>{children}</DialogContent>
  }

  return <DrawerContent {...props}>{children}</DrawerContent>
}

export function DrawerDialogHeader({
  children,
  ...props
}: React.ComponentProps<typeof DrawerHeader>) {
  const isDesktop = useMediaQuery('(min-width: 768px)')

  if (isDesktop) {
    return <DialogHeader {...props}>{children}</DialogHeader>
  }

  return <DrawerHeader {...props}>{children}</DrawerHeader>
}

export function DrawerDialogTitle({
  children,
  ...props
}: React.ComponentProps<typeof DrawerTitle>) {
  const isDesktop = useMediaQuery('(min-width: 768px)')

  if (isDesktop) {
    return <DialogTitle {...props}>{children}</DialogTitle>
  }

  return <DrawerTitle {...props}>{children}</DrawerTitle>
}

export function DrawerDialogDescription({
  children,
  ...props
}: React.ComponentProps<typeof DrawerDescription>) {
  const isDesktop = useMediaQuery('(min-width: 768px)')

  if (isDesktop) {
    return <DialogDescription {...props}>{children}</DialogDescription>
  }

  return <DrawerDescription {...props}>{children}</DrawerDescription>
}

export function DrawerDialogFooter({
  children,
  ...props
}: React.ComponentProps<typeof DrawerFooter>) {
  const isDesktop = useMediaQuery('(min-width: 768px)')

  if (isDesktop) {
    return null
  }

  return <DrawerFooter {...props}>{children}</DrawerFooter>
}

export function DrawerDialogClose({
  children,
  ...props
}: React.ComponentProps<typeof DrawerClose>) {
  const isDesktop = useMediaQuery('(min-width: 768px)')

  if (isDesktop) {
    return null
  }

  return <DrawerClose {...props}>{children}</DrawerClose>
}
