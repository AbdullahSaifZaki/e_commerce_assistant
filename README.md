# E-commerce assistant demo backend

The backend runs from `main:app`. It needs MySQL for the catalog, FAQs, and
demo orders; PostgreSQL for conversation checkpoints; and Redis/Valkey for
rate limits. Cloud Run can build the repository root with the Python buildpack
and start it with `uvicorn main:app --host 0.0.0.0 --port 8080`.

## Prepare a new demo MySQL database

Create an empty MySQL database and set `ECOMMERCE_DATABASE_URL` to its
SQLAlchemy connection URL (using the `mysql+pymysql://` scheme). From the
repository root, run:

```sh
python -m database.seed_demo
```

The script creates the required tables and inserts four synthetic products,
six variants, four FAQs, and two fake orders (`900001` and `900002`). It adds
data only when all four tables are empty. Running it against a database that
already contains any of these records makes no data changes. It does not
upgrade the schema of an existing database.

Do not copy local customer orders into a public demo. Keep database URLs and
API keys in private environment variables, not in Git. The app creates its
LangGraph PostgreSQL checkpoint tables on startup.

## Backend environment variables

| Name | Purpose |
| --- | --- |
| `ECOMMERCE_DATABASE_URL` | MySQL URL with the `mysql+pymysql://` scheme |
| `MEMORY_DATABASE_URL` | PostgreSQL URL for LangGraph checkpoints |
| `REDIS_URL` | Redis/Valkey URL; use `rediss://` for TLS |
| `OPENAI_API_KEY` | OpenAI API credential |
| `AUTH0_DOMAIN` | Auth0 tenant domain |
| `AUTH0_AUDIENCE` | Auth0 API audience |
| `CORS_ORIGINS` | Comma-separated frontend origins, such as `https://askaisle.site` |

The Vercel frontend should set `VITE_API_URL` to the Cloud Run HTTPS URL
followed by `/chat`, then redeploy.
