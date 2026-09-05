# Coolify / Docker: build from this repo root (Aira_Cloud), not the extension monorepo.
#   docker build -t aira-cloud .

FROM oven/bun:1.3

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

COPY . .

RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV PORT=7777
ENV SCHEDULER_DB=/app/data/scheduler.sqlite
EXPOSE 7777

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD bun -e 'const r=await fetch("http://127.0.0.1:"+(process.env.PORT||8787)+"/health"); if(!r.ok) process.exit(1)'

CMD ["bun", "run", "start"]
