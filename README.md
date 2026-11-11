# BaonBuddy Gemini chatbot setup

BaonBuddy includes a browser chat widget and a Python/Flask backend. The backend keeps the Gemini API key out of browser code and sends only aggregate income/expense totals plus up to eight expense category totals to Gemini—not individual transactions.

## Run locally

1. Install Python 3.10 or newer.
2. Create a Gemini API key in [Google AI Studio](https://aistudio.google.com/app/apikey).
3. In the project folder, create and activate a virtual environment, install dependencies, and create your local environment file:

   ```bash
   python -m venv .venv
   # macOS/Linux:
   source .venv/bin/activate
   # Windows PowerShell:
   .venv\\Scripts\\Activate.ps1
   pip install -r requirements.txt
   cp .env.example .env
   ```

4. Open `.env` and replace `GEMINI_API_KEY` with your own key. Keep `.env` private; it is ignored by Git. Change `GEMINI_MODEL` if needed to a model available for your AI Studio key.
5. Start the website and API:

   ```bash
   python server.py
   ```

6. Visit `http://localhost:3000`. Do not open `index.html` directly as a `file://` URL: the chat needs the backend endpoint.

## Deploy

GitHub Pages only serves static files; it cannot run the Python backend. Deploy this project to a Python host that supports environment variables, or deploy the backend separately and configure the frontend API URL for that host. Set `GEMINI_API_KEY`, `GEMINI_MODEL` (optional), and `PORT` (if required) in the host's environment. Keep the API key private.

The API includes request validation, an in-memory per-IP rate limit, a response timeout, and basic security headers. The development server built into Flask is not suitable for production; use the production WSGI server recommended by your hosting provider. For a public deployment, also consider persistent rate limiting and abuse monitoring.

## Privacy note

Chat messages are sent to the server and then to Google Gemini. The budgeting summary is generated in the browser and contains the PHP income total, expense total, balance, and up to eight expense category totals. Individual transactions are not included.
