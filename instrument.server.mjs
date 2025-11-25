import * as Sentry from '@sentry/tanstackstart-react'

Sentry.init({
  dsn: 'https://27680c5f06cb6131551721666063787f@o75551.ingest.us.sentry.io/4510425888260096',

  // Setting this option to true will send default PII data to Sentry.
  // For example, automatic IP address collection on events
  sendDefaultPii: true,

  // Performance monitoring - capture 100% of transactions in dev, 10% in prod
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
})
