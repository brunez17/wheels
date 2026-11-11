import { ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  getCurrentMatch,
  roundLabel,
  type Match,
  type TournamentState,
} from '../services/tournamentEngine';
import type { TournamentCar } from '../types/models';

type Props = {
  state: TournamentState;
};

function slotLabel(car: TournamentCar | null | undefined, isBye: boolean): string {
  if (isBye) return 'BYE';
  if (!car) return '—';
  return car.name;
}

function BracketMatchCell({
  match,
  isCurrent,
}: {
  match: Match;
  isCurrent: boolean;
}) {
  const isBye = match.carB == null;
  const aWon = match.winnerId != null && match.winnerId === match.carA.id;
  const bWon = match.winnerId != null && match.carB != null && match.winnerId === match.carB.id;

  return (
    <View style={[styles.cell, isCurrent && styles.cellCurrent]}>
      <View style={[styles.slot, aWon && styles.slotWinner, !aWon && match.winnerId != null && styles.slotLoser]}>
        <Text style={[styles.slotText, aWon && styles.slotTextWinner]} numberOfLines={1}>
          {slotLabel(match.carA, false)}
        </Text>
      </View>
      <View style={styles.divider} />
      <View
        style={[
          styles.slot,
          bWon && styles.slotWinner,
          !bWon && match.winnerId != null && !isBye && styles.slotLoser,
          isBye && styles.slotBye,
        ]}
      >
        <Text
          style={[styles.slotText, bWon && styles.slotTextWinner, isBye && styles.slotTextBye]}
          numberOfLines={1}
        >
          {slotLabel(match.carB, isBye)}
        </Text>
      </View>
    </View>
  );
}

export function TournamentBracket({ state }: Props) {
  if (state.rounds.length === 0) return null;

  const current = getCurrentMatch(state);

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Llaves</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator nestedScrollEnabled>
        <View style={styles.row}>
          {state.rounds.map((matches, roundIndex) => (
            <View key={`round-${roundIndex}`} style={styles.column}>
              <Text style={styles.columnTitle}>
                {roundLabel(roundIndex, state.rounds)}
              </Text>
              <View style={styles.matchesCol}>
                {matches.map((match) => (
                  <BracketMatchCell
                    key={match.id}
                    match={match}
                    isCurrent={current?.id === match.id}
                  />
                ))}
              </View>
            </View>
          ))}
          {state.champion ? (
            <View style={styles.column}>
              <Text style={styles.columnTitle}>Campeón</Text>
              <View style={styles.champCell}>
                <Text style={styles.champText} numberOfLines={2}>
                  {state.champion.name}
                </Text>
                <Text style={styles.champMeta} numberOfLines={1}>
                  {state.champion.brandName}
                </Text>
              </View>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 24,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6b7280',
    marginBottom: 12,
    marginLeft: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingRight: 8,
  },
  column: {
    width: 148,
    marginRight: 16,
  },
  columnTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 10,
    textAlign: 'center',
  },
  matchesCol: {
    gap: 12,
    justifyContent: 'space-around',
    minHeight: 80,
  },
  cell: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#f9fafb',
  },
  cellCurrent: {
    borderColor: '#2563eb',
    borderWidth: 2,
    backgroundColor: '#eff6ff',
  },
  slot: {
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  slotWinner: {
    backgroundColor: '#ecfdf5',
  },
  slotLoser: {
    opacity: 0.45,
  },
  slotBye: {
    backgroundColor: '#f3f4f6',
  },
  slotText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#111827',
  },
  slotTextWinner: {
    color: '#065f46',
    fontWeight: '700',
  },
  slotTextBye: {
    color: '#9ca3af',
    fontStyle: 'italic',
    fontWeight: '500',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#d1d5db',
  },
  champCell: {
    borderWidth: 2,
    borderColor: '#d97706',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#fffbeb',
    minHeight: 64,
    justifyContent: 'center',
  },
  champText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#92400e',
    textAlign: 'center',
  },
  champMeta: {
    marginTop: 4,
    fontSize: 11,
    color: '#b45309',
    textAlign: 'center',
  },
});
