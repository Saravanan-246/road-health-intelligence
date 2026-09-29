import { useCallback, useReducer } from 'react';
import HomeScreen from '../citizen/screens/HomeScreen';
import ReportScreen from '../citizen/screens/ReportScreen';
import DefectScreen from '../citizen/screens/DefectScreen';
import { addObservation, createDefect } from '../citizen/services/devMock/defectService';
import type { Defect, Observation } from '../api/types';

type Screen = 'HOME' | 'REPORT' | { kind: 'DEFECT'; id: string };

interface State {
  screen: Screen;
  /** TEMPORARY: in-memory defects from the dev mock until the backend API is wired. */
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
          defects = [...defects];
          defects[idx] = addObservation(defects[idx], action.observation, now);
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

export default function CitizenNavigator() {
  const [state, dispatch] = useReducer(reducer, { screen: 'HOME', defects: [] });

  const handleCommit = useCallback((observation: Observation, mergeIntoId: string | null) => {
    dispatch({ type: 'CREATE_OBSERVATION', observation, mergeIntoId });
  }, []);

  const { screen } = state;
  if (screen === 'REPORT') {
    return (
      <ReportScreen
        defects={state.defects}
        onCancel={() => dispatch({ type: 'GO_HOME' })}
        onCommit={handleCommit}
      />
    );
  }
  if (screen !== 'HOME') {
    const defect = state.defects.find((d) => d.id === screen.id);
    if (defect) {
      return <DefectScreen defect={defect} onBack={() => dispatch({ type: 'GO_HOME' })} />;
    }
  }
  return (
    <HomeScreen
      defects={state.defects}
      onReport={() => dispatch({ type: 'GO_REPORT' })}
      onOpenDefect={(id) => dispatch({ type: 'GO_DEFECT', id })}
    />
  );
}
