# Researchify (Research made Simple)

A multi-agent AI research pipeline that autonomously searches the web, scrapes content, writes comprehensive reports, and critiques them. Powered by LangChain, OpenAI, Tavily, and FastAPI.

## Features

- **Multi-Agent Pipeline**: Distributes the research cognitive load across specialized AI agents (Search, Read, Write, Critic).
- **Streaming UI**: Real-time feedback on pipeline steps via Server-Sent Events (SSE).
- **Interactive UI**: A dynamic shell with a live timeline, streaming output, full-page reporting, and an auto-hide critic panel.
- **Save & Export**: Copy the Markdown report to your clipboard or download it directly as a `.md` file.

## Setup Instructions

### 1. Requirements

- Python 3.10+
- [OpenAI API Key](https://platform.openai.com/)
- [Tavily API Key](https://tavily.com/)

### 2. Installation

Clone the repository and install the required dependencies:

```bash
git clone https://github.com/your-username/researchify.git
cd researchify

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows use `venv\Scripts\activate`

# Install requirements
pip install -r requirements.txt
```

### 3. Environment Variables

Create your `.env` file by duplicating the provided `.env.example`:

```bash
cp .env.example .env
```

Open `.env` and fill in your API keys:

```ini
OPENAI_API_KEY="your-openai-api-key"
TAVILY_API_KEY="your-tavily-api-key"
```

### 4. Running the Application

Start the FastAPI application using Uvicorn:

```bash
uvicorn server:app --reload --port 8000
```

Once running, navigate to `http://127.0.0.1:8000` in your web browser.

## Tech Stack

- **Backend**: Python, FastAPI, Uvicorn
- **AI / LLM Framework**: LangChain, OpenAI
- **Search capabilities**: Tavily Search Engine 
- **Frontend**: Vanilla HTML/JS/CSS, Marked.js (Markdown parsing), Lucide Icons
