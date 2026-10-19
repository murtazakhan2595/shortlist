// Technologies a draft may only name if the owner's profile or answer bank does (X4).
// Checked by code, before any model review: naming a tool the owner has not used is the most common
// way a generated application claims too much. Add a term here when a post brings up a new one.
// A draft must write a term as it is written here ("Express", not "express"), so ordinary words are not
// mistaken for tools. "Go" is left out for that reason: "happy to go through it" is not a claim.

export const TECH_TERMS = [
  // Languages
  "TypeScript", "JavaScript", "Python", "Java", "Kotlin", "Swift", "Golang", "Rust", "C#", "C++", "Ruby",
  "PHP", "Scala", "Elixir", "Dart", "SQL",
  // Front end and mobile
  "React", "React Native", "Next.js", "Vue", "Nuxt", "Angular", "Svelte", "Redux", "Tailwind", "Flutter",
  "Expo", "Remix", "Astro", "jQuery",
  // Back end
  "Node.js", "NestJS", "Express", "Fastify", "Django", "Flask", "FastAPI", "Spring", "Laravel", "Rails",
  ".NET", "GraphQL", "gRPC", "tRPC", "Prisma", "Drizzle", "TypeORM", "Sequelize",
  // Data stores and messaging
  "PostgreSQL", "Postgres", "MySQL", "MongoDB", "Redis", "DynamoDB", "Elasticsearch", "Cassandra", "SQLite",
  "Supabase", "Firebase", "Kafka", "RabbitMQ", "SQS", "BigQuery", "Snowflake",
  // Cloud and delivery
  "AWS", "Azure", "GCP", "Google Cloud", "Lambda", "Docker", "Kubernetes", "Terraform", "Vercel", "Netlify",
  "GitHub Actions", "Jenkins", "CircleCI", "Ansible",
  // AI and data
  "LangChain", "LangGraph", "LlamaIndex", "CrewAI", "OpenAI", "Hugging Face", "PyTorch", "TensorFlow",
  "scikit-learn", "Pandas", "RAG", "pgvector", "Pinecone", "Weaviate", "Qdrant", "Chroma", "MCP",
  // Testing
  "Jest", "Vitest", "Playwright", "Cypress", "Selenium",
] as const;
