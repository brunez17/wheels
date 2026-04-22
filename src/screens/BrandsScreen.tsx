import { useCallback, useLayoutEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { BrandsScreenProps } from '../navigation/types';
import * as Repo from '../db/repository';
import type { Brand } from '../types/models';

export function BrandsScreen({ navigation }: BrandsScreenProps) {
  const [rows, setRows] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable onPress={() => navigation.navigate('CloudBackup')} hitSlop={12} style={{ paddingHorizontal: 8 }}>
          <Text style={{ color: '#2563eb', fontWeight: '600', fontSize: 16 }}>Nube</Text>
        </Pressable>
      ),
    });
  }, [navigation]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await Repo.listBrands());
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const confirmDelete = (b: Brand) => {
    Alert.alert(
      'Eliminar marca',
      `¿Eliminar "${b.name}" y todos sus vehículos?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => void Repo.deleteBrand(b.id).then(load),
        },
      ]
    );
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
      <FlatList
        data={rows}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={rows.length === 0 ? styles.emptyList : undefined}
        ListEmptyComponent={<Text style={styles.emptyText}>No hay marcas. Agregá la primera.</Text>}
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
            onPress={() =>
              navigation.navigate('Cars', { brandId: item.id, brandName: item.name })
            }
          >
            <View style={styles.cardMain}>
              <Text style={styles.brandName}>{item.name}</Text>
              <Text style={styles.count}>
                {item.vehicleCount} vehículo{item.vehicleCount === 1 ? '' : 's'}
              </Text>
            </View>
            <View style={styles.actions}>
              <Pressable
                onPress={() =>
                  navigation.navigate('BrandForm', {
                    brandId: item.id,
                    initialName: item.name,
                  })
                }
                hitSlop={8}
                style={styles.iconBtn}
              >
                <Text style={styles.iconBtnText}>Editar</Text>
              </Pressable>
              <Pressable onPress={() => confirmDelete(item)} hitSlop={8} style={styles.iconBtn}>
                <Text style={[styles.iconBtnText, styles.danger]}>Borrar</Text>
              </Pressable>
            </View>
          </Pressable>
        )}
      />
      <Pressable style={styles.fab} onPress={() => navigation.navigate('BrandForm', {})}>
        <Text style={styles.fabText}>+ Marca</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f2f4f7' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyList: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  emptyText: { textAlign: 'center', color: '#666', fontSize: 16 },
  card: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  cardPressed: { opacity: 0.92 },
  cardMain: { flex: 1 },
  brandName: { fontSize: 18, fontWeight: '600', color: '#111' },
  count: { marginTop: 4, fontSize: 14, color: '#666' },
  actions: { flexDirection: 'row', gap: 8 },
  iconBtn: { paddingVertical: 6, paddingHorizontal: 8 },
  iconBtnText: { fontSize: 14, color: '#2563eb', fontWeight: '500' },
  danger: { color: '#b91c1c' },
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
