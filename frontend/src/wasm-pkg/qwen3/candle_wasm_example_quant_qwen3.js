/* @ts-self-types="./candle_wasm_example_quant_qwen3.d.ts" */

import * as wasm from "./candle_wasm_example_quant_qwen3_bg.wasm";
import { __wbg_set_wasm } from "./candle_wasm_example_quant_qwen3_bg.js";
__wbg_set_wasm(wasm);
wasm.__wbindgen_start();
export {
    Message, Model, ProfileStats, get_memory_info, get_wasm_memory_info, log_memory, log_wasm_memory, profile_clear, profile_enable, profile_get_stats, profile_print_stats
} from "./candle_wasm_example_quant_qwen3_bg.js";
