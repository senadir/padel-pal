# WhatsApp Webhook Handler

Handles incoming Twilio WhatsApp webhooks for Playtomic match link validation and linking.

## Environment Variables

Required:
- `TWILIO_AUTH_TOKEN` - Twilio auth token for webhook signature validation

Get from: https://console.twilio.com/ → Account → Auth Token

## Local Development

### Set environment variable

```bash
# In supabase/functions/.env (create if doesn't exist)
TWILIO_AUTH_TOKEN=your_auth_token_here
```

### Run tests

```bash
cd supabase/functions/handle-incoming-whatsapp
deno test --allow-env
```

### Deploy function

```bash
npx supabase functions deploy handle-incoming-whatsapp --no-verify-jwt
```

Note: `--no-verify-jwt` is required because Twilio webhooks don't include Supabase JWT tokens.

## Webhook URL

After deployment, configure this URL in Twilio:

```
https://<project-ref>.supabase.co/functions/v1/handle-incoming-whatsapp
```

Configure at: https://console.twilio.com/us1/develop/sms/settings/whatsapp-sender

## Supported Playtomic URL Formats

1. Full match URLs: `https://app.playtomic.io/matches/{uuid}?...`
2. Short URLs: `https://app.playtomic.io/t/{code}`

## Response Flow

1. Validate Twilio signature (HMAC-SHA1)
2. Extract webhook data (sender, message, timestamp)
3. Extract Playtomic link from message
4. Run business logic (validation & linking)
5. Send TwiML response back to user via WhatsApp

## Business Logic TODO

Currently returns placeholder responses. Needs implementation:

1. Resolve short URLs to full match IDs
2. Fetch Playtomic match details from API
3. Find matching match in database (by time + location)
4. Validate match details
5. Link match to Playtomic booking
6. Handle errors and edge cases

See `docs/plans/2025-11-15-whatsapp-webhook-design.md` for full design.
