/**
 * The AI providers this app can use (strategy pattern): each is a ChatModel factory, picked by
 * name. Adding one (Amazon Bedrock, a school's own server…) is a new file and one line here.
 */
import { err } from '@projectplay/contracts';
import type { ChatModel, ProviderId } from '../application/ports';
import { DEEPSEEK_DEFAULTS, deepSeekChatModel } from './deepseek';

export interface AiSettings {
  readonly provider: string;
  readonly deepseekApiKey?: string;
  readonly deepseekModel?: string;
}

const PROVIDERS: Readonly<Record<ProviderId, (settings: AiSettings) => ChatModel | null>> = {
  deepseek: (settings) =>
    settings.deepseekApiKey
      ? deepSeekChatModel({ ...DEEPSEEK_DEFAULTS, apiKey: settings.deepseekApiKey, model: settings.deepseekModel || DEEPSEEK_DEFAULTS.model, fetch: (...args) => fetch(...args) })
      : null,
};

const notConfigured =
  (message: string): ChatModel =>
  async () =>
    err({ kind: 'not-configured', message });

export function chatModelFor(settings: AiSettings): ChatModel {
  const factory = PROVIDERS[settings.provider as ProviderId];
  if (!factory) return notConfigured(`Proveedor de IA desconocido: "${settings.provider}".`);
  return factory(settings) ?? notConfigured('Falta la clave de la IA: agrega EXPO_PUBLIC_DEEPSEEK_API_KEY en teacher/.env y vuelve a compilar.');
}

/**
 * Settings from the environment. Expo inlines EXPO_PUBLIC_ variables into the app when it is
 * built (from teacher/.env, which git ignores), so the key ships inside the APK.
 */
export const aiSettingsFromEnv = (): AiSettings => ({
  provider: process.env.EXPO_PUBLIC_AI_PROVIDER || 'deepseek',
  deepseekApiKey: process.env.EXPO_PUBLIC_DEEPSEEK_API_KEY,
  deepseekModel: process.env.EXPO_PUBLIC_DEEPSEEK_MODEL,
});
