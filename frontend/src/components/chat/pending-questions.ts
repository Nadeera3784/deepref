/**
 * Hands the first question of a brand-new chat from /chat to /chat/[id]. The conversation is
 * created first, then the question is sent from the conversation page so it streams there.
 */
export const pendingQuestions = new Map<string, string>();
