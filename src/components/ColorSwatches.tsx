import { StyleSheet, View } from 'react-native';

type Props = {
  primary: string;
  secondary?: string | null;
  size?: number;
};

export function ColorSwatches({ primary, secondary, size = 20 }: Props) {
  return (
    <View style={styles.row}>
      <View style={[styles.swatch, { width: size, height: size, backgroundColor: primary }]} />
      {secondary ? (
        <View
          style={[
            styles.swatch,
            { width: size, height: size, backgroundColor: secondary, marginLeft: 4 },
          ]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  swatch: { borderRadius: 4, borderWidth: StyleSheet.hairlineWidth, borderColor: '#00000033' },
});
