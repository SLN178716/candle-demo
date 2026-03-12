use wasm_bindgen::prelude::*;

// 定义 WASM 绑定，允许 Rust 代码调用 JavaScript 的 console.log
#[wasm_bindgen]
extern "C" {
    // 将 Rust 的 log 函数映射到 JavaScript 的 console.log
    #[wasm_bindgen(js_namespace = console)]
    pub fn log(s: &str);
}

// 导出一个宏，方便在 Rust 中像使用 println! 一样打印日志到浏览器控制台
#[macro_export]
macro_rules! console_log {
    // 匹配任意参数，并将其格式化后传递给 console.log
    ($($t:tt)*) => ($crate::log(&format_args!($($t)*).to_string()))
}

pub mod m;
pub mod profiler;
