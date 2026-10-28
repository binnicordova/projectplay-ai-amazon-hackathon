import type { Result } from '@mimikai/contracts';
import type { ChatMessage } from '../domain/prompt';

/** Why the AI could not answer, in terms the teacher can act on. */
export type ChatError =
  | { readonly kind: 'offline'; readonly message: string }
  | { readonly kind: 'not-configured'; readonly message: string }
  | { readonly kind: 'rejected'; readonly message: string }
  | { readonly kind: 'busy'; readonly message: string }
  | { readonly kind: 'bad-answer'; readonly message: string };

/**
 * A chat model, as a plain function: messages in, the model's text (JSON) out. Each provider is
 * one implementation of this type (the strategy), chosen by name in the composition root.
 */
export type ChatModel = (messages: readonly ChatMessage[]) => Promise<Result<string, ChatError>>;

export type ProviderId = 'deepseek';
