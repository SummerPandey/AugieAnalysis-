# Augie Analysis

A web dashboard for running marketing mix modeling (MMM) on Augustana College admissions marketing data.

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)

## Overview

Augie Analysis is the frontend for an MMM tool built for Augustana's admissions marketing team. It estimates how much each marketing channel (Meta, Snapchat, Google, billboards, and seasonality) contributes to applications, using weekly spend and outcome data rather than click-level tracking.

The app works in two modes:

- **Signed in:** runs the real model through a separate FastAPI backend and shows results from live Augustana data.
- **Demo:** "Continue without an account" runs the same workflow against a simulated dataset, so the interface can be explored without backend access.

This repository contains only the frontend. The backend (FastAPI with Supabase) lives elsewhere and must be running for sign-in, live results, and the chat assistant.

## Features

- Email and password sign-in against the backend, with the session token kept in `sessionStorage`
- Six-step MMM workflow (Import, Map Columns, Select, Configure, Run, Results) with a progress stepper
- Live results from the backend's Ridge regression pipeline:
  - In-sample R², cross-validated R², MAE, and the auto-tuned Ridge alpha
  - Actual vs. modeled weekly applications and channel contribution over time
  - Standardized model coefficients
  - Multicollinearity diagnostics (VIF, condition number) and Durbin-Watson
  - Spend coverage warnings when channel data does not span the full date range
  - AI-generated commentary on the results, rendered as Markdown
- Demo results with channel contribution, ROI and saturation curves, budget recommendations, and model quality
- Chat assistant for questions about MMM and Augustana's marketing data
- Charts built with Recharts, styled in Augustana's navy and gold

## Tech Stack

- React 19 and TypeScript
- Vite 8
- Tailwind CSS 4
- Recharts
- oxfmt for formatting

## Getting Started

### Prerequisites

- Node.js 22
- pnpm 10 (versions are pinned in `.mise.toml`)
- The Augie Analysis backend running locally or deployed, for sign-in and live results

### Setup

```bash
git clone https://github.com/SummerPandey/AugieAnalysis-.git
cd AugieAnalysis-
pnpm install
cp .env.example .env
pnpm dev
```

The dev server runs on port 8443 by default. Set the `PORT` environment variable to use a different one.

### Environment Variables

| Name           | Description                                                   |
| -------------- | ------------------------------------------------------------- |
| `VITE_API_URL` | Base URL of the backend. Defaults to `http://localhost:8000`. |

### Scripts

| Command        | Description                          |
| -------------- | ------------------------------------ |
| `pnpm dev`     | Start the Vite dev server            |
| `pnpm build`   | Build for production into `dist/`    |
| `pnpm preview` | Serve the production build locally   |
| `pnpm format`  | Format the code with oxfmt           |

## Project Structure

```
.
├── .figma/make/      # Figma Make build, deploy, and site configuration
├── src/
│   ├── App.tsx       # Loading screen, landing/sign-in, analysis picker, chat widget
│   ├── mmm.tsx       # MMM workflow steps, charts, and results views
│   ├── api.ts        # Typed client for the backend API
│   ├── index.css     # Tailwind import and global styles
│   └── main.tsx      # React entry point
├── index.html
└── vite.config.ts
```

The project was scaffolded with Figma Make, so `vite.config.ts` includes a few Figma-specific plugins and reads page metadata from `.figma/make/site.json`.
