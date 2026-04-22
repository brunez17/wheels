import { GoogleSigninButton } from '@react-native-google-signin/google-signin';
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { configureGoogleSignIn, getGoogleWebClientId, signInWithGoogleForFirebase, signOutGoogleAndFirebase } from '../config/googleAuth';
import { getFirebaseAuth } from '../config/firebaseApp';
import type { CloudBackupScreenProps } from '../navigation/types';
import {
  downloadInventoryBackup,
  fetchRemoteBackupSummary,
  type RemoteBackupSummary,
  uploadInventoryBackup,
} from '../services/cloudBackup';

function formatWhen(ms: number | null): string {
  if (ms == null) return 'Sin datos';
  try {
    return new Date(ms).toLocaleString();
  } catch {
    return String(ms);
  }
}

export function CloudBackupScreen({ navigation }: CloudBackupScreenProps) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(() => getFirebaseAuth().currentUser);
  const [remoteAt, setRemoteAt] = useState<number | null>(null);
  const [summary, setSummary] = useState<RemoteBackupSummary | null>(null);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [busy, setBusy] = useState<'google' | 'up' | 'down' | null>(null);

  const webClientIdConfigured = useMemo(() => getGoogleWebClientId() != null, []);

  const refreshMeta = useCallback(async () => {
    setLoadingMeta(true);
    try {
      const s = await fetchRemoteBackupSummary();
      setSummary(s);
      setRemoteAt(s.updatedAtMs);
    } catch (e) {
      setRemoteAt(null);
      setSummary(null);
      Alert.alert(
        'Firebase',
        e instanceof Error ? e.message : 'No se pudo leer el respaldo remoto. Revisá conexión y configuración.'
      );
    } finally {
      setLoadingMeta(false);
    }
  }, []);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: 'Respaldo en la nube',
    });
  }, [navigation]);

  useEffect(() => {
    configureGoogleSignIn();
  }, []);

  useEffect(() => {
    const auth = getFirebaseAuth();
    const unsub = onAuthStateChanged(auth, (u) => {
      setFirebaseUser(u);
    });
    return unsub;
  }, []);

  useEffect(() => {
    void refreshMeta();
  }, [firebaseUser?.uid, refreshMeta]);

  const onGoogleSignIn = () => {
    void (async () => {
      setBusy('google');
      try {
        await signInWithGoogleForFirebase();
        await refreshMeta();
      } catch (e) {
        Alert.alert('Google', e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(null);
      }
    })();
  };

  const onSignOut = () => {
    Alert.alert('Cerrar sesión', 'En este dispositivo vas a salir de la cuenta de Google en la app.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Salir',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              await signOutGoogleAndFirebase();
              setRemoteAt(null);
              setSummary(null);
            } catch (e) {
              Alert.alert('Error', e instanceof Error ? e.message : String(e));
            }
          })();
        },
      },
    ]);
  };

  const onUpload = () => {
    Alert.alert(
      'Subir respaldo',
      'Se subirá todo el inventario actual (marcas, autos e imágenes) a tu cuenta de Firebase, reemplazando el respaldo anterior.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Subir',
          onPress: () => {
            void (async () => {
              setBusy('up');
              try {
                const { updatedAtMs } = await uploadInventoryBackup();
                setRemoteAt(updatedAtMs);
                const s = await fetchRemoteBackupSummary();
                setSummary(s);
                Alert.alert(
                  'Listo',
                  'Respaldo subido. En Firestore: users → tu UID → wheelsBackup → v1 y wheelImages.'
                );
              } catch (e) {
                Alert.alert('Error', e instanceof Error ? e.message : String(e));
              } finally {
                setBusy(null);
              }
            })();
          },
        },
      ]
    );
  };

  const onDownload = () => {
    Alert.alert(
      'Restaurar desde la nube',
      'Se borrará el inventario local de este dispositivo y se reemplazará por el respaldo de la nube.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Restaurar',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setBusy('down');
              try {
                await downloadInventoryBackup();
                setRemoteAt(null);
                await refreshMeta();
                Alert.alert('Listo', 'Datos restaurados. Volvé al listado de marcas para ver los cambios.');
              } catch (e) {
                Alert.alert('Error', e instanceof Error ? e.message : String(e));
              } finally {
                setBusy(null);
              }
            })();
          },
        },
      ]
    );
  };

  const canUseBackup = firebaseUser != null;
  const controlsDisabled = busy != null || loadingMeta || !canUseBackup;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.lead}>
        Iniciá sesión con Google para que el respaldo quede asociado a tu cuenta y puedas usar el mismo
        inventario en otro dispositivo.
      </Text>

      {!webClientIdConfigured ? (
        <View style={styles.warnCard}>
          <Text style={styles.warnTitle}>Configuración pendiente</Text>
          <Text style={styles.warnBody}>
            Agregá en app.json → expo.extra → googleWebClientId el ID de cliente OAuth tipo Web (termina en
            .apps.googleusercontent.com). Lo encontrás en Google Cloud Console → APIs y servicios → Credenciales,
            o al registrar una app Web en Firebase. Además, en Firebase → Proyecto → Tu app Android, cargá la
            huella SHA-1 de debug (./gradlew signingReport en la carpeta android) y volvé a compilar.
          </Text>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Cuenta</Text>
        {firebaseUser ? (
          <>
            <Text style={styles.cardValue}>{firebaseUser.email ?? firebaseUser.displayName ?? 'Sesión activa'}</Text>
            <Pressable style={styles.linkBtn} onPress={onSignOut}>
              <Text style={styles.linkText}>Cerrar sesión</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.summaryLines}>No iniciaste sesión.</Text>
            <GoogleSigninButton
              style={styles.googleBtn}
              size={GoogleSigninButton.Size.Wide}
              color={GoogleSigninButton.Color.Dark}
              onPress={onGoogleSignIn}
              disabled={busy != null || !webClientIdConfigured}
            />
          </>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Último respaldo en la nube</Text>
        {loadingMeta ? (
          <ActivityIndicator style={{ marginTop: 8 }} />
        ) : (
          <>
            <Text style={styles.cardValue}>{formatWhen(remoteAt)}</Text>
            {summary && summary.updatedAtMs != null ? (
              <Text style={styles.summaryLines}>
                Esquema: {summary.schemaVersion ?? '—'}
                {'\n'}
                Marcas: {summary.brandCount} · Autos: {summary.carCount} · Refs. imágenes: {summary.imageRefsCount}
                {'\n'}
                UID (Firestore → users / …):{'\n'}
                <Text selectable style={styles.uid}>
                  {summary.uid || '—'}
                </Text>
              </Text>
            ) : (
              <Text style={styles.summaryLines}>
                {canUseBackup
                  ? 'Todavía no hay documento wheelsBackup/v1 para esta cuenta. Podés subir un respaldo.'
                  : 'Iniciá sesión con Google para ver el estado del respaldo.'}
              </Text>
            )}
          </>
        )}
        <Pressable style={styles.linkBtn} onPress={() => void refreshMeta()} disabled={loadingMeta}>
          <Text style={styles.linkText}>Actualizar estado</Text>
        </Pressable>
      </View>

      {busy === 'google' ? (
        <View style={styles.busyRow}>
          <ActivityIndicator />
          <Text style={[styles.busyText, { marginLeft: 10 }]}>Conectando con Google…</Text>
        </View>
      ) : null}

      <Pressable
        style={[styles.primaryBtn, controlsDisabled && styles.disabled]}
        onPress={onUpload}
        disabled={controlsDisabled}
      >
        {busy === 'up' ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.primaryBtnText}>Subir respaldo ahora</Text>
        )}
      </Pressable>

      <Pressable
        style={[styles.secondaryBtn, controlsDisabled && styles.disabled]}
        onPress={onDownload}
        disabled={controlsDisabled}
      >
        {busy === 'down' ? (
          <ActivityIndicator color="#111" />
        ) : (
          <Text style={styles.secondaryBtnText}>Restaurar desde la nube</Text>
        )}
      </Pressable>

      <Text style={styles.note}>
        Firestore: colección users → documento con tu UID → wheelsBackup → v1 (datos) y wheelImages (fotos en
        base64). Con Google, el mismo UID aplica en todos los dispositivos donde inicies sesión con la misma
        cuenta.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f2f4f7' },
  content: { padding: 20, paddingBottom: 40 },
  lead: { fontSize: 15, color: '#374151', lineHeight: 22, marginBottom: 16 },
  warnCard: {
    backgroundColor: '#fef3c7',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#fcd34d',
  },
  warnTitle: { fontSize: 14, fontWeight: '700', color: '#92400e', marginBottom: 6 },
  warnBody: { fontSize: 13, color: '#78350f', lineHeight: 20 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  cardTitle: { fontSize: 14, fontWeight: '600', color: '#6b7280' },
  cardValue: { marginTop: 8, fontSize: 16, color: '#111827', fontWeight: '500' },
  linkBtn: { marginTop: 12, alignSelf: 'flex-start' },
  linkText: { color: '#2563eb', fontWeight: '600' },
  googleBtn: { marginTop: 12, height: 48, alignSelf: 'center' },
  busyRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  busyText: { fontSize: 14, color: '#374151' },
  primaryBtn: {
    backgroundColor: '#111827',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  secondaryBtn: {
    backgroundColor: '#e5e7eb',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 20,
  },
  secondaryBtnText: { color: '#111827', fontWeight: '700', fontSize: 16 },
  disabled: { opacity: 0.55 },
  note: { fontSize: 13, color: '#6b7280', lineHeight: 20 },
  summaryLines: {
    marginTop: 10,
    fontSize: 13,
    color: '#374151',
    lineHeight: 20,
  },
  uid: { fontSize: 11, color: '#111827' },
});
