# didyoureadthefine.ink

Agent Garden turns each uploaded PDF into a persistent document agent with saved analysis and conversation history. The app uses Next.js App Router, React, TypeScript, Tailwind CSS, Clerk, and MongoDB.

## Local development

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). With empty Clerk and MongoDB values, the app runs in single-user local mode with process-memory storage. Data survives refreshes while the development server remains running, but is cleared when that process restarts.

## Production configuration

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` enable Clerk sessions and the profile control.
- `MONGODB_URI` enables persistent, ownership-scoped agent storage.
- `MONGODB_DB_NAME` optionally changes the database name from `didyoureadthefine`.
- `GEMINI_API_KEY` enables topic-agent creation and Gemini chat responses.
- `GEMINI_MODEL` optionally selects the Gemini model and defaults to `gemini-3.8-flash`.

The garden supports Gemini-created topic agents and PDF document agents. The upload endpoint accepts text-based PDFs up to 10 pages and 5 MB. It extracts text for analysis but does not retain the original PDF.

## Checks

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Next.js notes

This project was bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
