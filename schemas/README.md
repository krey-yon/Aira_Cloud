# schemas/

Named Zod objects for HTTP, WebSocket, and domain entities in aira-on-cloud. Types are `z.infer` of those objects. Tool `inputSchema`s stay in `src/tools/` for now.

## Rules

1. Boundary shapes live here. SQLite row structs, React props, and vendor Google or Notion payloads stay in their modules.
2. Zod is the single source of truth. Do not add a parallel TypeScript interface next to a schema.
3. Validate at doors with `Schema.parse` or `Schema.safeParse`. Do not invent a `parseAt` helper.

## Add a schema

1. Put the Zod object in the domain file that owns the concept.
2. Export the const and `type Name = z.infer<typeof Name>`.
3. Add the const to `schemas` in `index.ts`, or to `secretSchemas` if it carries tokens.
4. Add a catalog row in `catalog.ts`.
5. Add one valid fixture and one reject fixture in `schemas.test.ts`.
