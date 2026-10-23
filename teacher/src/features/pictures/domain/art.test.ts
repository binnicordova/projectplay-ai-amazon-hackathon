import { SAMPLE_LESSON } from '@projectplay/contracts/src/testing/sampleLesson';
import { UI_ICONS } from '@projectplay/contracts';
import { describe, expect, it } from 'vitest';
import { artForLesson, missingIcons } from './art';

describe('lesson art', () => {
  const library = { '1f986': '<svg>duck</svg>', '1f525': '<svg>fire</svg>', '1f999': '<svg>llama</svg>' };

  it('sends only the pictures the lesson shows, plus the game icons we have', () => {
    expect(artForLesson(SAMPLE_LESSON, library)).toEqual({ '1f986': '<svg>duck</svg>', [UI_ICONS.fire]: '<svg>fire</svg>' });
  });

  it('lists pictures the app has no art for', () => {
    expect(missingIcons(SAMPLE_LESSON, library)).toEqual(['1f34e']);
  });
});
