---
name: "build-wasm"
description: "Builds the Rust WASM project using wasm-pack. Invoke when changes are made to the rust/wasm code or before running the frontend."
---

# Build WASM

This skill builds the Rust project in the `wasm` directory targeting the web.

## Usage

1.  Ensure you are in the project root.
2.  Run the following command:
    ```bash
    cd wasm && wasm-pack build --target web --out-dir ../frontend/src/wasm-pkg
    ```
