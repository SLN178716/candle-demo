# Candle Demo Project

This project demonstrates running Rust-based machine learning models in the browser using [Candle](https://github.com/huggingface/candle), WASM, and Vue 3.

## Tech Stack

*   **Backend (WASM)**: Rust, Candle, wasm-bindgen
*   **Frontend**: Vue 3, TypeScript, Vite
*   **Package Manager**: pnpm
*   **Node Version**: 22.4.1 (managed by nvm)
*   **Code Style**: ESLint, Prettier

## Prerequisites

*   **Rust**: Install via [rustup](https://rustup.rs/).
*   **wasm-pack**: Install via `cargo install wasm-pack`.
*   **Node.js**: Install via [nvm](https://github.com/nvm-sh/nvm) (`nvm install` to use version from `.nvmrc`).
*   **pnpm**: Install via `npm install -g pnpm`.

## Project Structure

*   `wasm/`: Contains the Rust code and Candle logic compiled to WebAssembly.
*   `frontend/`: Contains the Vue 3 application that consumes the WASM module.

## Setup & Run

### 1. Build WASM Module

You need to build the WASM module first so the frontend can use it.

```bash
# Using project skill (if available)
# OR manually:
cd wasm
wasm-pack build --target web --out-dir ../frontend/src/wasm-pkg
```

### 2. Run Frontend

```bash
cd frontend
pnpm install
pnpm dev
```

## Development

*   **Linting**: `pnpm lint`
*   **Formatting**: `pnpm format` (if script configured)
