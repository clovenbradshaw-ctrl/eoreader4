// Chat models for the reader — the same backends the original chat app used.
// Kept slim on purpose: echo (instant, offline) and webllm (Llama-3.2-3B over
// WebGPU, the old default) only. Both register on import; neither pulls anything
// from a CDN until load() runs. The reader stays LLM-free for reading and the
// grounded panel — a model is only loaded when you actually chat, and chat falls
// back to a structural answer if no model is available.
export { createModel } from '../model/interface.js';
export { streamPhrase } from '../model/stream.js';
export { buildChatMessages, buildGroundedMessages, shapeForScope, LIBRARIAN_CUE, CURRENCY_CUE } from '../model/prompt.js';
import '../model/echo.js';
import '../model/webllm.js';
