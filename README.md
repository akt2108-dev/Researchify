# 🔍 Researchify — Research Made Simple

> A multi-agent AI research pipeline that autonomously searches the web, scrapes content, writes comprehensive reports, and critiques them — powered by LangChain, OpenAI, Tavily, and FastAPI.

![Python](https://img.shields.io/badge/python-3.10%2B-blue) ![FastAPI](https://img.shields.io/badge/backend-FastAPI-009688)

<!-- 
  📸 Add your landing page screenshot here!
  1. Save it to assets/screenshot-landing.png in your repo
  2. Replace the line below with: ![Researchify landing page](assets/screenshot-landing.png)
  A short GIF of the live timeline / streaming output would showcase the SSE feature even better.
-->
<img width="1536" height="693" alt="Screenshot 2026-06-19 232316" src="https://github.com/user-attachments/assets/7d3054ca-eefb-496f-bb56-ff499a4e9135" />


## Table of Contents
- [Features](#-features)
- [How It Works](#-how-it-works)
- [Tech Stack](#-tech-stack)
- [Setup](#-setup-instructions)
- [Usage](#-usage)
- [Contributing](#-contributing)

## ✨ Features
- **Multi-Agent Pipeline** — distributes the research cognitive load across specialized AI agents (Search, Read, Write, Critic).
- **Streaming UI** — real-time feedback on pipeline steps via Server-Sent Events (SSE).
- **Interactive Shell** — a dynamic UI with a live timeline, streaming output, full-page reporting, and an auto-hide critic panel.
- **Save & Export** — copy the Markdown report to your clipboard or download it directly as a `.md` file.

## 🧠 How It Works
Researchify breaks research into four specialized stages, each handled by its own agent:

1. **Search Agent** — queries the web via Tavily to find relevant sources for the topic.
2. **Read Agent** — scrapes and digests content from the retrieved sources.
3. **Write Agent** — synthesizes findings into a structured, comprehensive report.
4. **Critic Agent** — reviews the draft report and flags gaps, inaccuracies, or weak reasoning.

Progress from each stage streams live to the frontend over SSE, so you see the pipeline working in real time rather than waiting on a single long request.

<!-- Optional: add an architecture diagram here once you have one, e.g. assets/architecture.png -->

## 🛠 Tech Stack
| Layer | Technology |
|---|---|
| Backend | Python, FastAPI, Uvicorn |
| AI / LLM Framework | LangChain, OpenAI |
| Search | Tavily Search Engine |
| Frontend | Vanilla HTML/JS/CSS, Marked.js, Lucide Icons |

## 🚀 Setup Instructions

### 1. Requirements
- Python 3.10+
- [OpenAI API Key](https://platform.openai.com/)
- [Tavily API Key](https://tavily.com/)

### 2. Installation
```bash
git clone https://github.com/your-username/researchify.git
cd researchify

# Create and activate a virtual environment
python -m venv venv
source venv/bin/activate   # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### 3. Environment Variables
Duplicate the provided `.env.example` to create your own `.env`:
```bash
cp .env.example .env
```
Then open `.env` and add your keys:
```ini
OPENAI_API_KEY="your-openai-api-key"
TAVILY_API_KEY="your-tavily-api-key"
```

### 4. Running the Application
```bash
uvicorn server:app --reload --port 8000
```
Then open **http://127.0.0.1:8000** in your browser.

## 📖 Usage
1. Enter a research topic or question in the input box.
2. Watch the live timeline as the Search → Read → Write → Critic agents work through the pipeline.
3. Once complete, review the full report alongside the critic's feedback panel.
4. Copy the Markdown to your clipboard or download it as a `.md` file.

## 🤝 Contributing
Contributions are welcome! Feel free to open an issue or submit a pull request.
1. Fork the repo
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Commit your changes
4. Open a pull request
