# Coolify: Base Directory = repository root, Dockerfile = cloud/Dockerfile
# Local:    docker build -f cloud/Dockerfile -t aira-cloud .

FROM oven/bun:1.3

WORKDIR /app

# Shared wire protocol imported as ../shared from cloud/
COPY shared ./shared

COPY cloud/package.json cloud/bun.lock ./cloud/
WORKDIR /app/cloud
RUN bun install --frozen-lockfile --production

COPY cloud .

ENV NODE_ENV=production
ENV PORT=8787
EXPOSE 8787

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD bun -e 'const r=await fetch("http://127.0.0.1:"+(process.env.PORT||8787)+"/health"); if(!r.ok) process.exit(1)'

CMD ["bun", "run", "start"]
