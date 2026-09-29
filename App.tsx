import { useCallback, useReducer } from 'react';
import { SafeAreaView, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import HomeScreen from './src/screens/HomeScreen';
import ReportScreen from './src/screens/ReportScreen';
import DefectScreen from './src/screens/DefectScreen';
import { addObservation, createDefect } from './src/services/defectService';
import type { Defect, Observation } from './src/types/defect';

type Screen = 'HOME' | 'REPORT' | { kind: 'DEFECT'; id: string };

interface State {
  screen: Screen;
  defects: Defect[];
}

type Action =
  | { type: 'GO_HOME' }
  | { type: 'GO_REPORT' }
  | { type: 'GO_DEFECT'; id: string }
  | { type: 'CREATE_OBSERVATION'; observation: Observation; mergeIntoId: string | null };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'GO_HOME':
      return { ...state, screen: 'HOME' };
    case 'GO_REPORT':
      return { ...state, screen: 'REPORT' };
    case 'GO_DEFECT':
      return { ...state, screen: { kind: 'DEFECT', id: action.id } };
    case 'CREATE_OBSERVATION': {
      const now = Date.now();
      let defects = state.defects;

      if (action.mergeIntoId) {
        const idx = defects.findIndex((d) => d.id === action.mergeIntoId);
        if (idx >= 0) {
          const updated = addObservation(defects[idx], action.observation, now);
          defects = [...defects];
          defects[idx] = updated;
        }
      } else {
        defects = [...defects, createDefect(action.observation, now)];
      }

      return { ...state, screen: 'HOME', defects };
    }
    default:
      return state;
  }
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, {
    screen: 'HOME',
    defects: [],
  });

  const handleCommit = useCallback((observation: Observation, mergeIntoId: string | null) => {
    dispatch({ type: 'CREATE_OBSERVATION', observation, mergeIntoId });
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <View style={styles.container}>
        {state.screen === 'HOME' && (
          <HomeScreen
            defects={state.defects}
            onReport={() => dispatch({ type: 'GO_REPORT' })}
            onOpenDefect={(id) => dispatch({ type: 'GO_DEFECT', id })}
          />
        )}
        {state.screen === 'REPORT' && (
          <ReportScreen
            defects={state.defects}
            onCancel={() => dispatch({ type: 'GO_HOME' })}
            onCommit={handleCommit}
          />
        )}
        {typeof state.screen === 'object' && state.screen.kind === 'DEFECT' && (() => {
          const defect = state.defects.find((d) => d.id === (state.screen as { kind: 'DEFECT'; id: string }).id);
          return defect ? (
            <DefectScreen
              defect={defect}
              onBack={() => dispatch({ type: 'GO_HOME' })}
            />
          ) : null;
        })()}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F6F8' },
  container: { flex: 1 },
});
