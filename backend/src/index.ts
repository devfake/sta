import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { rateLimiter } from 'hono-rate-limiter'

import OpenAI from 'openai'
import 'dotenv/config'

const app = new Hono()

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

app.use('/*', serveStatic({ root: './public/browser/' }))

app.use(
    rateLimiter({
      windowMs: 60 * 60 * 1000,
      limit: process.env.RATE_LIMIT_PER_HOUR,
      standardHeaders: 'draft-6',
      keyGenerator: (c: any) => {
        return c.env.incoming.socket.remoteAddress
      },
    })
)

app.get('/', serveStatic({
    path: './public/browser/index.html'
}))

app.post('/api', async (c) => {
  const data = await c.req.json()

  if (!data.names) {
    console.log('NO DATA', data)
    throw new Error('NO DATA')
  }

  const baseInstruction = `Please parse the following file names into a simple and clean JSON array structure (without formatting) with the fields "artist" and "title". Remove any irrelevant terms such as "official", "lyrics", "featuring" or similar additions like words in parentheses. For each line, create exactly one JSON object. If a file name includes multiple artists (e.g., separated by "x," "," or "-"), combine them into a single string in the "artist" field. Do not ignore duplicates; process them as well. If you can't find the artist and the title, leave the artist field empty. The output should be in the following JSON format: [{"artist": "Artist Name", "title": "Title"}]. Here are the file names:`
  const names = data.names.join('\n\n')

  const params: OpenAI.Chat.ChatCompletionCreateParams = {
    messages: [
      { role: 'user', content: baseInstruction },
      { role: 'user', content: names },
    ],
    model: 'gpt-4o-mini',
  }

  try {
    const response = await client.chat.completions.create(params).asResponse()

    const json = await response.json()

    return c.json(JSON.parse(json.choices[0].message.content))
  } catch (error) {
    console.log('API ISSUE', error.message)
    throw new Error('API ISSUE')
  }
})

app.notFound((c) => {
    return c.redirect('/')
})

serve(app)
