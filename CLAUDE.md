# Documenso Development Guide

## Commands
- Build: `npm run build`
- Dev: `npm run dev` (remix app) or `npm run d` (includes translation compile)
- Lint: `npm run lint` (check) or `npm run lint:fix` (auto-fix)
- Format: `npm run format` (prettier)
- Test: `npm run test:e2e` (all tests) or `npm run test:e2e -- -g "test name"` (single test)
- Setup: `npm run dx` (installs deps, starts docker, runs migrations & seeds)

## Code Style
- TypeScript for all code; favor interfaces over types; avoid enums, use maps
- Use functional/declarative patterns; avoid classes
- Named exports for components; lowercase with dashes for directories
- Function keyword for pure functions; early returns for error handling
- Use Zod for validation; proper error logging with user-friendly messages
- Tailwind CSS for styling with mobile-first approach
- Follow import order: React → Next → Third-party → Documenso → Local
- 100 character line length; 2-space indentation; trailing commas
- Conventional commit format (feat, fix, chore, etc.)
- Prefer React Server Components; minimize 'use client', 'useState', 'useEffect'