import { defineEventHandler, setResponseHeader } from 'h3'

export default defineEventHandler((event) => {
  const config = useRuntimeConfig(event)
  const allowIndexing = config.public.helpContentProfile === 'public'

  setResponseHeader(event, 'Content-Type', 'text/plain; charset=utf-8')
  setResponseHeader(event, 'Cache-Control', 'public, max-age=300')

  return allowIndexing
    ? 'User-agent: *\nAllow: /\n'
    : [
        '# Test site: authentication and X-Robots-Tag prevent indexing.',
        '# Crawling stays enabled temporarily so existing search results can observe the removal signals.',
        'User-agent: *',
        'Disallow:',
        '',
      ].join('\n')
})
