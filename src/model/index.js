// The model holon: swappable LLM backends + the embedder + the grounded prompt.
//
// Built-in backends are registered as a side-effect of importing this index.
// External backends call `registerBackend(name, factory)` at load time.

export { registerBackend, availableBackends, createModel } from './interface.js';
export { createHashEmbedder }   from './embed-hash.js';
export { createMiniLMEmbedder } from './embed.js';
export { buildGroundedMessages, buildChatMessages, SYSTEM_GROUND, SYSTEM_CHAT,
         orientationLine, EXCERPTS_HEADER, DEFAULT_BUDGET, SUMMARY_GUARD } from './prompt.js';

import './echo.js';
import './wllama.js';
import './pleias.js';
import './webllm.js';
