# Mercury Chat Viz

A modern AI-powered chat visualization application built with Next.js, React, Supabase, and DeepSeek.

## Tech Stack

- **Frontend**: Next.js 14, React, Tailwind CSS, shadcn/ui
- **Backend**: Supabase
- **AI**: DeepSeek (via ai-sdk)
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui
- **Authentication**: Supabase Auth
- **Database**: Supabase PostgreSQL

## Features

- Modern, responsive UI with shadcn/ui components
- Real-time data handling with Supabase
- AI-powered SQL and chart generation using DeepSeek
- Automatic LLM context caching for faster repeated queries
- Secure authentication
- Type-safe development with TypeScript
- Clean, slim codebase with unused components removed

## Getting Started

1. Clone the repository:

```bash
git clone https://github.com/balus444/mercury-chat-viz.git
```

2. Install dependencies:

```bash
npm install
```

3. Set up environment variables:
   Create a `.env.local` file with:

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
DEEPSEEK_API_KEY=your_deepseek_api_key
```

4. Run the development server:

```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## LLM Caching (DeepSeek)

DeepSeek provides automatic context caching for LLM calls. You can monitor cache hits/misses via the `providerMetadata` property in the AI response. This helps reduce latency and token costs for repeated queries.

## Contributing

Feel free to submit issues and enhancement requests!

## License

This project is licensed under the MIT License.
