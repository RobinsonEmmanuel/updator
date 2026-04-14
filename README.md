# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

## Deploy backend to Railway from GitLab CI

This project runs an Express backend with:

```bash
npm run server
```

The included `.gitlab-ci.yml` deploys to Railway on pushes to `main` using `@railway/cli`.

### 1) Create Railway token

- Railway -> avatar (bottom-left) -> `Account Settings` -> `Tokens` -> `Create Token`
- Copy token value

### 2) Add GitLab CI variables

In GitLab repo -> `Settings` -> `CI/CD` -> `Variables`, add:

- `RAILWAY_TOKEN` = your Railway token
- `RAILWAY_SERVICE_ID` = your Railway backend service ID

Recommended:

- Mark both as **Protected**
- Mark `RAILWAY_TOKEN` as **Masked**

### 3) Create empty backend service in Railway

- `New Project` -> `Empty Project`
- `Add Service` -> `Empty Service`
- Name it `backend`
- Open service settings and copy `Service ID`

### 4) Set Railway environment variables (service -> Variables)

- `MONGODB_URI=...`
- `REGIONLOVERS_API_READ_URL=...` (lecture RL)
- `REGIONLOVERS_API_WRITE_URL=...` (écriture RL future)
- `REGIONLOVERS_API_AUTH_URL=...` (optionnel, pour `/auth/login`)
- `REGIONLOVERS_API_URL=...` (fallback legacy)
- `RL_API_KEY=...` (if required by Region Lovers API)
- `ENVIRONMENT_MODE=true` or `ENVIRONMENT_MODE=false` (must be boolean-like string)
- `ENVIRONMENT_MODE_DEV_PASSWORD=...` (needed if `ENVIRONMENT_MODE=true`)
- `WP_CREDENTIALS_SECRET=...`
- `WP_PROXY_CACHE_TTL_MS=60000` (or your preferred TTL)

### 5) Start command in Railway

Service -> `Settings` -> `Deploy` -> `Start Command`:

```bash
npm run server
```

### 6) Generate domain and test

Service -> `Settings` -> `Networking` -> `Generate Domain`

Then verify:

```bash
https://<your-domain>.up.railway.app/api/health
```

Expected response contains `status: "ok"`.

## Deploy frontend (Vercel or Netlify)

The frontend can call the backend directly using `VITE_API_BASE_URL`.
This avoids relying on host-specific rewrite rules.

### Required frontend env vars

- `VITE_ENVIRONMENT_MODE=false` (or `true` if you intentionally use env mode)
- `VITE_API_BASE_URL=https://<your-backend>.up.railway.app`
- Do not use `*.railway.internal` in `VITE_API_BASE_URL` (private Railway network only).

### Build settings

- Build command: `npm run build`
- Output directory: `dist`

### Smoke test after deploy

- Open frontend URL
- Check login works
- Open browser devtools network tab
- Ensure API calls go to `https://<your-backend>.up.railway.app/api/...`
