<h1 align="center">DeepRef</h1>

A self-hosted PDF knowledge base. Sign in, upload PDFs, and ask questions about them in chats
that are saved and can be continued later. Answers are grounded in your documents and cite the
pages they came from. Admins can manage users and view usage analytics.

Everything runs locally: no external AI APIs.


| Service      | Tech | Notes |
|--------------|------|-------|
| `frontend`   | Next.js 16 (App Router, Cache Components), shadcn/ui, TanStack Query | JWT kept in an httpOnly cookie; never exposed to browser JS |
| `backend`    | FastAPI, async SQLAlchemy 2, Alembic, Pydantic v2, uv | JWT auth, RBAC, PDF ingestion, RAG, SSE streaming |
| `db`         | `pgvector/pgvector:pg17` | HNSW index, cosine distance |
| `minio`      | `cgr.dev/chainguard/minio` (pinned digest) | Private bucket; `minio-init` creates it plus a bucket-scoped app user |
| `llm`        | `ghcr.io/ggml-org/llama.cpp:server` | OpenAI-compatible API, model downloaded from Hugging Face on first start |
| `embeddings` | same image, `--embedding` mode | |

### How a question is answered

1. **Upload**: the PDF is validated (extension, `%PDF-` magic bytes, size limit), streamed to
   MinIO, and indexed in the background: text per page (pypdf) → overlapping chunks →
   embeddings → `document_chunks` table.
2. **Ask**: the question is embedded, the closest chunks from *your* ready documents (optionally
   limited to documents you pick per chat) are retrieved with pgvector, and SmolLM2 gets them as
   numbered passages plus recent chat history.
3. The answer streams back as Server-Sent Events (`sources`, `token`…, `done`) and is saved with
   its sources, token counts and latency (which feed the admin analytics). If you stop or close
   the tab mid-answer, the partial answer is still saved.

## Quick start

Requirements: Docker with Compose v2, ~4 GB free RAM.

```bash
cp .env.example .env
```

Edit `.env` and replace every `CHANGE_ME` value (`openssl rand -hex 32` for `SECRET_KEY`). Then:

```bash
docker compose up -d --build
```

The first start downloads the models (~1.1 GB) into the `models` volume; follow progress with
`docker compose logs -f llm`. Then open <http://localhost:3000> and sign in with
`FIRST_ADMIN_EMAIL` / `FIRST_ADMIN_PASSWORD` from `.env`.

- App: <http://localhost:3000>
- API docs (Swagger): <http://localhost:8000/api/v1/docs>
- MinIO console: <http://localhost:9001> (sign in with `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD`)

## Development

Backend (Python 3.13, [uv](https://docs.astral.sh/uv/)):

```bash
cd backend && uv sync && uv run pytest && uv run ruff check . && uv run mypy app
```

Frontend:

```bash
cd frontend && npm install && npm run lint && npm run build
```

To run the frontend with hot reload against the Dockerized backend, start everything except the
frontend and point `BACKEND_URL` at the exposed port:

```bash
docker compose up -d db llm embeddings backend
```

```bash
cd frontend && BACKEND_URL=http://localhost:8000 npm run dev
```

Database migrations run automatically when the backend starts. To add one after changing models:

```bash
docker compose exec backend alembic revision --autogenerate -m "describe change"
```

## What I learned

I started this thinking the hard part would be the AI. It turned out the model was the easy part
to get running and the hardest part to trust. Most of what I learned came from the gap between
"it works on my test PDF" and "it behaves when someone actually uses it".

### A small model needs the prompt shaped for it

SmolLM2-1.7B is surprisingly capable, but it's fussy. When I put the document passages in the
user message next to the question, it answered "How long should I charge the boots?" with the
boots' top speed. Moving the passages into the system message and leaving only the question in
the user turn fixed it. I had assumed prompt layout was cosmetic. With a model this size, it
decides whether the answer is right.

### Measure retrieval scores before trusting them

I set the relevance cutoff at 0.4 because it looked reasonable. Then I asked "Who is the CEO of
Apple?" against a tomato-farming guide. It pulled four tomato passages, and the model cheerfully
answered "Tim Cook" with tomato citations underneath. The embedding model (bge-small) squeezes
everything into a narrow range, so unrelated questions still scored between about 0.39 and 0.59,
while real questions scored 0.69 and up. Once I ran a few dozen questions of each kind, 0.62 was
the obvious line. Next time I'll write down twenty questions I expect to work and twenty I expect
to fail before picking any threshold.

### The safest answer is the one the model never writes

Telling the model "if the answer isn't in the passages, say so" didn't hold up. Sometimes it read
my instruction back to the user word for word. Now, if nothing passes the cutoff, the backend
sends a fixed reply and doesn't call the model at all. I also found that once that refusal sits in
the chat history, the model starts copying it into later answers that it could have answered, so
unanswered turns are left out of the history it sees.

Some things I couldn't prompt my way out of. Questions close to the documents' topic, like "How do
I grow potatoes?" against a tomato guide, score as high as genuine ones, and the model answers
them from memory whatever the system prompt says. That needs a bigger model, not a better sentence.

### Defaults can take a server down

The LLM container kept restarting with nothing useful in its logs. The kernel log showed the
out-of-memory killer had stopped it at 6.6 GB. llama.cpp keeps old prompts in RAM so it can reuse
them, and its default limit is 8 GB, which was the whole Docker VM. Every RAG prompt is different,
so the cache only ever grew. Two settings fixed it: a 512 MB cap on that cache and a memory limit
on the container. I now check how much memory a service is *allowed* to use, not just what it uses
on day one. And when a container dies silently, `dmesg` is worth checking before the app logs.

### Dependencies can disappear

I added MinIO for file storage and discovered the official Docker image had been pulled from
Docker Hub a few weeks earlier. I switched to Chainguard's build of it, pinned by digest, and
because the backend only speaks plain S3, moving to something like SeaweedFS later is mostly a
config change. Around the same time, the newest `@hookform/resolvers` had been out for a single
day and wouldn't install, while the version from a few weeks before installed fine. I now pin
exact versions and stay away from anything released in the last couple of weeks.

### The framework had moved on from what I knew

Next.js 16 renamed middleware to "proxy" and turns on Cache Components, which fails the build for
things that used to be fine: a shadcn skeleton calling `Math.random()` during render, and a sidebar
reading the URL without a `<Suspense>` boundary around it. The docs that ship inside
`node_modules/next` were more accurate than my memory, so now I read those first.

### Smaller things

- In TanStack Query v5, a disabled query reports `isPending`, so my "new chat" page sat on a
  loading skeleton forever. `isLoading` was what I actually wanted.
- Keeping the login token in an httpOnly cookie and proxying `/api` through Next.js means browser
  JavaScript never touches it. Streaming answers still work through that proxy, as long as the
  response body is passed straight through.
- Sharing one Zod schema between the React Hook Form forms and the server routes stops the client
  and server rules from drifting apart.
- A delete button with no loading state feels broken even when it works. Keeping the dialog open
  with "Deleting…" until the server answers made it feel solid.
- Deleting a document doesn't clean up everything that points at it: older chats can still hold
  its ID. I haven't fixed that yet, but it taught me that every delete needs a list of what
  references the thing being deleted.

If I built this again, I'd write the evaluation questions on day one, before the prompt or the
threshold, and I'd give every container a memory budget from the start.
