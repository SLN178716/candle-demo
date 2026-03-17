/**
 * A chat message with role and content
 */
export class Message {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        MessageFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_message_free(ptr, 0);
    }
    /**
     * Get the message content
     * @returns {string}
     */
    get content() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.message_content(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * Create a new message with the given role and content
     * @param {string} role
     * @param {string} content
     */
    constructor(role, content) {
        const ptr0 = passStringToWasm0(role, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(content, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        const ret = wasm.message_new(ptr0, len0, ptr1, len1);
        this.__wbg_ptr = ret >>> 0;
        MessageFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * Get the message role
     * @returns {string}
     */
    get role() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.message_role(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
}
if (Symbol.dispose) Message.prototype[Symbol.dispose] = Message.prototype.free;

/**
 * Model 结构体封装了 Qwen3 量化模型及其相关组件
 * 通过 #[wasm_bindgen] 导出给 JavaScript 使用
 */
export class Model {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        ModelFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_model_free(ptr, 0);
    }
    /**
     * 发送用户消息并准备生成回复。
     *
     * 此方法通过仅对新内容进行分词来高效重用 KV 缓存：
     * - 第一轮：对完整提示词（系统+用户+助手开始）进行分词
     * - 后续轮次：仅对续写部分（关闭上一轮+新用户+助手开始）进行分词
     *
     * `enable_thinking` 参数控制此特定消息是否使用思考模式。
     * @param {string} user_message
     * @param {number} temp
     * @param {number} top_p
     * @param {number} repeat_penalty
     * @param {number} repeat_last_n
     * @param {number} seed
     * @param {boolean} enable_thinking
     * @returns {string}
     */
    chat(user_message, temp, top_p, repeat_penalty, repeat_last_n, seed, enable_thinking) {
        let deferred3_0;
        let deferred3_1;
        try {
            const ptr0 = passStringToWasm0(user_message, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len0 = WASM_VECTOR_LEN;
            const ret = wasm.model_chat(this.__wbg_ptr, ptr0, len0, temp, top_p, repeat_penalty, repeat_last_n, seed, enable_thinking);
            var ptr2 = ret[0];
            var len2 = ret[1];
            if (ret[3]) {
                ptr2 = 0; len2 = 0;
                throw takeFromExternrefTable0(ret[2]);
            }
            deferred3_0 = ptr2;
            deferred3_1 = len2;
            return getStringFromWasm0(ptr2, len2);
        } finally {
            wasm.__wbindgen_free(deferred3_0, deferred3_1, 1);
        }
    }
    /**
     * 清空对话历史但保留系统提示词。
     * 也会清空 KV 缓存，因为我们是重新开始。
     */
    clear_conversation() {
        wasm.model_clear_conversation(this.__wbg_ptr);
    }
    /**
     * 结束当前轮次并记录助手的回复。
     * 生成的 token 会保留在 KV 缓存中供下一轮使用。
     */
    end_turn() {
        wasm.model_end_turn(this.__wbg_ptr);
    }
    /**
     * 一次性生成多个 token。
     * @param {number} count
     * @returns {string}
     */
    generate_tokens(count) {
        let deferred2_0;
        let deferred2_1;
        try {
            const ret = wasm.model_generate_tokens(this.__wbg_ptr, count);
            var ptr1 = ret[0];
            var len1 = ret[1];
            if (ret[3]) {
                ptr1 = 0; len1 = 0;
                throw takeFromExternrefTable0(ret[2]);
            }
            deferred2_0 = ptr1;
            deferred2_1 = len1;
            return getStringFromWasm0(ptr1, len1);
        } finally {
            wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
        }
    }
    /**
     * 获取当前 KV 缓存中的 token 数量。
     * @returns {number}
     */
    get_cached_token_count() {
        const ret = wasm.model_get_cached_token_count(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * 获取 JSON 格式的对话历史。
     * @returns {string}
     */
    get_conversation_json() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.model_get_conversation_json(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * 获取对话中的消息数量。
     * @returns {number}
     */
    get_message_count() {
        const ret = wasm.model_get_message_count(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * 获取 KV 缓存中的总 token 数量。
     * @returns {number}
     */
    get_token_count() {
        const ret = wasm.model_get_token_count(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * 检查上一个生成的 token 是否为 EOS。
     * @returns {boolean}
     */
    is_eos() {
        const ret = wasm.model_is_eos(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * 构造函数：加载模型权重和分词器配置
     * weights: GGUF 格式的模型权重数据
     * tokenizer: 分词器配置文件数据
     * _config: 模型配置文件数据（目前未使用）
     * @param {Uint8Array} weights
     * @param {Uint8Array} tokenizer
     * @param {Uint8Array} _config
     */
    constructor(weights, tokenizer, _config) {
        const ptr0 = passArray8ToWasm0(weights, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passArray8ToWasm0(tokenizer, wasm.__wbindgen_malloc);
        const len1 = WASM_VECTOR_LEN;
        const ptr2 = passArray8ToWasm0(_config, wasm.__wbindgen_malloc);
        const len2 = WASM_VECTOR_LEN;
        const ret = wasm.model_load(ptr0, len0, ptr1, len1, ptr2, len2);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        this.__wbg_ptr = ret[0] >>> 0;
        ModelFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * 生成下一个 token。
     * @returns {string}
     */
    next_token() {
        let deferred2_0;
        let deferred2_1;
        try {
            const ret = wasm.model_next_token(this.__wbg_ptr);
            var ptr1 = ret[0];
            var len1 = ret[1];
            if (ret[3]) {
                ptr1 = 0; len1 = 0;
                throw takeFromExternrefTable0(ret[2]);
            }
            deferred2_0 = ptr1;
            deferred2_1 = len1;
            return getStringFromWasm0(ptr1, len1);
        } finally {
            wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
        }
    }
    /**
     * 完全重置模型（清空 KV 缓存和所有状态）。
     */
    reset() {
        wasm.model_reset(this.__wbg_ptr);
    }
    /**
     * 初始化一个新的对话，设置系统提示词和选项。
     * 这会清空 KV 缓存并重新开始。
     * system_prompt: 可选的自定义系统提示词
     * enable_thinking: 是否启用思考模式
     * @param {string | null | undefined} system_prompt
     * @param {boolean} enable_thinking
     */
    start_conversation(system_prompt, enable_thinking) {
        var ptr0 = isLikeNone(system_prompt) ? 0 : passStringToWasm0(system_prompt, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        var len0 = WASM_VECTOR_LEN;
        wasm.model_start_conversation(this.__wbg_ptr, ptr0, len0, enable_thinking);
    }
    /**
     * 从 tokenizer_config.json 内容加载对话模板。
     * tokenizer_config_json: 分词器配置文件的 JSON 字符串
     * @param {string} tokenizer_config_json
     * @param {string | null | undefined} system_prompt
     * @param {boolean} enable_thinking
     */
    start_conversation_from_config(tokenizer_config_json, system_prompt, enable_thinking) {
        const ptr0 = passStringToWasm0(tokenizer_config_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        var ptr1 = isLikeNone(system_prompt) ? 0 : passStringToWasm0(system_prompt, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        var len1 = WASM_VECTOR_LEN;
        const ret = wasm.model_start_conversation_from_config(this.__wbg_ptr, ptr0, len0, ptr1, len1, enable_thinking);
        if (ret[1]) {
            throw takeFromExternrefTable0(ret[0]);
        }
    }
}
if (Symbol.dispose) Model.prototype[Symbol.dispose] = Model.prototype.free;

export class ProfileStats {
    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(ProfileStats.prototype);
        obj.__wbg_ptr = ptr;
        ProfileStatsFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        ProfileStatsFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_profilestats_free(ptr, 0);
    }
    /**
     * @returns {string}
     */
    get json() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.profilestats_json(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
}
if (Symbol.dispose) ProfileStats.prototype[Symbol.dispose] = ProfileStats.prototype.free;

/**
 * @returns {string}
 */
export function get_memory_info() {
    let deferred1_0;
    let deferred1_1;
    try {
        const ret = wasm.get_memory_info();
        deferred1_0 = ret[0];
        deferred1_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
}

/**
 * @returns {string}
 */
export function get_wasm_memory_info() {
    let deferred1_0;
    let deferred1_1;
    try {
        const ret = wasm.get_wasm_memory_info();
        deferred1_0 = ret[0];
        deferred1_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
}

export function log_memory() {
    wasm.log_memory();
}

export function log_wasm_memory() {
    wasm.log_wasm_memory();
}

export function profile_clear() {
    wasm.profile_clear();
}

/**
 * @param {boolean} enabled
 */
export function profile_enable(enabled) {
    wasm.profile_enable(enabled);
}

/**
 * @returns {ProfileStats}
 */
export function profile_get_stats() {
    const ret = wasm.profile_get_stats();
    return ProfileStats.__wrap(ret);
}

export function profile_print_stats() {
    wasm.profile_print_stats();
}
export function __wbg_Error_83742b46f01ce22d(arg0, arg1) {
    const ret = Error(getStringFromWasm0(arg0, arg1));
    return ret;
}
export function __wbg___wbindgen_is_undefined_52709e72fb9f179c(arg0) {
    const ret = arg0 === undefined;
    return ret;
}
export function __wbg___wbindgen_number_get_34bb9d9dcfa21373(arg0, arg1) {
    const obj = arg1;
    const ret = typeof(obj) === 'number' ? obj : undefined;
    getDataViewMemory0().setFloat64(arg0 + 8 * 1, isLikeNone(ret) ? 0 : ret, true);
    getDataViewMemory0().setInt32(arg0 + 4 * 0, !isLikeNone(ret), true);
}
export function __wbg___wbindgen_throw_6ddd609b62940d55(arg0, arg1) {
    throw new Error(getStringFromWasm0(arg0, arg1));
}
export function __wbg_error_a6fa202b58aa1cd3(arg0, arg1) {
    let deferred0_0;
    let deferred0_1;
    try {
        deferred0_0 = arg0;
        deferred0_1 = arg1;
        console.error(getStringFromWasm0(arg0, arg1));
    } finally {
        wasm.__wbindgen_free(deferred0_0, deferred0_1, 1);
    }
}
export function __wbg_getRandomValues_3f44b700395062e5() { return handleError(function (arg0, arg1) {
    globalThis.crypto.getRandomValues(getArrayU8FromWasm0(arg0, arg1));
}, arguments); }
export function __wbg_get_3ef1eba1850ade27() { return handleError(function (arg0, arg1) {
    const ret = Reflect.get(arg0, arg1);
    return ret;
}, arguments); }
export function __wbg_instanceof_Window_56b07700cf73649e(arg0) {
    let result;
    try {
        result = arg0 instanceof Window;
    } catch (_) {
        result = false;
    }
    const ret = result;
    return ret;
}
export function __wbg_log_0c4d838228f90ba4(arg0, arg1) {
    console.log(getStringFromWasm0(arg0, arg1));
}
export function __wbg_log_abb675f177d72f1f(arg0) {
    console.log(arg0);
}
export function __wbg_new_227d7c05414eb861() {
    const ret = new Error();
    return ret;
}
export function __wbg_now_16f0c993d5dd6c27() {
    const ret = Date.now();
    return ret;
}
export function __wbg_performance_ca858d9982faf20a(arg0) {
    const ret = arg0.performance;
    return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
}
export function __wbg_stack_3b0d974bbf31e44f(arg0, arg1) {
    const ret = arg1.stack;
    const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len1 = WASM_VECTOR_LEN;
    getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
    getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
}
export function __wbg_static_accessor_GLOBAL_8adb955bd33fac2f() {
    const ret = typeof global === 'undefined' ? null : global;
    return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
}
export function __wbg_static_accessor_GLOBAL_THIS_ad356e0db91c7913() {
    const ret = typeof globalThis === 'undefined' ? null : globalThis;
    return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
}
export function __wbg_static_accessor_SELF_f207c857566db248() {
    const ret = typeof self === 'undefined' ? null : self;
    return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
}
export function __wbg_static_accessor_WINDOW_bb9f1ba69d61b386() {
    const ret = typeof window === 'undefined' ? null : window;
    return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
}
export function __wbg_warn_5f417c53938aa0c1(arg0) {
    console.warn(arg0);
}
export function __wbindgen_cast_0000000000000001(arg0, arg1) {
    // Cast intrinsic for `Ref(String) -> Externref`.
    const ret = getStringFromWasm0(arg0, arg1);
    return ret;
}
export function __wbindgen_init_externref_table() {
    const table = wasm.__wbindgen_externrefs;
    const offset = table.grow(4);
    table.set(0, undefined);
    table.set(offset + 0, undefined);
    table.set(offset + 1, null);
    table.set(offset + 2, true);
    table.set(offset + 3, false);
}
const MessageFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_message_free(ptr >>> 0, 1));
const ModelFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_model_free(ptr >>> 0, 1));
const ProfileStatsFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_profilestats_free(ptr >>> 0, 1));

function addToExternrefTable0(obj) {
    const idx = wasm.__externref_table_alloc();
    wasm.__wbindgen_externrefs.set(idx, obj);
    return idx;
}

function getArrayU8FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getUint8ArrayMemory0().subarray(ptr / 1, ptr / 1 + len);
}

let cachedDataViewMemory0 = null;
function getDataViewMemory0() {
    if (cachedDataViewMemory0 === null || cachedDataViewMemory0.buffer.detached === true || (cachedDataViewMemory0.buffer.detached === undefined && cachedDataViewMemory0.buffer !== wasm.memory.buffer)) {
        cachedDataViewMemory0 = new DataView(wasm.memory.buffer);
    }
    return cachedDataViewMemory0;
}

function getStringFromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return decodeText(ptr, len);
}

let cachedUint8ArrayMemory0 = null;
function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

function handleError(f, args) {
    try {
        return f.apply(this, args);
    } catch (e) {
        const idx = addToExternrefTable0(e);
        wasm.__wbindgen_exn_store(idx);
    }
}

function isLikeNone(x) {
    return x === undefined || x === null;
}

function passArray8ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 1, 1) >>> 0;
    getUint8ArrayMemory0().set(arg, ptr / 1);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

function passStringToWasm0(arg, malloc, realloc) {
    if (realloc === undefined) {
        const buf = cachedTextEncoder.encode(arg);
        const ptr = malloc(buf.length, 1) >>> 0;
        getUint8ArrayMemory0().subarray(ptr, ptr + buf.length).set(buf);
        WASM_VECTOR_LEN = buf.length;
        return ptr;
    }

    let len = arg.length;
    let ptr = malloc(len, 1) >>> 0;

    const mem = getUint8ArrayMemory0();

    let offset = 0;

    for (; offset < len; offset++) {
        const code = arg.charCodeAt(offset);
        if (code > 0x7F) break;
        mem[ptr + offset] = code;
    }
    if (offset !== len) {
        if (offset !== 0) {
            arg = arg.slice(offset);
        }
        ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
        const view = getUint8ArrayMemory0().subarray(ptr + offset, ptr + len);
        const ret = cachedTextEncoder.encodeInto(arg, view);

        offset += ret.written;
        ptr = realloc(ptr, len, offset, 1) >>> 0;
    }

    WASM_VECTOR_LEN = offset;
    return ptr;
}

function takeFromExternrefTable0(idx) {
    const value = wasm.__wbindgen_externrefs.get(idx);
    wasm.__externref_table_dealloc(idx);
    return value;
}

let cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
cachedTextDecoder.decode();
const MAX_SAFARI_DECODE_BYTES = 2146435072;
let numBytesDecoded = 0;
function decodeText(ptr, len) {
    numBytesDecoded += len;
    if (numBytesDecoded >= MAX_SAFARI_DECODE_BYTES) {
        cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
        cachedTextDecoder.decode();
        numBytesDecoded = len;
    }
    return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

const cachedTextEncoder = new TextEncoder();

if (!('encodeInto' in cachedTextEncoder)) {
    cachedTextEncoder.encodeInto = function (arg, view) {
        const buf = cachedTextEncoder.encode(arg);
        view.set(buf);
        return {
            read: arg.length,
            written: buf.length
        };
    };
}

let WASM_VECTOR_LEN = 0;


let wasm;
export function __wbg_set_wasm(val) {
    wasm = val;
}
