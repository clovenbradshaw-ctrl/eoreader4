// The converse holon: conversational provenance — the talker's output entering
// the fold as a deposition, never an injection.
//
// The talker's output is not barred from the fold. It enters as a different
// kind of event with a different witness, and the witness fixes how far it can
// travel: it can orient the next turn (session register) and it can warm the
// field, but it can never be cited as document provenance, never originate a
// committed reading on its own, and never author a typed relation. The witness
// type is the firewall; the subtract-and-check is the long-conversation guard.

export {
  TALKER, SPAN, CONVERSATIONAL_CAP,
  conversationalEvent, witnessOf, isCitableAsDocument,
  depositConversational, commitSurvives, corefPerception,
} from './provenance.js';

// The session-register fold — the conversation's own two registers (verbatim window
// + surfed recap), mirroring the document fold. (docs/session-fold.md)
export { foldConversation } from './history.js';

// Conversation-aware retrieval — resolve a thin / self-referential follow-up against
// the recent USER turns so it retrieves on the topic, not its literal words.
export { needsContext, conversationalFocus, resolveRetrievalQuery, contentWords } from './focus.js';
