Meeting Action‑Items Service (MVP)

# FireSlack MVP

> **Goal:** Turn every Fireflies.ai meeting transcript into neatly-formatted Slack tasks that land in the right project channel, while letting each teammate connect **their own** Fireflies account. Enhanced with **GenAI-powered** intelligent summary and action item generation using Google Gemini.

---

## ✨ Feature set (scope‐locked for the MVP)

| Area | What ships in v0.1 |
|------|-------------------|
| **Auth** | [BetterAuth](https://betterauth.dev) "Sign in with Slack" → issues a JWT for the SPA & API |
| **User → Fireflies connect** | User pastes their personal Fireflies **API key** (Option B) in a settings modal. <br>*(OAuth is scaffold-ready but not wired yet.)* |
| **Projects (= folders)** | CRUD UI.  Stores: name, Slack channel ID, team member list (Slack UIDs), docs (plain‐text extracted from *.docx*). |
| **Meetings ingestion** | Shared webhook `POST /fireflies/:userId` receives `transcript_id`, fetches `summary.action_items` via Fireflies GraphQL using that user's token. |
| **GenAI Enhancement** | **NEW:** Uses Google Gemini via [Vercel AI SDK](https://ai-sdk.dev) to intelligently process transcripts, generate contextual summaries, and extract well-formatted action items with smart assignee detection. |
| **Task parsing** | Enhanced with GenAI: Maps each "@Name" in the bullet list → Slack UID from the project's member table; filters out non-members (e.g. clients). AI improves accuracy and context understanding. |
| **Slack posting** | `chat.postMessage` to the project channel with **AI-enhanced formatting**: <br>`*Meeting Summary:* [AI-generated summary]`<br>`*Action Items:* 1. … <@U123>  2. … <@U456>` |
| **Docx sync** | User drops/pastes a *.docx* in the project → server converts with `mammoth`, stores plain text, and includes it in **GenAI context** for enhanced LLM prompting. |
| **DB** | SQLite via Prisma (single file, no server). |
| **Ops** | One Railway service <br>• HTTP API / webhook <br>• serves static React (Vite) <br>• nightly cron for token refresh (if OAuth later) |

---

## 🤖 GenAI Integration with Vercel AI SDK

This project leverages **Google Gemini** through the [Vercel AI SDK](https://ai-sdk.dev) for intelligent meeting processing:

### Features
- **Smart Summary Generation**: AI creates concise, contextual meeting summaries
- **Enhanced Action Item Extraction**: Better understanding of tasks, priorities, and assignees
- **Context-Aware Processing**: Uses project documents and team information for improved accuracy
- **Structured Output**: Consistent formatting for Slack messages

### Implementation
```typescript
import { generateObject } from 'ai'
import { google } from '@ai-sdk/google'

const result = await generateObject({
  model: google('gemini-1.5-flash'),
  schema: z.object({
    summary: z.string().describe('Concise meeting summary'),
    actionItems: z.array(z.object({
      task: z.string(),
      assignee: z.string().optional(),
      priority: z.enum(['high', 'medium', 'low']).optional(),
      dueDate: z.string().optional()
    }))
  }),
  prompt: `Analyze this meeting transcript and extract key information...`
})
```

---

## 🗂  Repo layout

/
├─ prisma/
│ └─ schema.prisma
├─ src/
│ ├─ api/ (Express routes)
│ ├─ lib/ (Fireflies, Slack, BetterAuth helpers, Docx parser)
│ └─ jobs/ (cron scripts)
├─ web/ (React + Vite app)
└─ README.md


## 🛠  Quick-start

```bash
# 1. clone & install
git clone https://github.com/your-org/fireslack.git
cd fireslack
pnpm install   # or npm/yarn

# 2. copy env template
cp .env.example .env            # then edit

# 3. generate Prisma client & seed DB
pnpm prisma generate
pnpm prisma migrate dev --name init

# 4. dev servers (concurrently)
pnpm dev         # runs "web:dev" & "api:dev"
Open http://localhost:5173 for the SPA.

🔑 Environment variables (.env.example)
dotenv
Copy
Edit
# --- BetterAuth ---
BA_CLIENT_ID=
BA_ISSUER_URL=https://betterauth.dev
JWT_SECRET=

# --- Fireflies ---
FIREFLIES_WEBHOOK_SECRET=   # header "x-fireflies-signature"
# (per-user tokens are stored in DB)

# --- Slack ---
SLACK_BOT_TOKEN=
SLACK_SIGNING_SECRET=

# --- GenAI (Google Gemini) ---
GOOGLE_GENERATIVE_AI_API_KEY=   # Get from Google AI Studio

# --- Prisma ---
DATABASE_URL=file:./dev.sqlite

🏛️ Data model (Prisma excerpt)
prisma
Copy
Edit
model User {
  id        Int        @id @default(autoincrement())
  slackUid  String     @unique
  name      String
  email     String?
  ffCred    FirefliesCredential?
  projects  Project[]  @relation("Team")
}

model FirefliesCredential {
  id            Int      @id @default(autoincrement())
  userId        Int      @unique
  apiKey        String
  # Ready for OAuth later:
  refreshToken  String?
  expiresAt     DateTime?
  workspaceId   String?
  user          User     @relation(fields:[userId], references:[id])
}

model Project {
  id             Int        @id @default(autoincrement())
  name           String
  slackChannelId String
  members        ProjectMember[]
  documents      Document[]
  transcripts    Transcript[]
}

model ProjectMember {
  id        Int    @id @default(autoincrement())
  projectId Int
  slackUid  String   // <@U…>
  display   String   // "Filip"
}

model Document {
  id         Int      @id @default(autoincrement())
  projectId  Int
  title      String
  text       String   // extracted plain text
  updatedAt  DateTime @updatedAt
}

model Transcript {
  id            Int      @id @default(autoincrement())
  projectId     Int
  ffId          String   @unique
  title         String
  date          DateTime
  tasks         Task[]
}

model Task {
  id            Int      @id @default(autoincrement())
  transcriptId  Int
  body          String
  assigneeUid   String?   // might be null if unmapped
  posted        Boolean   @default(false)
}
📡 API & webhook surface
Method	Path	Purpose
POST	/auth/slack	BetterAuth callback → sets HTTP-only cookie
POST	/fireflies/:userId	**Enhanced**: Main webhook – verify signature, **process with GenAI**, enqueue handleTranscript(userId, transcript_id)
GET	/api/projects	List projects for the logged-in user
POST	/api/projects	Create project (name, Slack channel)
POST	/api/projects/:id/members	Add team member (slackUid, display)
POST	/api/projects/:id/docs	Upload .docx (form-data)
POST	/api/user/fireflies	Save personal API key
POST	/api/user/fireflies/test	“Test connection” helper
POST	/api/ai/process-transcript	**NEW**: Process transcript with GenAI for enhanced summaries

All JSON; SPA lives under /.

Webhook handling flow (Enhanced with GenAI)
css
Copy
Edit
POST /fireflies/:userId
└─ verify x-fireflies-signature
└─ const cred = prisma.firefliesCredential.findUnique({ where:{ userId } })
└─ fetch transcript via GraphQL (using cred.apiKey)
└─ **NEW: GenAI Processing**
   ├─ Load project context (documents, team members)
   ├─ Generate intelligent summary with Gemini
   ├─ Extract enhanced action items with smart assignee detection
   └─ Format for optimal Slack presentation
└─ save Transcript + Task[] (with AI enhancements)
└─ slack.chat.postMessage( channel, AI-formatted message )
📑 Docx ingestion
Use mammoth (lib/docx.ts)

ts
Copy
Edit
import mammoth from 'mammoth';
export async function docxToText(buf: Buffer) {
  const { value } = await mammoth.extractRawText({ buffer: buf });
  return value;  // plain string
}
Store extracted text in Document.text.

Future: feed Document.text + latest transcript into LLM prompt to enrich tasks.

🕰️ Cron (optional right now)
jobs/refreshFirefliesTokens.ts – nightly npx ts-node … via Railway cron UI.

Looks for expiresAt < now + 10min, calls /oauth/token, updates row.

🚀 Deployment (Railway)
bash
Copy
Edit
railway init
railway up         # detects Dockerfile & deploys
railway.json already sets the webhook public URL in Fireflies console.

Set the env vars in Settings → Variables.

Add a cron job "0 4 * * * pnpm run cron:refresh-tokens".

🧱 Roadmap after MVP
OAuth connect (replace paste-key modal).

**Enhanced GenAI features**:
- Meeting sentiment analysis
- Automatic priority scoring for tasks
- Integration with project documents for context-aware processing
- Multi-language transcript support
LLM-powered task rewriting and smart scheduling suggestions.
Integration with calendar systems for meeting context.
