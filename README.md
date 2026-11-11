# BaonBuddy Gemini chatbot setup

BaonBuddy now includes a browser chat widget and a small Node.js backend. The backend keeps the Gemini API key out of browser code and sends only aggregate income/expense totals plus up to eight expense-category totals when a user sends a chat message. Individual transaction records and dates are not sent.

## Run locally

1. Install Node.js 18.18 or newer.
2. Create a Gemini API key in [Google AI Studio](https://aistudio.google.com/app/apikey).
3. In the project folder, install dependencies and create your local environment file:

   ```bash
   npm install
   cp .env.example .env
   ```

4. Open `.env` and replace `GEMINI_API_KEY` with your own key. Keep `.env` private; it is ignored by Git. Check Google AI Studio for the model IDs enabled for your key, and change `GEMINI_MODEL` if needed.
5. Start the website and API:

   ```bash
   npm start
   ```

6. Visit `http://localhost:3000`. Do not open `index.html` directly as a `file://` URL: the chat needs the backend endpoint.

## Deploy

GitHub Pages only serves static files; it cannot run `server.js`. Deploy this project to a Node.js host that supports environment variables, or deploy the backend separately and configure the frontend API URL and narrowly scoped CORS. Set `GEMINI_API_KEY` (and optionally `GEMINI_MODEL`) in the host's secret/environment-variable settings. Never commit a real key. Use HTTPS in production.

The API includes basic request validation, an in-memory per-IP rate limit, a response timeout, and Helmet security headers. For a public production deployment, add persistent rate limiting, abuse monitoring, and user authentication if appropriate. In-memory rate limiting resets when the server restarts and does not coordinate across multiple instances.

## Privacy note

Chat messages are sent to the server and then to Google Gemini. The budgeting summary is generated in the browser and contains the PHP income total, expense total, balance, and up to eight expense category totals. Avoid sending personal or sensitive details in chat. Check Google's current API terms and data-use settings before using real users' financial data. The assistant provides general budgeting information, not financial advice.
