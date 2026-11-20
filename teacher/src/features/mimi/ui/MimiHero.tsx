/**
 * The heart of the home screen: Mimi greeting the teacher, the rings it juggles thanks to the
 * classes played, the school-day streak, and the achievements still to unlock.
 */
import { useAtomValue } from 'jotai';
import { StyleSheet, Text, View } from 'react-native';
import { Card } from '../../../ui-kit/components';
import { colors, radius, space, type } from '../../../ui-kit/theme';
import { tvConnectedAtom } from '../../link/application/linkService';
import { Picture } from '../../pictures/ui/Picture';
import { mimiProgressAtom, mimiRingsAtom, mimiStreakAtom, nextRingInAtom } from '../application/mimi';
import { ACHIEVEMENTS, RING_AT } from '../domain/progress';
import { homeCueOf } from '../domain/voice';
import { Bubble, MimiPet } from './MimiPet';

const PET_SIZE = 190;

export function MimiHero() {
  const progress = useAtomValue(mimiProgressAtom);
  const rings = useAtomValue(mimiRingsAtom);
  const streak = useAtomValue(mimiStreakAtom);
  const nextRing = useAtomValue(nextRingInAtom);
  const tvConnected = useAtomValue(tvConnectedAtom);
  const cue = homeCueOf({ tvConnected, classes: progress.classes });
  // Share of the way from the last ring to the next one.
  const from = RING_AT[rings - 1] ?? 0;
  const to = RING_AT[rings];
  const share = to === undefined ? 1 : (progress.classes - from) / (to - from);

  return (
    <Card style={styles.card}>
      <View style={styles.top}>
        <MimiPet cue={cue} rings={rings} size={PET_SIZE} />
        <View style={styles.side}>
          <Bubble text={cue.line} />
          <View style={styles.chips}>
            <Chip icon="1f525" value={streak} label={streak === 1 ? 'día seguido' : 'días seguidos'} />
            <Chip icon="1f3af" value={rings} label={rings === 1 ? 'anillo' : 'anillos'} />
            <Chip icon="1f393" value={progress.classes} label={progress.classes === 1 ? 'clase' : 'clases'} />
          </View>
        </View>
      </View>
      <View style={styles.next}>
        <Text style={type.caption}>
          {nextRing === null
            ? '¡Mimi ya hace malabares con los cinco anillos!'
            : `${nextRing === 1 ? 'Falta 1 clase' : `Faltan ${nextRing} clases`} para que Mimi aprenda a hacer malabares con ${rings + 1} anillos`}
        </Text>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${Math.round(share * 100)}%` }]} />
        </View>
      </View>
      <View style={styles.badges}>
        {ACHIEVEMENTS.map((achievement) => {
          const unlocked = progress.achievements.includes(achievement.id);
          return (
            <View key={achievement.id} style={[styles.badge, !unlocked && styles.locked]} accessibilityLabel={`${achievement.title}${unlocked ? '' : ' (por desbloquear)'}`}>
              <Picture icon={achievement.icon} size={26} />
              <Text style={styles.badgeLabel} numberOfLines={2}>
                {achievement.title}
              </Text>
            </View>
          );
        })}
      </View>
    </Card>
  );
}

function Chip({ icon, value, label }: { readonly icon: string; readonly value: number; readonly label: string }) {
  return (
    <View style={styles.chip}>
      <Picture icon={icon} size={18} />
      <Text style={styles.chipValue}>{value}</Text>
      <Text style={type.caption}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.md },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  side: { flex: 1, gap: space.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: { flexDirection: 'row', alignItems: 'center', gap: space.xs, backgroundColor: colors.surfaceRaised, borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: space.xs },
  chipValue: { ...type.heading, fontSize: 16 },
  next: { gap: space.xs },
  track: { height: 8, borderRadius: radius.pill, backgroundColor: colors.surfaceRaised, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: colors.primary },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  badge: { width: 76, alignItems: 'center', gap: 2, paddingVertical: space.xs, borderRadius: radius.md, backgroundColor: colors.surfaceRaised },
  locked: { opacity: 0.3 },
  badgeLabel: { ...type.caption, fontSize: 10, textAlign: 'center' },
});
