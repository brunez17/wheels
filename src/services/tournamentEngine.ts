import type { TournamentCar } from '../types/models';

export type Match = {
  id: string;
  carA: TournamentCar;
  /** null = bye (carA avanza solo) */
  carB: TournamentCar | null;
  winnerId?: number;
};

export type TournamentState = {
  phase: 'idle' | 'active' | 'finished';
  roundNumber: number;
  /** Historial completo de rondas (la última es la ronda actual si phase === 'active'). */
  rounds: Match[][];
  champion: TournamentCar | null;
};

/** Acceso a la ronda en curso (o la final si ya terminó). */
export function currentRoundMatches(state: TournamentState): Match[] {
  if (state.rounds.length === 0) return [];
  return state.rounds[state.rounds.length - 1];
}

export function shuffleCars(cars: TournamentCar[]): TournamentCar[] {
  const arr = [...cars];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function buildRound(cars: TournamentCar[], roundNumber: number): Match[] {
  const matches: Match[] = [];
  for (let i = 0; i < cars.length; i += 2) {
    const carA = cars[i];
    const carB = cars[i + 1] ?? null;
    const match: Match = {
      id: `r${roundNumber}-m${matches.length}`,
      carA,
      carB,
    };
    if (carB == null) {
      match.winnerId = carA.id;
    }
    matches.push(match);
  }
  return matches;
}

function carById(match: Match, id: number): TournamentCar {
  if (match.carA.id === id) return match.carA;
  if (match.carB?.id === id) return match.carB;
  throw new Error(`Auto ${id} no está en el duelo`);
}

export function getCurrentMatch(state: TournamentState): Match | null {
  if (state.phase !== 'active') return null;
  return currentRoundMatches(state).find((m) => m.winnerId == null && m.carB != null) ?? null;
}

export function getNextMatch(state: TournamentState): Match | null {
  const current = getCurrentMatch(state);
  if (!current) return null;
  const matches = currentRoundMatches(state);
  const idx = matches.findIndex((m) => m.id === current.id);
  for (let i = idx + 1; i < matches.length; i++) {
    const m = matches[i];
    if (m.winnerId == null && m.carB != null) return m;
  }
  return null;
}

export function countPlayableMatches(matches: Match[]): number {
  return matches.filter((m) => m.carB != null).length;
}

export function countResolvedPlayable(matches: Match[]): number {
  return matches.filter((m) => m.carB != null && m.winnerId != null).length;
}

function winnersFromRound(matches: Match[]): TournamentCar[] {
  return matches.map((m) => {
    if (m.winnerId == null) throw new Error('Ronda incompleta');
    return carById(m, m.winnerId);
  });
}

function advanceRoundIfNeeded(state: TournamentState): TournamentState {
  if (state.phase !== 'active') return state;
  const matches = currentRoundMatches(state);
  if (matches.some((m) => m.winnerId == null)) return state;

  const winners = winnersFromRound(matches);
  if (winners.length === 1) {
    return {
      ...state,
      phase: 'finished',
      champion: winners[0],
    };
  }

  const nextRound = state.roundNumber + 1;
  return {
    ...state,
    roundNumber: nextRound,
    rounds: [...state.rounds, buildRound(winners, nextRound)],
  };
}

export function startTournament(cars: TournamentCar[]): TournamentState {
  if (cars.length < 2) {
    return idleState();
  }
  const shuffled = shuffleCars(cars);
  return {
    phase: 'active',
    roundNumber: 1,
    rounds: [buildRound(shuffled, 1)],
    champion: null,
  };
}

export function pickWinner(state: TournamentState, carId: number): TournamentState {
  if (state.phase !== 'active') return state;
  const current = getCurrentMatch(state);
  if (!current) return state;
  if (current.carA.id !== carId && current.carB?.id !== carId) return state;

  const rounds = state.rounds.map((round, ri) => {
    if (ri !== state.rounds.length - 1) return round;
    return round.map((m) => (m.id === current.id ? { ...m, winnerId: carId } : m));
  });
  return advanceRoundIfNeeded({ ...state, rounds });
}

export function idleState(): TournamentState {
  return {
    phase: 'idle',
    roundNumber: 0,
    rounds: [],
    champion: null,
  };
}

export function roundLabel(roundIndex: number, rounds: Match[][]): string {
  const matches = rounds[roundIndex] ?? [];
  const playable = countPlayableMatches(matches);
  if (playable <= 1 && rounds.length > 1) return 'Final';
  if (playable === 2 && rounds.length > 1) return 'Semifinal';
  return `Ronda ${roundIndex + 1}`;
}
