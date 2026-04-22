import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { BrandFormScreenProps } from '../navigation/types';
import * as Repo from '../db/repository';

export function BrandFormScreen({ navigation, route }: BrandFormScreenProps) {
  const { brandId, initialName = '' } = route.params ?? {};
  const [name, setName] = useState(initialName);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert('Nombre requerido', 'Ingresá un nombre de marca.');
      return;
    }
    setSaving(true);
    try {
      if (brandId != null) await Repo.updateBrand(brandId, trimmed);
      else await Repo.insertBrand(trimmed);
      navigation.goBack();
    } catch {
      Alert.alert('No se pudo guardar', 'Puede que ya exista una marca con ese nombre.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Nombre de la marca</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="Ej. Hot Wheels"
        placeholderTextColor="#999"
        autoCapitalize="words"
      />
      <Pressable
        style={[styles.primaryBtn, saving && styles.btnDisabled]}
        onPress={() => void save()}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.primaryBtnText}>Guardar</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111',
  },
  primaryBtn: {
    marginTop: 24,
    backgroundColor: '#111827',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.6 },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
