import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { TournamentCar } from '../types/models';
import { ColorSwatches } from './ColorSwatches';

type Props = {
  car: TournamentCar;
  onPress?: () => void;
  compact?: boolean;
  disabled?: boolean;
};

export function TournamentMatchCard({ car, onPress, compact = false, disabled }: Props) {
  const thumbSize = compact ? 56 : 88;
  const content = (
    <View style={[styles.card, compact && styles.cardCompact]}>
      {car.thumbUri ? (
        <Image
          source={{ uri: car.thumbUri }}
          style={{ width: thumbSize, height: thumbSize, borderRadius: 8, backgroundColor: '#eee' }}
        />
      ) : (
        <View
          style={[
            styles.thumbPh,
            { width: thumbSize, height: thumbSize },
          ]}
        >
          <Text style={styles.thumbPhText}>Sin foto</Text>
        </View>
      )}
      <View style={styles.body}>
        <Text style={[styles.name, compact && styles.nameCompact]} numberOfLines={2}>
          {car.name}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {car.brandName} · {car.series} · {car.year}
        </Text>
        <View style={styles.swatches}>
          <ColorSwatches primary={car.primaryColor} secondary={car.secondaryColor} size={compact ? 14 : 18} />
        </View>
      </View>
    </View>
  );

  if (!onPress) return content;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [pressed && !disabled && styles.pressed, disabled && styles.disabled]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  cardCompact: {
    padding: 10,
    elevation: 1,
  },
  thumbPh: {
    borderRadius: 8,
    backgroundColor: '#e5e7eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbPhText: { fontSize: 11, color: '#9ca3af' },
  body: { flex: 1, marginLeft: 12 },
  name: { fontSize: 18, fontWeight: '700', color: '#111' },
  nameCompact: { fontSize: 15, fontWeight: '600' },
  meta: { marginTop: 4, fontSize: 13, color: '#6b7280' },
  swatches: { marginTop: 8 },
  pressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
  disabled: { opacity: 0.55 },
});
