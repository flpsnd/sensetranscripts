# Simple Meeting Notes Processor

This demo project shows a minimal setup for uploading meeting context and processing it with GenAI.

## Features

- Google login using Passport
- Upload `.docx` files and plain text notes
- Store a Fireflies API key and list of Slack usernames
- Basic API endpoints to save and retrieve this context

## Usage

1. Install dependencies

```bash
./setup.sh
```

2. Set environment variables for Google OAuth:

```bash
export GOOGLE_CLIENT_ID=your_id
export GOOGLE_CLIENT_SECRET=your_secret
```

3. Start the server

```bash
npm start
```

Open `http://localhost:3000` and sign in with Google. Upload a `.docx` file, provide notes, your Fireflies API key and Slack usernames. The data is stored in memory and can be processed via `/api/ai/process` (placeholder).
