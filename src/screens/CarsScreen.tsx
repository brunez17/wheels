import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { ColorSwatches } from '../components/ColorSwatches';
import { ImageGalleryModal } from '../components/ImageGalleryModal';
import type { CarsScreenProps } from '../navigation/types';
import * as Repo from '../db/repository';
import type { CarListItem } from '../types/models';

export function CarsScreen({ navigation, route }: CarsScreenProps) {
  const { brandId, brandName } = route.params;
  const [rows, setRows] = useState<CarListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [gallery, setGallery] = useState<{ uris: string[] } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await Repo.listCars(brandId));
    } finally {
      setLoading(false);
    }
  }, [brandId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.series.toLowerCase().includes(q) ||
        String(r.year).includes(q)
    );
  }, [rows, query]);

  const openGallery = async (car: CarListItem) => {
    const imgs = await Repo.listCarImages(car.id);
    const uris = imgs.map((i) => i.localUri);
    if (uris.length === 0) return;
    setGallery({ uris });
  };

  if (loading && rows.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.search}
        value={query}
        onChangeText={setQuery}
        placeholder="Buscar por nombre, serie o año…"
        placeholderTextColor="#999"
        clearButtonMode="while-editing"
      />
      <FlatList
        data={filtered}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={filtered.length === 0 ? styles.emptyList : { paddingBottom: 100 }}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            {rows.length === 0 ? 'No hay autos en esta marca.' : 'Sin resultados.'}
          </Text>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Pressable
              onPress={() => void openGallery(item)}
              style={({ pressed }) => [styles.thumbWrap, pressed && styles.cardPressed]}
            >
              {item.thumbUri ? (
                <Image source={{ uri: item.thumbUri }} style={styles.thumb} />
              ) : (
                <View style={styles.thumbPlaceholder}>
                  <Text style={styles.thumbPhText}>Sin foto</Text>
                </View>
              )}
              {item.tournamentWins > 0 ? (
                <View style={styles.cupsBadge}>
                  <Text style={styles.cupsText}>🏆 {item.tournamentWins}</Text>
                </View>
              ) : null}
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.cardBody, pressed && styles.cardPressed]}
              onPress={() =>
                navigation.navigate('CarEdit', { brandId, brandName, carId: item.id })
              }
            >
              <Text style={styles.carName}>{item.name}</Text>
              <Text style={styles.meta}>
                {item.series} · {item.year}
              </Text>
              <View style={styles.rowBottom}>
                <ColorSwatches primary={item.primaryColor} secondary={item.secondaryColor} />
                <View style={styles.qtyBadge}>
                  <Text style={styles.qtyText}>×{item.quantity}</Text>
                </View>
              </View>
            </Pressable>
          </View>
        )}
      />
      <Pressable
        style={styles.fab}
        onPress={() => navigation.navigate('CarEdit', { brandId, brandName })}
      >
        <Text style={styles.fabText}>+ Auto</Text>
      </Pressable>
      <ImageGalleryModal
        visible={gallery != null}
        uris={gallery?.uris ?? []}
        onClose={() => setGallery(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f2f4f7' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  search: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  emptyList: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  emptyText: { textAlign: 'center', color: '#666', fontSize: 16 },
  card: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  cardPressed: { opacity: 0.94 },
  thumbWrap: { marginRight: 12 },
  thumb: { width: 72, height: 72, borderRadius: 8, backgroundColor: '#eee' },
  thumbPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 8,
    backgroundColor: '#e5e7eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbPhText: { fontSize: 11, color: '#9ca3af' },
  cupsBadge: {
    position: 'absolute',
    top: -4,
    right: -6,
    backgroundColor: '#f59e0b',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#fff',
    minWidth: 28,
    alignItems: 'center',
  },
  cupsText: { fontSize: 11, fontWeight: '800', color: '#111827' },
  cardBody: { flex: 1, justifyContent: 'center' },
  carName: { fontSize: 17, fontWeight: '600', color: '#111' },
  meta: { marginTop: 2, fontSize: 14, color: '#6b7280' },
  rowBottom: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  qtyBadge: {
    backgroundColor: '#111827',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  qtyText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    backgroundColor: '#111827',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 28,
    elevation: 4,
  },
  fabText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
