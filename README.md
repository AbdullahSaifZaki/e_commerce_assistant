# Aisle — AI Shopping Assistant

A conversational shopping assistant that helps customers find and compare products, track orders, and understand store policies.

## Aisle UI
![Demo](media/demo.png)

## Demo
View the latest demo video [here](media/video_demo.mp4)

Check the website [Aisle.com](https://askaisle.site/)

## How it works

1. **Receive the message:** A JavaScript frontend sends authenticated requests to FastAPI. Auth0 verifies login, and Redis limits requests.
2. **Choose the tools:** GPT-5.4 Nano uses LangChain to select product search, order lookup, or FAQ search. One message can trigger multiple tools.
3. **Retrieve information:** SQLAlchemy queries MySQL. Product search combines structured filters with semantic ranking; FAQ search retrieves relevant answers. Both use `all-MiniLM-L6-v2` embeddings and NumPy similarity calculations.
4. **Reply with context:** The model turns retrieved information into a conversational answer. LangGraph saves conversation checkpoints in PostgreSQL and trims the agent’s conversation context to approximately 4,000 tokens.

The assistant retrieves information; it cannot place orders, process payments, or modify orders.

## Run locally

### 1. Get the project

Install **Git**, **Python 3.11**, **Node.js 22.12+**, and **MySQL**, then run:

```bash
git clone https://github.com/abdullahsaifomairi/e_commerce_assistant.git
cd e_commerce_assistant
```

You also need an **OpenAI API key**, an **Auth0 account**, a **PostgreSQL database**, and **Redis with TLS**.

### 2. Set up MySQL

Start MySQL, then create a database and import the tables and sample data:

```bash
mysql -u root -p -e "CREATE DATABASE aisle;"
mysql -u root -p aisle < database/setup.sql
```

Enter your MySQL password when prompted. Replace `root` if you use a different MySQL username.

> These commands require `database/setup.sql` to be included in the repository. Import into a new database because the file may replace existing tables.

### 3. Configure the backend

Copy the environment template:

```bash
cp .env.example .env
```

Fill in `.env` with your credentials:

```dotenv
OPENAI_API_KEY=YOUR_OPENAI_API_KEY
ECOMMERCE_DATABASE_URL=mysql+pymysql://USER:PASSWORD@localhost:3306/aisle
MEMORY_DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE
REDIS_URL=rediss://default:PASSWORD@HOST:PORT
AUTH0_DOMAIN=YOUR_TENANT.auth0.com
AUTH0_AUDIENCE=https://api.aisle.app
```

`USER` and `PASSWORD` are your database credentials. `HOST` is the database server address; use `localhost` when it runs on your computer. PostgreSQL checkpoint tables are created automatically.

### 4. Configure login

In Auth0, create a **Single Page Application** and an **API** with identifier `https://api.aisle.app` and signing algorithm **RS256**. Allow the application to access that API.

Set the application URLs:

| Setting | Value |
|---|---|
| Allowed Callback URLs | `http://127.0.0.1:8770/` |
| Allowed Logout URLs | `http://127.0.0.1:8770/` |
| Allowed Web Origins | `http://127.0.0.1:8770` |

Create `aisle_frontend/.env.local`:

```dotenv
VITE_AUTH0_DOMAIN=YOUR_TENANT.auth0.com
VITE_AUTH0_CLIENT_ID=YOUR_APPLICATION_CLIENT_ID
VITE_AUTH0_AUDIENCE=https://api.aisle.app
VITE_API_URL=/api/chat
```

Use the same Auth0 domain and audience in both environment files.

### 5. Start the backend

From the project’s main folder:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

On Windows, use `python` instead of `python3` and activate with `.venv\Scripts\Activate.ps1`.

The first launch downloads the embedding model, so startup may take longer.

### 6. Start the frontend

Open a second terminal in the project’s main folder:

```bash
cd aisle_frontend
npm ci
npm run dev
```



Keep both terminals open while using the app. Press **Ctrl+C** in each to stop it.



