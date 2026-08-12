import { defineEventHandler, setResponseHeader } from 'h3'

export default defineEventHandler((event) => {
  const config = useRuntimeConfig(event)

  if (config.public.helpContentProfile === 'public') return

  setResponseHeader(
    event,
    'X-Robots-Tag',
    'noindex, nofollow, noarchive, nosnippet, noimageindex',
  )
})
