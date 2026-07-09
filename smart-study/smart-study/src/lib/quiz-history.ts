const STORAGE_KEY = "ssc_quiz_history";

export interface QuizResult {
  date: string;
  score: number;
  total: number;
  percentage: number;
}

export interface QuizStats {
  total: number;
  highest: number;
  average: number;
  lastScore: number | null;
  lastTotal: number | null;
  completionRate: number;
  history: QuizResult[];
}

export function loadHistory(): QuizResult[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveResult(score: number, total: number): QuizResult[] {
  const history = loadHistory();
  const entry: QuizResult = {
    date: new Date().toISOString(),
    score,
    total,
    percentage: total > 0 ? Math.round((score / total) * 100) : 0,
  };
  const updated = [...history, entry];
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // storage full or unavailable — proceed silently
  }
  return updated;
}

export function clearHistory(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function computeStats(history: QuizResult[]): QuizStats {
  if (history.length === 0) {
    return {
      total: 0,
      highest: 0,
      average: 0,
      lastScore: null,
      lastTotal: null,
      completionRate: 0,
      history: [],
    };
  }
  const percentages = history.map((r) => r.percentage);
  const highest = Math.max(...percentages);
  const average = Math.round(percentages.reduce((a, b) => a + b, 0) / percentages.length);
  const completionRate = Math.round(
    (history.filter((r) => r.percentage >= 80).length / history.length) * 100
  );
  const last = history[history.length - 1];
  return {
    total: history.length,
    highest,
    average,
    lastScore: last.score,
    lastTotal: last.total,
    completionRate,
    history,
  };
}

export function formatChartDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
