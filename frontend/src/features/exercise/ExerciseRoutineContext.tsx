import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import {
  initialExerciseCondition,
  mockExerciseRoutine,
  type ExerciseCondition,
  type ExerciseDayStatus,
  type ExerciseRoutine,
} from './exerciseData';

interface ExerciseRoutineContextValue {
  condition: ExerciseCondition;
  routine: ExerciseRoutine | null;
  status: ExerciseDayStatus;
  completedExerciseIds: string[];
  generateRoutine: (condition: ExerciseCondition) => void;
  completeRoutine: () => void;
  setCondition: (condition: ExerciseCondition) => void;
}

const ExerciseRoutineContext = createContext<ExerciseRoutineContextValue | null>(null);

export function ExerciseRoutineProvider({ children }: { children: ReactNode }) {
  const [condition, setCondition] = useState(initialExerciseCondition);
  const [routine, setRoutine] = useState<ExerciseRoutine | null>(null);
  const [status, setStatus] = useState<ExerciseDayStatus>('not-created');
  const [completedExerciseIds, setCompletedExerciseIds] = useState<string[]>([]);

  const generateRoutine = useCallback((nextCondition: ExerciseCondition) => {
    setCondition(nextCondition);
    setRoutine(mockExerciseRoutine);
    setCompletedExerciseIds([]);
    setStatus('ready');
  }, []);

  const completeRoutine = useCallback(() => {
    setRoutine((current) => {
      const resolved = current ?? mockExerciseRoutine;
      setCompletedExerciseIds(resolved.exercises.map(({ id }) => id));
      return resolved;
    });
    setStatus('completed');
  }, []);

  const value = useMemo(
    () => ({
      completedExerciseIds,
      completeRoutine,
      condition,
      generateRoutine,
      routine,
      setCondition,
      status,
    }),
    [completedExerciseIds, completeRoutine, condition, generateRoutine, routine, status],
  );

  return (
    <ExerciseRoutineContext.Provider value={value}>{children}</ExerciseRoutineContext.Provider>
  );
}

export function useExerciseRoutine() {
  const context = useContext(ExerciseRoutineContext);
  if (!context) throw new Error('useExerciseRoutine must be used within ExerciseRoutineProvider');
  return context;
}
