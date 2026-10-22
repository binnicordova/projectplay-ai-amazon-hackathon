/**
 * Fallback input when the camera cannot be used (bad light, no tripod):
 * the phone screen becomes a touchpad for the projection. Left half of the pad
 * drives player 1 (team A), right half player 2 (team B), multi-touch supported.
 * With one player the TV puts both on the one team, so the pad is simply the whole wall.
 */
import type { TeacherMessage, TeamCount } from '@projectplay/contracts';
import { useRef, useState } from 'react';
import { StyleSheet, Text, View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';
import { colors, radius, type } from '../../../ui-kit/theme';

export function Touchpad({ send, teams }: { readonly send: (message: TeacherMessage) => void; readonly teams: TeamCount }) {
  const [size, setSize] = useState({ width: 1, height: 1 });
  const active = useRef(new Set<number>());

  const onLayout = (e: LayoutChangeEvent) => setSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height });

  const report = (e: GestureResponderEvent) => {
    const seen = new Set<number>();
    for (const touch of e.nativeEvent.touches) {
      const x = touch.locationX / size.width;
      const player = x < 0.5 ? 1 : 2;
      seen.add(player);
      send({ t: 'ptr', p: player, x: Math.min(1, Math.max(0, x)), y: Math.min(1, Math.max(0, touch.locationY / size.height)), c: 1 });
    }
    active.current.forEach((player) => {
      if (!seen.has(player)) send({ t: 'lost', p: player });
    });
    active.current = seen;
  };

  return (
    <View
      style={styles.pad}
      onLayout={onLayout}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={report}
      onResponderMove={report}
      onResponderRelease={report}
      onResponderTerminate={report}
    >
      {teams === 1 ? (
        <View style={[styles.half, { borderColor: colors.teamA }]}>
          <Text style={[type.heading, { color: colors.teamA }]}>One player · whole wall</Text>
        </View>
      ) : (
        <>
          <View style={[styles.half, { borderColor: colors.teamA }]}>
            <Text style={[type.heading, { color: colors.teamA }]}>Team A</Text>
          </View>
          <View style={[styles.half, { borderColor: colors.teamB }]}>
            <Text style={[type.heading, { color: colors.teamB }]}>Team B</Text>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { flex: 1, flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.lg, overflow: 'hidden' },
  half: { flex: 1, borderWidth: 2, margin: 6, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', borderStyle: 'dashed' },
});
