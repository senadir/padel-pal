import { Link } from '@tanstack/react-router'
import { Github, Volleyball } from 'lucide-react'
import { MobileNav } from '@/components/mobile-nav'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { ModeToggle } from '@/components/theme-toggle'

export function Header() {
  return (
    <header className="bg-background sticky top-0 z-30 w-full">
      <div className="container-wrapper 3xl:fixed:px-0 px-6">
        <div className="3xl:fixed:container flex h-(--header-height) items-center gap-2 **:data-[slot=separator]:!h-4">
          <MobileNav className="flex lg:hidden" />
          <Button
            asChild
            variant="ghost"
            size="icon"
            className="hidden size-8 lg:flex"
          >
            <Link to="/">
              <Volleyball className="size-5" />
              <span className="sr-only">Padel Pal</span>
            </Link>
          </Button>
          <div className="ml-auto flex items-center gap-2 md:flex-1 md:justify-end">
            <Button
              asChild
              size="sm"
              variant="ghost"
              className="h-8 shadow-none"
            >
              <a
                href="https://github.com/senadir/padel"
                target="_blank"
                rel="noreferrer"
              >
                <Github />
              </a>
            </Button>
            <Separator orientation="vertical" />
            <ModeToggle />
          </div>
        </div>
      </div>
    </header>
  )
}
