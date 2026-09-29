/**
 * CitizenNavigator.tsx
 *
 * Full citizen navigation stack:
 *   LOGIN → HOME → REPORT → ANALYSIS → RESULT → DEFECT / MY_REPORTS
 *
 * Manages: session state, screen transitions, in-flight submission promise.
 * Does NOT hold business logic — only routes between screens.
 */

import { useEffect, useReducer } from 'react';
import { BackHandler, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import CitizenLoginScreen from '../auth/citizen/CitizenLoginScreen';
import HomeScreen from '../citizen/screens/HomeScreen';
import ReportScreen from '../citizen/screens/ReportScreen';
import AnalysisScreen from '../citizen/screens/AnalysisScreen';
import ResultScreen from '../citizen/screens/ResultScreen';
import MyReportsScreen from '../citizen/screens/MyReportsScreen';
import DefectScreen from '../citizen/screens/DefectScreen';

import { citizenLogout } from '../citizen/services/citizenAuthService';
import type { CitizenSession, ObservationResult } from '../citizen/types';
import type { Defect } from '../api/types';

// ── Screen discriminated union ────────────────────────────────────────────────

type Screen =
  | { kind: 'LOGIN' }
  | { kind: 'HOME' }
  | { kind: 'REPORT' }
  | { kind: 'ANALYSIS'; promise: Promise<ObservationResult> }
  | { kind: 'RESULT'; result: ObservationResult }
  | { kind: 'MY_REPORTS' }
  | { kind: 'DEFECT'; id: string };

// ── Reducer ───────────────────────────────────────────────────────────────────

interface State {
  screen: Screen;
  session: CitizenSession | null;
  /**
   * In-memory defects from the dev mock adapter.
   * REPLACE: when real backend is wired, defects come from the API — remove this state.
   */
  devDefects: Defect[];
}

type Action =
  | { type: 'LOGIN'; session: CitizenSession }
  | { type: 'LOGOUT' }
  | { type: 'GO_HOME' }
  | { type: 'GO_REPORT' }
  | { type: 'GO_ANALYSIS'; promise: Promise<ObservationResult> }
  | { type: 'GO_RESULT'; result: ObservationResult }
  | { type: 'GO_MY_REPORTS' }
  | { type: 'GO_DEFECT'; id: string }
  | { type: 'GO_BACK' };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'LOGIN':
      return { ...state, session: action.session, screen: { kind: 'HOME' } };
    case 'LOGOUT':
      citizenLogout();
      return { ...state, session: null, screen: { kind: 'LOGIN' }, devDefects: [] };
    case 'GO_HOME':
      return { ...state, screen: { kind: 'HOME' } };
    case 'GO_REPORT':
      return { ...state, screen: { kind: 'REPORT' } };
    case 'GO_ANALYSIS':
      return { ...state, screen: { kind: 'ANALYSIS', promise: action.promise } };
    case 'GO_RESULT':
      return { ...state, screen: { kind: 'RESULT', result: action.result } };
    case 'GO_MY_REPORTS':
      return { ...state, screen: { kind: 'MY_REPORTS' } };
    case 'GO_DEFECT':
      return { ...state, screen: { kind: 'DEFECT', id: action.id } };
    case 'GO_BACK': {
      const { kind } = state.screen;
      if (kind === 'REPORT' || kind === 'RESULT' || kind === 'MY_REPORTS') {
        return { ...state, screen: { kind: 'HOME' } };
      }
      if (kind === 'DEFECT') {
        return { ...state, screen: { kind: 'HOME' } };
      }
      // Don't navigate back during ANALYSIS or from HOME/LOGIN
      return state;
    }
    default:
      return state;
  }
}

// ── Navigator ─────────────────────────────────────────────────────────────────

export default function CitizenNavigator() {
  const [state, dispatch] = useReducer(reducer, {
    screen: { kind: 'LOGIN' },
    session: null,
    devDefects: [],
  });

  // Android hardware back button
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      const { kind } = state.screen;
      if (kind === 'HOME' || kind === 'LOGIN' || kind === 'ANALYSIS') return false;
      dispatch({ type: 'GO_BACK' });
      return true;
    });
    return () => sub.remove();
  }, [state.screen]);

  const { screen, session } = state;

  // ── LOGIN ──────────────────────────────────────────────────────────────────
  if (screen.kind === 'LOGIN') {
    return (
      <CitizenLoginScreen
        onLogin={(s) => dispatch({ type: 'LOGIN', session: s })}
      />
    );
  }

  // ── HOME ───────────────────────────────────────────────────────────────────
  if (screen.kind === 'HOME') {
    return (
      <HomeScreen
        session={session!}
        defects={state.devDefects}
        onReport={() => dispatch({ type: 'GO_REPORT' })}
        onOpenDefect={(id) => dispatch({ type: 'GO_DEFECT', id })}
        onMyReports={() => dispatch({ type: 'GO_MY_REPORTS' })}
        onLogout={() => dispatch({ type: 'LOGOUT' })}
      />
    );
  }

  // ── REPORT ─────────────────────────────────────────────────────────────────
  if (screen.kind === 'REPORT') {
    return (
      <ReportScreen
        onCancel={() => dispatch({ type: 'GO_HOME' })}
        onSubmitting={(promise) => dispatch({ type: 'GO_ANALYSIS', promise })}
      />
    );
  }

  // ── ANALYSIS ───────────────────────────────────────────────────────────────
  if (screen.kind === 'ANALYSIS') {
    return (
      <AnalysisScreen
        analysisPromise={screen.promise}
        onResult={(result) => dispatch({ type: 'GO_RESULT', result })}
        onError={(_msg) => {
          // Back to Report so the citizen can retry. Error message can be surfaced here.
          dispatch({ type: 'GO_REPORT' });
        }}
      />
    );
  }

  // ── RESULT ─────────────────────────────────────────────────────────────────
  if (screen.kind === 'RESULT') {
    return (
      <ResultScreen
        result={screen.result}
        onGoHome={() => dispatch({ type: 'GO_HOME' })}
        onViewDefect={(id) => dispatch({ type: 'GO_DEFECT', id })}
      />
    );
  }

  // ── MY REPORTS ─────────────────────────────────────────────────────────────
  if (screen.kind === 'MY_REPORTS') {
    return (
      <MyReportsScreen
        onBack={() => dispatch({ type: 'GO_HOME' })}
        onViewDefect={(id) => dispatch({ type: 'GO_DEFECT', id })}
      />
    );
  }

  // ── DEFECT ─────────────────────────────────────────────────────────────────
  if (screen.kind === 'DEFECT') {
    const defect = state.devDefects.find((d) => d.id === screen.id);
    if (defect) {
      return (
        <DefectScreen
          defect={defect}
          onBack={() => dispatch({ type: 'GO_HOME' })}
        />
      );
    }
    // Defect not in dev store — placeholder until GET /defects/:id is wired.
    return (
      <DefectNotFound
        defectId={screen.id}
        onBack={() => dispatch({ type: 'GO_HOME' })}
      />
    );
  }

  return null;
}

// ── Fallback: defect from backend not yet fetchable ────────────────────────────

function DefectNotFound({ defectId, onBack }: { defectId: string; onBack: () => void }) {
  return (
    <View style={notFoundStyles.container}>
      <Text style={notFoundStyles.id}>{defectId}</Text>
      <Text style={notFoundStyles.title}>Defect details not available</Text>
      <Text style={notFoundStyles.body}>
        Full defect details will be loaded from the backend once{'\n'}
        the GET /defects/:id endpoint is connected.
      </Text>
      <Pressable style={notFoundStyles.button} onPress={onBack}>
        <Text style={notFoundStyles.buttonText}>Back to Home</Text>
      </Pressable>
    </View>
  );
}

const notFoundStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F6F8',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 14,
  },
  id: { fontSize: 13, color: '#667085', fontVariant: ['tabular-nums'] },
  title: { fontSize: 20, fontWeight: '700', color: '#101828', textAlign: 'center' },
  body: { fontSize: 14, color: '#667085', textAlign: 'center', lineHeight: 20 },
  button: {
    backgroundColor: '#1D4ED8',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    marginTop: 8,
  },
  buttonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
});
