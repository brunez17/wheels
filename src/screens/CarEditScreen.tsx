import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from '@react-navigation/native';
import { ImageGalleryModal } from '../components/ImageGalleryModal';
import { MODEL_COLOR_PRESETS } from '../constants/palette';
import type { CarEditScreenProps } from '../navigation/types';
import * as Repo from '../db/repository';
import type { CarImageRow } from '../types/models';
import { isValidHex, normalizeHex } from '../utils/color';

export function CarEditScreen({ navigation, route }: CarEditScreenProps) {
  const { brandId, brandName, carId: initialCarId } = route.params;

  const [carId, setCarId] = useState<number | undefined>(initialCarId);
  const [name, setName] = useState('');
  const [series, setSeries] = useState('');
  const [year, setYear] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [primary, setPrimary] = useState('#CC0000');
  const [secondary, setSecondary] = useState('');
  const [images, setImages] = useState<CarImageRow[]>([]);
  const [loading, setLoading] = useState(!!initialCarId);
  const [saving, setSaving] = useState(false);
  const [gallery, setGallery] = useState<{ uris: string[]; start: number } | null>(null);
  const [pickerTarget, setPickerTarget] = useState<'primary' | 'secondary' | null>(null);

  useEffect(() => {
    setCarId(route.params.carId ?? initialCarId);
  }, [route.params.carId, initialCarId]);

  const loadCar = useCallback(async () => {
    if (!carId) {
      setLoading(false);
      setName('');
      setSeries('');
      setYear('');
      setQuantity('1');
      setPrimary('#CC0000');
      setSecondary('');
      setImages([]);
      return;
    }
    setLoading(true);
    try {
      const c = await Repo.getCar(carId);
      if (c) {
        setName(c.name);
        setSeries(c.series);
        setYear(String(c.year));
        setQuantity(String(c.quantity));
        setPrimary(c.primaryColor);
        setSecondary(c.secondaryColor ?? '');
      }
      setImages(await Repo.listCarImages(carId));
    } finally {
      setLoading(false);
    }
  }, [carId]);

  useFocusEffect(
    useCallback(() => {
      void loadCar();
    }, [loadCar])
  );

  const save = async () => {
    const n = name.trim();
    const s = series.trim();
    const y = parseInt(year, 10);
    const q = parseInt(quantity, 10);
    if (!n || !s) {
      Alert.alert('Datos incompletos', 'Nombre y serie son obligatorios.');
      return;
    }
    if (!Number.isFinite(y) || y < 1900 || y > 2100) {
      Alert.alert('Año inválido', 'Ingresá un año entre 1900 y 2100.');
      return;
    }
    if (!Number.isFinite(q) || q < 1) {
      Alert.alert('Cantidad inválida', 'La cantidad debe ser al menos 1.');
      return;
    }
    if (!isValidHex(primary)) {
      Alert.alert('Color principal', 'Usá un color hexadecimal válido (ej. #FF0000).');
      return;
    }
    const secTrim = secondary.trim();
    const secNorm = secTrim && isValidHex(secTrim) ? normalizeHex(secTrim) : null;
    if (secTrim && !secNorm) {
      Alert.alert('Color secundario', 'Si lo completás, debe ser un hex válido.');
      return;
    }
    const p = normalizeHex(primary);

    const dup = await Repo.hasDuplicateCar(brandId, n, s, p, carId);
    if (dup) {
      Alert.alert(
        'Duplicado',
        'Ya existe un auto con el mismo nombre, serie y color principal en esta marca. Cambiá el color principal o el nombre/serie.'
      );
      return;
    }

    setSaving(true);
    try {
      if (carId == null) {
        const id = await Repo.insertCar(brandId, n, s, y, q, p, secNorm);
        setCarId(id);
        navigation.setParams({ carId: id });
      } else {
        await Repo.updateCar(carId, n, s, y, q, p, secNorm);
      }
    } finally {
      setSaving(false);
    }
  };

  const pickImages = async () => {
    if (carId == null) {
      Alert.alert('Guardá primero', 'Guardá el vehículo una vez para poder agregar fotos.');
      return;
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permisos', 'Necesitamos acceso a la galería para cargar imágenes.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.85,
    });
    if (res.canceled || !res.assets?.length) return;
    for (const asset of res.assets) {
      if (!asset.uri) continue;
      const stored = await Repo.persistPickedImage(carId, asset.uri);
      await Repo.addCarImage(carId, stored);
    }
    setImages(await Repo.listCarImages(carId));
  };

  const removeImage = (img: CarImageRow) => {
    Alert.alert('Quitar foto', '¿Eliminar esta imagen?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () =>
          void Repo.removeCarImage(img.id).then(async () => {
            if (carId) setImages(await Repo.listCarImages(carId));
          }),
      },
    ]);
  };

  const confirmDeleteCar = () => {
    if (!carId) {
      navigation.goBack();
      return;
    }
    Alert.alert('Eliminar vehículo', '¿Eliminar este auto y todas sus fotos?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () =>
          void Repo.deleteCar(carId).then(() => navigation.goBack()),
      },
    ]);
  };

  const openGalleryAt = (index: number) => {
    const uris = images.map((i) => i.localUri);
    if (uris.length === 0) return;
    setGallery({ uris, start: index });
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
      <Text style={styles.hint}>Marca: {brandName}</Text>

      <Text style={styles.label}>Nombre del modelo</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Ej. Charger" />

      <Text style={styles.label}>Serie / línea</Text>
      <TextInput style={styles.input} value={series} onChangeText={setSeries} placeholder="Ej. Mainline" />

      <View style={styles.row2}>
        <View style={styles.half}>
          <Text style={styles.label}>Año</Text>
          <TextInput
            style={styles.input}
            value={year}
            onChangeText={setYear}
            keyboardType="number-pad"
            placeholder="1970"
          />
        </View>
        <View style={styles.half}>
          <Text style={styles.label}>Cantidad</Text>
          <TextInput
            style={styles.input}
            value={quantity}
            onChangeText={setQuantity}
            keyboardType="number-pad"
            placeholder="1"
          />
        </View>
      </View>

      <Text style={styles.label}>Color principal</Text>
      <View style={styles.colorRow}>
        <View style={[styles.bigSwatch, { backgroundColor: isValidHex(primary) ? normalizeHex(primary) : '#ccc' }]} />
        <TextInput
          style={[styles.input, styles.hexInput]}
          value={primary}
          onChangeText={setPrimary}
          autoCapitalize="characters"
          placeholder="#FF0000"
        />
      </View>
      <Pressable onPress={() => setPickerTarget('primary')}>
        <Text style={styles.link}>Elegir de paleta</Text>
      </Pressable>

      <Text style={styles.label}>Color secundario (opcional)</Text>
      <View style={styles.colorRow}>
        <View
          style={[
            styles.bigSwatch,
            {
              backgroundColor:
                secondary.trim() && isValidHex(secondary) ? normalizeHex(secondary) : '#f3f4f6',
            },
          ]}
        />
        <TextInput
          style={[styles.input, styles.hexInput]}
          value={secondary}
          onChangeText={setSecondary}
          autoCapitalize="characters"
          placeholder="Opcional"
        />
      </View>
      <Pressable onPress={() => setPickerTarget('secondary')}>
        <Text style={styles.link}>Elegir de paleta</Text>
      </Pressable>

      <Text style={styles.sectionTitle}>Fotos</Text>
      <Pressable style={styles.secondaryBtn} onPress={() => void pickImages()}>
        <Text style={styles.secondaryBtnText}>Agregar desde galería</Text>
      </Pressable>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.thumbStrip}>
        {images.map((img, idx) => (
          <View key={img.id} style={styles.thumbItem}>
            <Pressable onPress={() => openGalleryAt(idx)}>
              <Image source={{ uri: img.localUri }} style={styles.stripImg} />
            </Pressable>
            <Pressable style={styles.removePh} onPress={() => removeImage(img)}>
              <Text style={styles.removePhText}>Quitar</Text>
            </Pressable>
          </View>
        ))}
      </ScrollView>

      <Pressable
        style={[styles.primaryBtn, saving && styles.disabled]}
        onPress={() => void save()}
        disabled={saving}
      >
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Guardar</Text>}
      </Pressable>

      {carId != null ? (
        <Pressable style={styles.dangerBtn} onPress={confirmDeleteCar}>
          <Text style={styles.dangerBtnText}>Eliminar vehículo</Text>
        </Pressable>
      ) : null}

      <ImageGalleryModal
        visible={gallery != null}
        uris={gallery?.uris ?? []}
        initialIndex={gallery?.start ?? 0}
        onClose={() => setGallery(null)}
      />

      {pickerTarget ? (
        <View style={styles.paletteOverlay}>
          <Pressable style={styles.paletteBackdrop} onPress={() => setPickerTarget(null)} />
          <View style={styles.paletteSheet}>
            <Text style={styles.paletteTitle}>Color</Text>
            <ScrollView style={styles.paletteScroll} nestedScrollEnabled>
              <View style={styles.paletteGrid}>
                {MODEL_COLOR_PRESETS.map((hex) => (
                  <Pressable
                    key={hex}
                    style={[styles.paletteCell, { backgroundColor: hex }]}
                    onPress={() => {
                      if (pickerTarget === 'primary') setPrimary(hex);
                      else setSecondary(hex);
                      setPickerTarget(null);
                    }}
                  />
                ))}
              </View>
            </ScrollView>
            <Pressable onPress={() => setPickerTarget(null)}>
              <Text style={styles.paletteClose}>Cerrar</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}

const SW = 40;
const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#fff' },
  scrollContent: { padding: 20, paddingBottom: 48 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  hint: { fontSize: 14, color: '#6b7280', marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginTop: 12, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#111',
  },
  row2: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  colorRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bigSwatch: {
    width: 44,
    height: 44,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#00000022',
  },
  hexInput: { flex: 1 },
  link: { marginTop: 6, color: '#2563eb', fontSize: 14, fontWeight: '500' },
  sectionTitle: { marginTop: 24, fontSize: 16, fontWeight: '700', color: '#111' },
  secondaryBtn: {
    marginTop: 8,
    alignSelf: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: '#e5e7eb',
    borderRadius: 10,
  },
  secondaryBtnText: { fontWeight: '600', color: '#111827' },
  thumbStrip: { marginTop: 12, maxHeight: 120 },
  thumbItem: { marginRight: 12 },
  stripImg: { width: 88, height: 88, borderRadius: 8, backgroundColor: '#eee' },
  removePh: { marginTop: 4, alignItems: 'center' },
  removePhText: { fontSize: 12, color: '#b91c1c' },
  primaryBtn: {
    marginTop: 28,
    backgroundColor: '#111827',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  disabled: { opacity: 0.6 },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  dangerBtn: { marginTop: 16, alignItems: 'center', padding: 12 },
  dangerBtnText: { color: '#b91c1c', fontWeight: '600' },
  paletteOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
  },
  paletteBackdrop: { flex: 1, backgroundColor: '#00000055' },
  paletteSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    maxHeight: '50%',
  },
  paletteTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  paletteScroll: { maxHeight: 280 },
  paletteGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  paletteCell: {
    width: SW,
    height: SW,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#00000022',
  },
  paletteClose: { marginTop: 16, textAlign: 'center', color: '#2563eb', fontWeight: '600' },
});
