import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { TournamentBracket } from '../components/TournamentBracket';
import { TournamentMatchCard } from '../components/TournamentMatchCard';
import type { TournamentScreenProps } from '../navigation/types';
import * as Repo from '../db/repository';
import {
  countPlayableMatches,
  countResolvedPlayable,
  currentRoundMatches,
  getCurrentMatch,
  getNextMatch,
  idleState,
  pickWinner,
  startTournament,
  type TournamentState,
} from '../services/tournamentEngine';
import type { TournamentCar } from '../types/models';

export function TournamentScreen({ navigation }: TournamentScreenProps) {
  const [cars, setCars] = useState<TournamentCar[]>([]);
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<TournamentState>(idleState);
  const [flashName, setFlashName] = useState<string | null>(null);
  const winRecordedRef = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setCars(await Repo.listAllCars());
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (state.phase === 'idle') void load();
    }, [load, state.phase])
  );

  const onStart = () => {
    setFlashName(null);
    winRecordedRef.current = false;
    setState(startTournament(cars));
  };

  const onPick = (car: TournamentCar) => {
    setFlashName(car.name);
    setTimeout(() => {
      setState((prev) => {
        const next = pickWinner(prev, car.id);
        if (
          next.phase === 'finished' &&
          next.champion &&
          !winRecordedRef.current
        ) {
          winRecordedRef.current = true;
          void Repo.recordTournamentWin(next.champion.id);
        }
        return next;
      });
      setFlashName(null);
    }, 450);
  };

  const onRestart = () => {
    setFlashName(null);
    winRecordedRef.current = false;
    setState(idleState());
    void load();
  };

  if (loading && state.phase === 'idle') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (state.phase === 'idle') {
    return (
      <View style={styles.container}>
        <View style={styles.idleCard}>
          <Text style={styles.idleTitle}>Torneo eliminatorio</Text>
          <Text style={styles.idleBody}>
            {cars.length === 0
              ? 'No hay autos en el inventario. Agregá modelos para armar un torneo.'
              : cars.length === 1
                ? 'Necesitás al menos 2 autos para iniciar un torneo.'
                : `${cars.length} autos listos para el torneo. Se sortearán y se enfrentarán de a 2 hasta quedar un campeón.`}
          </Text>
          {cars.length >= 2 ? (
            <Pressable style={styles.primaryBtn} onPress={onStart}>
              <Text style={styles.primaryBtnText}>Iniciar sorteo</Text>
            </Pressable>
          ) : (
            <Pressable style={styles.secondaryBtn} onPress={() => navigation.goBack()}>
              <Text style={styles.secondaryBtnText}>Volver</Text>
            </Pressable>
          )}
        </View>
      </View>
    );
  }

  if (state.phase === 'finished' && state.champion) {
    const champ = state.champion;
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.finishedPad}>
        <Text style={styles.champLabel}>Campeón</Text>
        <TournamentMatchCard car={champ} />
        <TournamentBracket state={state} />
        <Pressable style={styles.primaryBtn} onPress={onRestart}>
          <Text style={styles.primaryBtnText}>Nuevo torneo</Text>
        </Pressable>
        <Pressable style={styles.secondaryBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.secondaryBtnText}>Volver a marcas</Text>
        </Pressable>
      </ScrollView>
    );
  }

  const matches = currentRoundMatches(state);
  const current = getCurrentMatch(state);
  const next = getNextMatch(state);
  const playable = countPlayableMatches(matches);
  const resolved = countResolvedPlayable(matches);
  const duelIndex = Math.min(resolved + 1, playable);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.activePad}>
      <Text style={styles.roundTitle}>Ronda {state.roundNumber}</Text>
      <Text style={styles.progress}>
        Duelo {duelIndex} de {playable}
      </Text>

      {flashName ? (
        <View style={styles.flash}>
          <Text style={styles.flashText}>¡Gana {flashName}!</Text>
        </View>
      ) : null}

      {current ? (
        <View style={styles.matchBlock}>
          <Text style={styles.vsHint}>Tocá el ganador</Text>
          <TournamentMatchCard
            car={current.carA}
            onPress={() => onPick(current.carA)}
            disabled={flashName != null}
          />
          <Text style={styles.vs}>VS</Text>
          {current.carB ? (
            <TournamentMatchCard
              car={current.carB}
              onPress={() => onPick(current.carB!)}
              disabled={flashName != null}
            />
          ) : null}
        </View>
      ) : (
        <View style={styles.centeredInline}>
          <ActivityIndicator />
        </View>
      )}

      <View style={styles.nextBlock}>
        <Text style={styles.nextTitle}>Siguiente</Text>
        {next && next.carB ? (
          <View style={styles.nextPreview}>
            <TournamentMatchCard car={next.carA} compact />
            <Text style={styles.vsSmall}>vs</Text>
            <TournamentMatchCard car={next.carB} compact />
          </View>
        ) : (
          <Text style={styles.nextEmpty}>Último duelo de la ronda</Text>
        )}
      </View>

      <TournamentBracket state={state} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f2f4f7' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  centeredInline: { paddingVertical: 24, alignItems: 'center' },
  idleCard: {
    margin: 20,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 24,
    elevation: 2,
  },
  idleTitle: { fontSize: 22, fontWeight: '700', color: '#111', marginBottom: 12 },
  idleBody: { fontSize: 15, color: '#374151', lineHeight: 22, marginBottom: 20 },
  finishedPad: { padding: 20, paddingBottom: 40 },
  activePad: { padding: 20, paddingBottom: 40 },
  champLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#92400e',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
    textAlign: 'center',
  },
  roundTitle: { fontSize: 22, fontWeight: '700', color: '#111' },
  progress: { marginTop: 4, fontSize: 15, color: '#6b7280', marginBottom: 16 },
  matchBlock: { gap: 10 },
  vsHint: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 4 },
  vs: {
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '800',
    color: '#9ca3af',
    marginVertical: 4,
  },
  flash: {
    backgroundColor: '#ecfdf5',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  flashText: { textAlign: 'center', fontWeight: '700', color: '#065f46', fontSize: 16 },
  nextBlock: {
    marginTop: 28,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  nextTitle: { fontSize: 14, fontWeight: '700', color: '#6b7280', marginBottom: 10 },
  nextPreview: { gap: 8 },
  vsSmall: { textAlign: 'center', fontSize: 13, fontWeight: '700', color: '#9ca3af' },
  nextEmpty: { fontSize: 14, color: '#9ca3af' },
  primaryBtn: {
    marginTop: 20,
    backgroundColor: '#111827',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  secondaryBtn: {
    marginTop: 12,
    backgroundColor: '#e5e7eb',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  secondaryBtnText: { color: '#111827', fontWeight: '700', fontSize: 16 },
});
