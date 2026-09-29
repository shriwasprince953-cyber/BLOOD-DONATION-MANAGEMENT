# React + Vite

## RaktSetu setup and checks

Copy `.env.example` to `.env`, configure the Supabase project and API URL, then run `npm ci` and `npm run dev`.

Run `npm test`, `npm run lint` and `npm run build` for regression checks. Password recovery requires the frontend `/reset-password` URL in Supabase Auth's redirect allowlist.

Optional mocked browser checks: install Python Selenium, run Vite on `127.0.0.1:5179` with `VITE_SUPABASE_URL=https://test-project.supabase.co`, `VITE_SUPABASE_ANON_KEY=test-public-key` and `VITE_API_URL=http://127.0.0.1:8000/api/v1`, then run `python tests/browser_smoke.py`. These checks intercept auth/API requests and do not verify real Supabase credentials or email delivery.

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.
