/**
 * What Mimi does and says on the phone: on the home screen, while creating a lesson, and in its
 * full-screen celebrations. The rig (shared with the TV) performs the cue; this decides it.
 * Words are for a teacher in a busy classroom: short, warm, and say what to do next.
 */
import { plainCue, type PetCue } from '@mimikai/pet';
import { achievementOf, type MimiMoment } from './progress';

export function homeCueOf(home: { readonly tvConnected: boolean; readonly classes: number }): PetCue {
  if (home.tvConnected) return plainCue('hello', 'home:tv', '¡La TV está lista! ¿Jugamos?');
  if (home.classes === 0) return plainCue('waiting', 'home:new', '¡Hola! Soy Mimi. Conecta la TV y jugamos');
  return plainCue('waiting', 'home', '¡Hola de nuevo! Conecta la TV para jugar');
}

export type ChatState = 'idle' | 'thinking' | 'error';

/** Mimi in Crea con Mimi: it thinks while the lesson is drafted and cheers each new draft. */
export function chatCueOf(chat: { readonly state: ChatState; readonly drafts: number }): PetCue {
  if (chat.state === 'thinking') return plainCue('think', `chat:think:${chat.drafts}`, 'Estoy preparando los ejercicios…');
  if (chat.state === 'error') return plainCue('niceTry', `chat:error:${chat.drafts}`, 'Algo falló. ¿Lo intentamos otra vez?');
  if (chat.drafts > 0) return plainCue('gotIt', `chat:draft:${chat.drafts}`, '¡Lista! Revisa las tarjetas antes de guardar');
  return plainCue('waiting', 'chat:idle', '¿Qué lección necesitas hoy?');
}

export interface MomentView {
  readonly cue: PetCue;
  /** Rings Mimi juggles in this moment. */
  readonly rings: number;
  readonly title: string;
  readonly detail: string;
  /** A Twemoji code point shown with the words, if any. */
  readonly icon: string | null;
}

const days = (n: number) => (n === 1 ? '1 día' : `${n} días`);

export function momentView(moment: MimiMoment, rings: number, index: number): MomentView {
  switch (moment.kind) {
    case 'classDone': {
      const streak = moment.streak > 1 ? ` · Racha: ${days(moment.streak)} seguidos` : '';
      return {
        cue: plainCue('greatEffort', `moment:${index}`),
        rings,
        title: '¡Clase terminada!',
        detail: `${moment.correct} de ${moment.asked} respuestas correctas${streak}`,
        icon: null,
      };
    }
    case 'ring':
      return {
        cue: plainCue('levelUp', `moment:${index}`),
        rings: moment.rings,
        title: `¡Mimi ya hace malabares con ${moment.rings} anillos!`,
        detail: 'Cada clase que juegas le enseña algo nuevo',
        icon: null,
      };
    case 'achievement': {
      const achievement = achievementOf(moment.id);
      return { cue: plainCue('gotIt', `moment:${index}`), rings, title: `¡Logro: ${achievement.title}!`, detail: achievement.detail, icon: achievement.icon };
    }
  }
}
