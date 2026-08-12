import { normalizeHelpContentProfile } from '~/data/helpContent'

export default defineNuxtPlugin({
  name: 'help-content-profile',
  setup() {
    const config = useRuntimeConfig()
    const profile = normalizeHelpContentProfile(config.public.helpContentProfile)

    useHead({
      htmlAttrs: {
        'data-help-content-profile': profile,
      },
      meta: profile === 'public'
        ? []
        : [
            {
              name: 'robots',
              content: 'noindex, nofollow, noarchive, nosnippet, noimageindex',
            },
            {
              name: 'googlebot',
              content: 'noindex, nofollow, noarchive, nosnippet, noimageindex',
            },
            {
              name: 'baiduspider',
              content: 'noindex, nofollow, noarchive, nosnippet, noimageindex',
            },
          ],
    })
  },
})
