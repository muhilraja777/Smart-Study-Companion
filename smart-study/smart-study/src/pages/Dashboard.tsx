import { useState, useMemo, useEffect } from "react";
import { useLocation } from "wouter";
import { getSession, clearSession, type Session } from "@/lib/user-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  GraduationCap, LogOut, Sparkles, Brain, TrendingUp,
  CheckCircle2, XCircle, ArrowLeft, AlertCircle,
  Trophy, Target, Star, Trash2, BarChart2, FileText, ClipboardList, Info,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell,
} from "recharts";
import { generateSummary, generateQuiz, type QuizQuestion } from "@/lib/local-ai";
import {
  loadHistory, saveResult, clearHistory, computeStats, formatChartDate,
  type QuizResult,
} from "@/lib/quiz-history";

type ActiveView = null | "summary" | "quiz" | "progress";
type QuizAnswer = number | string;

function getTypeBadge(type: QuizQuestion["type"]) {
  if (type === "mcq") return { label: "Multiple Choice", color: "bg-indigo-50 text-indigo-700 border border-indigo-100" };
  if (type === "truefalse") return { label: "True / False", color: "bg-teal-50 text-teal-700 border border-teal-100" };
  return { label: "Short Answer", color: "bg-amber-50 text-amber-700 border border-amber-100" };
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  accent: string;
  iconBg: string;
}
function StatCard({ icon, label, value, sub, accent, iconBg }: StatCardProps) {
  return (
    <div className={`rounded-2xl border p-5 flex flex-col gap-3 ${accent}`}>
      <div className="flex items-start justify-between">
        <span className="text-xs font-semibold uppercase tracking-widest opacity-60">{label}</span>
        <div className={`p-2 rounded-xl ${iconBg}`}>{icon}</div>
      </div>
      <p className="text-3xl font-extrabold leading-none tracking-tight">{value}</p>
      {sub && <p className="text-xs opacity-55 font-medium">{sub}</p>}
    </div>
  );
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const val = payload[0].value;
  return (
    <div className="bg-white border border-border rounded-xl px-3.5 py-2.5 shadow-lg text-sm">
      <p className="font-semibold text-foreground">{label}</p>
      <p className="text-primary font-bold mt-0.5">{val}% correct</p>
    </div>
  );
}

// ─── Section Header ───────────────────────────────────────────────────────────
function SectionHeader({
  icon, title, description, iconBg, onBack,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  iconBg: string;
  onBack: () => void;
}) {
  return (
    <div className="flex items-center gap-3 pb-4 border-b border-border/40 mb-6">
      <div className={`p-2.5 rounded-xl ${iconBg}`}>{icon}</div>
      <div className="flex-1 min-w-0">
        <h2 className="font-bold text-lg text-foreground leading-tight">{title}</h2>
        <p className="text-sm text-muted-foreground truncate">{description}</p>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={onBack}
        className="gap-1.5 text-muted-foreground hover:text-foreground shrink-0"
      >
        <ArrowLeft className="w-4 h-4" /> Back
      </Button>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [, setLocation] = useLocation();
  const [session, setSessionState] = useState<Session | null>(() => getSession());

  useEffect(() => {
    const s = getSession();
    if (!s) {
      setLocation("/");
    } else {
      setSessionState(s);
    }
  }, [setLocation]);

  const [pastedNotes, setPastedNotes] = useState("");
  const [activeView, setActiveView] = useState<ActiveView>(null);

  const [generatedSummary, setGeneratedSummary] = useState<string | null>(null);
  const [summaryError, setSummaryError] = useState(false);
  const [summaryDone, setSummaryDone] = useState(false);

  const [generatedQuestions, setGeneratedQuestions] = useState<QuizQuestion[]>([]);
  const [quizError, setQuizError] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, QuizAnswer>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizScore, setQuizScore] = useState<number | null>(null);

  const [history, setHistory] = useState<QuizResult[]>(() => loadHistory());
  const stats = useMemo(() => computeStats(history), [history]);

  const hasNotes = pastedNotes.trim().length > 0;
  const wordCount = pastedNotes.trim() === "" ? 0 : pastedNotes.trim().split(/\s+/).length;
  const totalQuestions = generatedQuestions.length;

  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPastedNotes(e.target.value);
    setActiveView(null);
    setGeneratedSummary(null);
    setSummaryError(false);
    setSummaryDone(false);
    setGeneratedQuestions([]);
    setQuizError(false);
    setQuizAnswers({});
    setQuizSubmitted(false);
    setQuizScore(null);
  };

  const handleGenerateSummary = () => {
    const result = generateSummary(pastedNotes);
    setSummaryError(result === null);
    setGeneratedSummary(result);
    setSummaryDone(true);
    setActiveView("summary");
  };

  const handleStartQuiz = () => {
    const questions = generateQuiz(pastedNotes);
    setQuizAnswers({});
    setQuizSubmitted(false);
    setQuizScore(null);
    const ok = questions.length >= 3;
    setQuizError(!ok);
    setGeneratedQuestions(ok ? questions : []);
    setActiveView("quiz");
  };

  const handleSelectAnswer = (questionId: number, value: QuizAnswer) => {
    if (quizSubmitted) return;
    setQuizAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const handleSubmitQuiz = () => {
    const score = generatedQuestions.reduce((acc, q) => {
      const ans = quizAnswers[q.id];
      if (q.type === "shortanswer") {
        const typed = ((ans as string) ?? "").toLowerCase().trim();
        return acc + (typed.includes(q.correctWord.toLowerCase()) ? 1 : 0);
      }
      return acc + (ans === q.answer ? 1 : 0);
    }, 0);

    setQuizScore(score);
    const updated = saveResult(score, totalQuestions);
    setHistory(updated);

    if (!summaryDone) {
      const result = generateSummary(pastedNotes);
      setGeneratedSummary(result);
      setSummaryError(result === null);
      setSummaryDone(true);
    }
    setQuizSubmitted(true);
  };

  const handleClearHistory = () => {
    clearHistory();
    setHistory([]);
  };

  const allAnswered =
    totalQuestions > 0 &&
    generatedQuestions.every((q) => {
      const ans = quizAnswers[q.id];
      if (q.type === "shortanswer") return typeof ans === "string" && (ans as string).trim().length > 0;
      return typeof ans === "number";
    });

  const completionPct =
    quizScore !== null && totalQuestions > 0
      ? Math.round((quizScore / totalQuestions) * 100)
      : 0;

  const isCorrect = (q: QuizQuestion): boolean => {
    const ans = quizAnswers[q.id];
    if (q.type === "shortanswer") {
      return ((ans as string) ?? "").toLowerCase().trim().includes(q.correctWord.toLowerCase());
    }
    return ans === q.answer;
  };

  const chartData = useMemo(
    () =>
      history.slice(-15).map((r, i) => ({
        name: formatChartDate(r.date),
        score: r.percentage,
        quizNum: history.length - Math.min(history.length, 15) + i + 1,
      })),
    [history]
  );

  // ── Time-of-day greeting ──
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="min-h-[100dvh] w-full flex flex-col bg-background">
      {/* Ambient background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-40 -left-40 w-[700px] h-[700px] rounded-full bg-primary/6 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-[600px] h-[600px] rounded-full bg-secondary/6 blur-3xl" />
      </div>

      {/* ── Header / Nav ── */}
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-border/50 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-primary to-primary/70 p-2 rounded-xl shadow-md shadow-primary/20">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <div className="hidden sm:block">
              <span className="font-bold text-base tracking-tight text-foreground">
                Smart Study Companion
              </span>
              <span className="ml-2 text-xs text-muted-foreground font-medium bg-muted px-2 py-0.5 rounded-full">
                Beta
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {session && (
              <span className="hidden sm:inline-block text-sm font-medium text-muted-foreground bg-muted px-3 py-1 rounded-full">
                {session.username}
              </span>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { clearSession(); setLocation("/"); }}
              className="gap-2 text-muted-foreground hover:text-foreground"
              data-testid="button-logout"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </header>

      {/* ── Main ── */}
      <main className="relative z-10 flex-1 w-full max-w-5xl mx-auto px-4 sm:px-8 py-8 sm:py-10 space-y-8">

        {/* Welcome hero */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-1">
              {greeting}{session ? `, ${session.username}` : ""} 👋
            </p>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
              Your Study{" "}
              <span className="text-gradient">Dashboard</span>
            </h1>
          </div>
          {stats.total > 0 && (
            <div className="flex items-center gap-4 sm:gap-6 bg-white border border-border/60 rounded-2xl px-5 py-3 shadow-sm">
              <div className="text-center">
                <p className="text-2xl font-extrabold text-foreground">{stats.total}</p>
                <p className="text-xs text-muted-foreground font-medium">Quizzes</p>
              </div>
              <div className="w-px h-8 bg-border" />
              <div className="text-center">
                <p className="text-2xl font-extrabold text-primary">{stats.averagePct}%</p>
                <p className="text-xs text-muted-foreground font-medium">Avg Score</p>
              </div>
              <div className="w-px h-8 bg-border" />
              <div className="text-center">
                <p className="text-2xl font-extrabold text-secondary">{stats.highestPct}%</p>
                <p className="text-xs text-muted-foreground font-medium">Best</p>
              </div>
            </div>
          )}
        </div>

        {/* Paste Notes — hidden during quiz */}
        {activeView !== "quiz" && (
          <div className="bg-white rounded-2xl border border-border/60 shadow-md shadow-primary/5 overflow-hidden">
            <div className="px-5 sm:px-6 pt-5 pb-3">
              <div className="flex items-center gap-2 mb-1">
                <FileText className="w-4 h-4 text-primary" />
                <h2 className="font-bold text-base text-foreground">Paste Your Notes</h2>
              </div>
              <p className="text-sm text-muted-foreground">Lecture notes, textbook passages, or any study material</p>
            </div>
            <div className="px-5 sm:px-6 pb-5">
              <textarea
                className="w-full h-44 px-4 py-3.5 text-sm rounded-xl border border-primary/20 bg-gradient-to-br from-primary/3 to-secondary/3 placeholder:text-muted-foreground/60 text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all duration-200"
                placeholder="Paste your study notes here… e.g. lecture notes, textbook passages, or any text you want to summarise and quiz yourself on."
                value={pastedNotes}
                onChange={handleNotesChange}
                data-testid="textarea-paste-notes"
              />
              {hasNotes && (
                <p className="text-xs text-muted-foreground text-right mt-2 font-medium" data-testid="text-word-count">
                  <span className="text-primary font-semibold">{wordCount}</span> {wordCount === 1 ? "word" : "words"} ready to process
                </p>
              )}
            </div>
          </div>
        )}

        {/* ── Action Cards ── */}
        {activeView === null && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">

            {/* Summary card */}
            <div className="group bg-white rounded-2xl border border-border/60 shadow-md shadow-primary/5 hover:shadow-xl hover:shadow-primary/10 hover:-translate-y-1 transition-all duration-300 flex flex-col overflow-hidden">
              <div className="p-6 flex-1">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center mb-4 shadow-md shadow-indigo-200">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <h3 className="font-bold text-base text-foreground mb-1">Generate Summary</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  AI extracts the key ideas and concepts from your notes
                </p>
              </div>
              <div className="px-6 pb-6">
                <Button
                  className="w-full bg-gradient-to-r from-violet-500 to-indigo-600 hover:from-violet-600 hover:to-indigo-700 text-white border-0 shadow-sm"
                  onClick={handleGenerateSummary}
                  disabled={!hasNotes}
                  data-testid="button-generate-summary"
                >
                  Generate Summary
                </Button>
                {!hasNotes && <p className="text-xs text-muted-foreground text-center mt-2">Paste notes above first</p>}
              </div>
            </div>

            {/* Quiz card */}
            <div className="group bg-white rounded-2xl border border-border/60 shadow-md shadow-secondary/5 hover:shadow-xl hover:shadow-secondary/10 hover:-translate-y-1 transition-all duration-300 flex flex-col overflow-hidden">
              <div className="p-6 flex-1">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center mb-4 shadow-md shadow-teal-200">
                  <Brain className="w-5 h-5 text-white" />
                </div>
                <h3 className="font-bold text-base text-foreground mb-1">Take a Quiz</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  MCQ, True/False &amp; Short Answer questions from your notes
                </p>
              </div>
              <div className="px-6 pb-6">
                <Button
                  className="w-full bg-gradient-to-r from-teal-400 to-emerald-500 hover:from-teal-500 hover:to-emerald-600 text-white border-0 shadow-sm"
                  onClick={handleStartQuiz}
                  disabled={!hasNotes}
                  data-testid="button-take-quiz"
                >
                  Take Quiz
                </Button>
                {!hasNotes && <p className="text-xs text-muted-foreground text-center mt-2">Paste notes above first</p>}
              </div>
            </div>

            {/* Progress card */}
            <div className="group bg-white rounded-2xl border border-border/60 shadow-md shadow-amber-500/5 hover:shadow-xl hover:shadow-amber-500/10 hover:-translate-y-1 transition-all duration-300 flex flex-col overflow-hidden">
              <div className="p-6 flex-1">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mb-4 shadow-md shadow-amber-200">
                  <TrendingUp className="w-5 h-5 text-white" />
                </div>
                <h3 className="font-bold text-base text-foreground mb-1">View Progress</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {stats.total > 0
                    ? `${stats.total} quiz${stats.total === 1 ? "" : "zes"} · ${stats.averagePct}% avg · ${stats.masteryPct}% mastery`
                    : "Track scores, mastery rate and study streaks"}
                </p>
              </div>
              <div className="px-6 pb-6">
                <Button
                  variant="outline"
                  className="w-full border-border/70 hover:bg-amber-50 hover:border-amber-200 hover:text-amber-800 transition-colors"
                  onClick={() => setActiveView("progress")}
                  data-testid="button-view-progress"
                >
                  View Progress
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ── About Section ── */}
        {activeView === null && (
          <div className="bg-white rounded-2xl border border-border/60 shadow-md overflow-hidden">
            <div className="flex items-center gap-3 px-6 pt-6 pb-4 border-b border-border/40">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary/15 to-secondary/15 flex items-center justify-center">
                <Info className="w-4 h-4 text-primary" />
              </div>
              <h2 className="font-bold text-base text-foreground">About Smart Study Companion</h2>
            </div>
            <div className="px-6 py-5 space-y-4">
              <p className="text-sm text-muted-foreground leading-relaxed">
                <span className="font-semibold text-foreground">Smart Study Companion</span> is an AI-inspired
                learning assistant that helps students summarize notes, generate quizzes and track learning
                progress — all without leaving your browser.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  {
                    icon: <Sparkles className="w-4 h-4" />,
                    iconBg: "bg-gradient-to-br from-violet-500 to-indigo-600",
                    title: "Summarize Notes",
                    desc: "Paste any lecture notes or textbook passage and instantly extract the most important concepts and key points.",
                  },
                  {
                    icon: <Brain className="w-4 h-4" />,
                    iconBg: "bg-gradient-to-br from-teal-400 to-emerald-500",
                    title: "Generate Quizzes",
                    desc: "Automatically create Multiple Choice, True/False and Short Answer questions directly from your study material.",
                  },
                  {
                    icon: <TrendingUp className="w-4 h-4" />,
                    iconBg: "bg-gradient-to-br from-amber-400 to-orange-500",
                    title: "Track Progress",
                    desc: "Monitor your quiz scores over time with charts, mastery rate and a full history of every quiz you've taken.",
                  },
                ].map((item) => (
                  <div key={item.title} className="flex gap-3 p-4 rounded-xl bg-muted/30 border border-border/40">
                    <div className={`w-8 h-8 rounded-lg ${item.iconBg} flex items-center justify-center text-white shrink-0 mt-0.5 shadow-sm`}>
                      {item.icon}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground mb-0.5">{item.title}</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground pt-1">
                Everything runs entirely in your browser. No account required, no data sent to any server.
              </p>
            </div>
          </div>
        )}

        {/* ── Summary View ── */}
        {activeView === "summary" && summaryDone && (
          <Card className="border-border/60 shadow-lg shadow-primary/8 bg-white" data-testid="section-summary">
            <CardHeader className="pb-0">
              <SectionHeader
                icon={<Sparkles className="w-5 h-5 text-white" />}
                iconBg="bg-gradient-to-br from-violet-500 to-indigo-600"
                title="Study Summary"
                description={`${wordCount} words analysed`}
                onBack={() => setActiveView(null)}
              />
            </CardHeader>
            <CardContent className="pt-0 space-y-5">
              {summaryError ? (
                <div className="flex items-start gap-3 rounded-xl bg-orange-50 border border-orange-200 p-4" data-testid="text-summary-error">
                  <AlertCircle className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-orange-800">
                    Unable to generate a meaningful summary. Please enter valid study notes with at least a few sentences.
                  </p>
                </div>
              ) : (
                <div data-testid="text-summary-content">
                  <div className="rounded-xl bg-gradient-to-br from-primary/5 to-secondary/5 border border-primary/10 p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-1.5 h-5 rounded-full bg-gradient-to-b from-violet-500 to-indigo-600" />
                      <p className="text-xs font-bold text-primary uppercase tracking-widest">Key Points Extracted</p>
                    </div>
                    <p className="text-sm text-foreground/85 leading-relaxed">{generatedSummary}</p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-3 px-1">
                    Key sentences were extracted based on keyword frequency and position in your notes.
                  </p>
                </div>
              )}
              <div className="flex flex-wrap gap-3 pt-4 border-t border-border/40">
                <Button variant="outline" onClick={() => setActiveView(null)} className="gap-2">
                  <ArrowLeft className="w-4 h-4" /> Back to Dashboard
                </Button>
                {!summaryError && (
                  <Button
                    className="gap-2 bg-gradient-to-r from-teal-400 to-emerald-500 hover:from-teal-500 hover:to-emerald-600 text-white border-0"
                    onClick={handleStartQuiz}
                    data-testid="button-quiz-from-summary"
                  >
                    <Brain className="w-4 h-4" /> Take a Quiz
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Quiz View ── */}
        {activeView === "quiz" && (
          <Card className="border-border/60 shadow-lg shadow-secondary/8 bg-white" data-testid="section-quiz">
            <CardHeader className="pb-0">
              <SectionHeader
                icon={<Brain className="w-5 h-5 text-white" />}
                iconBg="bg-gradient-to-br from-teal-400 to-emerald-500"
                title="Knowledge Quiz"
                description={
                  quizError
                    ? "Could not generate quiz"
                    : quizSubmitted
                    ? `Score: ${quizScore} / ${totalQuestions}`
                    : `${totalQuestions} questions from your notes`
                }
                onBack={() => setActiveView(null)}
              />
            </CardHeader>

            <CardContent className="pt-0 space-y-6">
              {quizError && (
                <div className="flex items-start gap-3 rounded-xl bg-orange-50 border border-orange-200 p-4" data-testid="text-quiz-error">
                  <AlertCircle className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-orange-800">Not enough content to generate a quiz.</p>
                    <p className="text-sm text-orange-700 mt-1">
                      Please paste more detailed notes — at least a few sentences with distinct terms and varied vocabulary.
                    </p>
                  </div>
                </div>
              )}

              {!quizError && !quizSubmitted && (
                <>
                  {/* Progress bar */}
                  {totalQuestions > 0 && (
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs text-muted-foreground font-medium">
                        <span>Progress</span>
                        <span>
                          {generatedQuestions.filter((q) => {
                            const ans = quizAnswers[q.id];
                            return q.type === "shortanswer"
                              ? typeof ans === "string" && (ans as string).trim().length > 0
                              : typeof ans === "number";
                          }).length} / {totalQuestions} answered
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-teal-400 to-emerald-500 transition-all duration-300"
                          style={{
                            width: `${Math.round(
                              (generatedQuestions.filter((q) => {
                                const ans = quizAnswers[q.id];
                                return q.type === "shortanswer"
                                  ? typeof ans === "string" && (ans as string).trim().length > 0
                                  : typeof ans === "number";
                              }).length / totalQuestions) * 100
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {generatedQuestions.map((q, qi) => {
                    const badge = getTypeBadge(q.type);
                    return (
                      <div key={q.id} className="space-y-3 pb-5 border-b border-border/30 last:border-0 last:pb-0" data-testid={`quiz-question-${qi}`}>
                        <div className="flex items-start gap-3">
                          <span className="shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-primary/80 to-primary text-white text-xs font-bold flex items-center justify-center shadow-sm">
                            {qi + 1}
                          </span>
                          <div className="flex-1 space-y-1.5">
                            <span className={`inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full ${badge.color}`}>
                              {badge.label}
                            </span>
                            <p className="text-sm font-semibold text-foreground">{q.question}</p>
                          </div>
                        </div>

                        {(q.type === "mcq" || q.type === "truefalse") && (
                          <div className={`grid gap-2 pl-10 ${q.type === "truefalse" ? "grid-cols-2" : "grid-cols-1"}`}>
                            {q.options.map((opt, oi) => {
                              const selected = quizAnswers[q.id] === oi;
                              return (
                                <button
                                  key={oi}
                                  onClick={() => handleSelectAnswer(q.id, oi)}
                                  data-testid={`quiz-q${qi}-option-${oi}`}
                                  className={`text-left px-4 py-3 rounded-xl text-sm border transition-all duration-150 font-medium ${
                                    selected
                                      ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20"
                                      : "bg-muted/40 border-border/60 text-foreground hover:border-primary/40 hover:bg-primary/5"
                                  }`}
                                >
                                  {opt}
                                </button>
                              );
                            })}
                          </div>
                        )}

                        {q.type === "shortanswer" && (
                          <div className="pl-10">
                            <input
                              type="text"
                              placeholder="Type your answer…"
                              value={(quizAnswers[q.id] as string) ?? ""}
                              onChange={(e) => handleSelectAnswer(q.id, e.target.value)}
                              data-testid={`quiz-q${qi}-shortanswer`}
                              className="w-full px-4 py-3 rounded-xl text-sm border border-border/60 bg-muted/40 text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}

                  <div className="pt-2 flex justify-end">
                    <Button
                      onClick={handleSubmitQuiz}
                      disabled={!allAnswered}
                      className="bg-gradient-to-r from-teal-400 to-emerald-500 hover:from-teal-500 hover:to-emerald-600 text-white border-0 shadow-md px-8"
                      data-testid="button-submit-quiz"
                    >
                      Submit Quiz
                    </Button>
                  </div>
                </>
              )}

              {!quizError && quizSubmitted && (
                <div className="space-y-8" data-testid="section-quiz-results">
                  {/* Score banner */}
                  <div className={`rounded-2xl p-6 text-center border ${
                    completionPct >= 80
                      ? "bg-gradient-to-br from-teal-50 to-emerald-50 border-teal-200"
                      : completionPct >= 60
                      ? "bg-gradient-to-br from-indigo-50 to-violet-50 border-indigo-200"
                      : "bg-gradient-to-br from-orange-50 to-red-50 border-orange-200"
                  }`}>
                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Your Score</p>
                    <p className="text-6xl font-extrabold tracking-tight mb-1" data-testid="text-quiz-score">
                      {quizScore}
                      <span className="text-2xl text-muted-foreground font-medium">/{totalQuestions}</span>
                    </p>
                    <p className="text-lg font-bold text-muted-foreground">{completionPct}% correct</p>
                    <p className={`text-sm mt-3 font-semibold ${
                      completionPct >= 80 ? "text-emerald-700" : completionPct >= 60 ? "text-indigo-700" : "text-orange-700"
                    }`}>
                      {completionPct === 100
                        ? "🏆 Perfect score! Outstanding work."
                        : completionPct >= 80
                        ? "🌟 Great job! Almost perfect."
                        : completionPct >= 60
                        ? "📚 Good effort! Keep studying."
                        : "💪 Keep practicing — you'll improve!"}
                    </p>
                  </div>

                  {generatedSummary && !summaryError && (
                    <div className="rounded-xl bg-gradient-to-br from-primary/5 to-secondary/5 border border-primary/10 p-5 space-y-2">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-1.5 h-4 rounded-full bg-gradient-to-b from-violet-500 to-indigo-600" />
                        <p className="text-xs font-bold text-primary uppercase tracking-widest">Study Summary</p>
                      </div>
                      <p className="text-sm text-foreground/80 leading-relaxed">{generatedSummary}</p>
                    </div>
                  )}

                  {/* Per-question review */}
                  <div className="space-y-5">
                    <p className="text-sm font-bold text-foreground uppercase tracking-wide">Answer Review</p>
                    {generatedQuestions.map((q, qi) => {
                      const correct = isCorrect(q);
                      const badge = getTypeBadge(q.type);
                      return (
                        <div key={q.id} className="space-y-2.5 pb-5 border-b border-border/30 last:border-0 last:pb-0">
                          <div className="flex items-start gap-2.5">
                            {correct
                              ? <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                              : <XCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />}
                            <div className="flex-1">
                              <span className={`inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full mb-1.5 ${badge.color}`}>
                                {badge.label}
                              </span>
                              <p className="text-sm font-semibold text-foreground">{qi + 1}. {q.question}</p>
                            </div>
                          </div>

                          {(q.type === "mcq" || q.type === "truefalse") && (
                            <div className="grid gap-1.5 pl-8">
                              {q.options.map((opt, oi) => {
                                const isChosen = quizAnswers[q.id] === oi;
                                const isCorrectOpt = q.answer === oi;
                                return (
                                  <div
                                    key={oi}
                                    className={`px-3.5 py-2.5 rounded-xl text-sm border font-medium ${
                                      isCorrectOpt
                                        ? "bg-emerald-50 border-emerald-300 text-emerald-800"
                                        : isChosen
                                        ? "bg-red-50 border-red-300 text-red-700"
                                        : "bg-muted/30 border-border/50 text-muted-foreground"
                                    }`}
                                  >
                                    {opt}
                                    {isCorrectOpt && <span className="ml-2 text-xs font-bold text-emerald-600">✓ Correct</span>}
                                    {isChosen && !isCorrectOpt && <span className="ml-2 text-xs font-bold text-red-500">✗ Your answer</span>}
                                  </div>
                                );
                              })}
                              {q.type === "truefalse" && q.isFalseStatement && (
                                <p className="text-xs text-muted-foreground pl-1 mt-0.5">
                                  This statement is false. The correct term is <strong>"{q.correctWord}"</strong>.
                                </p>
                              )}
                            </div>
                          )}

                          {q.type === "shortanswer" && (
                            <div className="pl-8 space-y-1.5">
                              <div className={`px-3.5 py-2.5 rounded-xl text-sm border font-medium ${correct ? "bg-emerald-50 border-emerald-300 text-emerald-800" : "bg-red-50 border-red-300 text-red-700"}`}>
                                Your answer: <span className="font-bold">{(quizAnswers[q.id] as string) || "(blank)"}</span>
                              </div>
                              <div className="px-3.5 py-2.5 rounded-xl text-sm bg-emerald-50 border border-emerald-300 text-emerald-800 font-medium">
                                ✓ Expected: <span className="capitalize font-bold">{q.correctWord}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex flex-wrap gap-3 pt-2 border-t border-border/40">
                    <Button variant="outline" onClick={() => setActiveView(null)} className="gap-2">
                      <ArrowLeft className="w-4 h-4" /> Back to Dashboard
                    </Button>
                    <Button
                      className="bg-gradient-to-r from-teal-400 to-emerald-500 hover:from-teal-500 hover:to-emerald-600 text-white border-0"
                      onClick={handleStartQuiz}
                      data-testid="button-retake-quiz"
                    >
                      Retake Quiz
                    </Button>
                    <Button
                      variant="ghost"
                      className="ml-auto text-muted-foreground hover:text-foreground"
                      onClick={() => setActiveView("progress")}
                      data-testid="button-view-progress-from-quiz"
                    >
                      <TrendingUp className="w-4 h-4 mr-1.5" /> View Progress
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ── Progress Dashboard ── */}
        {activeView === "progress" && (
          <div className="space-y-6" data-testid="section-progress">
            {/* Header */}
            <div className="bg-white rounded-2xl border border-border/60 shadow-md p-6">
              <SectionHeader
                icon={<TrendingUp className="w-5 h-5 text-white" />}
                iconBg="bg-gradient-to-br from-amber-400 to-orange-500"
                title="Your Progress"
                description={stats.total > 0 ? `${stats.total} quiz${stats.total === 1 ? "" : "zes"} completed` : "No quizzes yet"}
                onBack={() => setActiveView(null)}
              />

              {stats.total === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
                    <BarChart2 className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <p className="text-base font-semibold text-foreground mb-1">No quiz history yet</p>
                  <p className="text-sm text-muted-foreground">Complete your first quiz to start tracking your progress.</p>
                  <Button
                    variant="outline"
                    className="mt-5"
                    onClick={() => setActiveView(null)}
                  >
                    Go to Dashboard
                  </Button>
                </div>
              ) : (
                <>
                  {/* Stat cards */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <StatCard
                      icon={<Trophy className="w-4 h-4 text-amber-600" />}
                      label="Quizzes Taken"
                      value={String(stats.total)}
                      sub="total completed"
                      accent="bg-amber-50 border-amber-200 text-amber-900"
                      iconBg="bg-amber-100"
                    />
                    <StatCard
                      icon={<Star className="w-4 h-4 text-violet-600" />}
                      label="Highest Score"
                      value={`${stats.highestPct}%`}
                      sub={`${stats.highestScore}/${stats.highestTotal} questions`}
                      accent="bg-violet-50 border-violet-200 text-violet-900"
                      iconBg="bg-violet-100"
                    />
                    <StatCard
                      icon={<Target className="w-4 h-4 text-teal-600" />}
                      label="Average Score"
                      value={`${stats.averagePct}%`}
                      sub="across all quizzes"
                      accent="bg-teal-50 border-teal-200 text-teal-900"
                      iconBg="bg-teal-100"
                    />
                    <StatCard
                      icon={<TrendingUp className="w-4 h-4 text-indigo-600" />}
                      label="Last Score"
                      value={`${stats.lastScore}/${stats.lastTotal}`}
                      sub={`${stats.lastPct}% correct`}
                      accent="bg-indigo-50 border-indigo-200 text-indigo-900"
                      iconBg="bg-indigo-100"
                    />
                  </div>

                  {/* Mastery rate */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-semibold text-foreground">Mastery Rate</span>
                      <span className="text-sm font-bold text-primary">{stats.masteryPct}%</span>
                    </div>
                    <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-primary to-secondary transition-all duration-700 ease-out"
                        style={{ width: `${stats.masteryPct}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Percentage of quizzes where you scored 80% or higher
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* Chart */}
            {history.length > 0 && (
              <div className="bg-white rounded-2xl border border-border/60 shadow-md p-6">
                <div className="flex items-center gap-2 mb-5">
                  <BarChart2 className="w-4 h-4 text-primary" />
                  <h3 className="font-bold text-base text-foreground">Score History</h3>
                  <span className="ml-auto text-xs text-muted-foreground">Last {Math.min(history.length, 15)} quizzes</span>
                </div>
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} barSize={24} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(240 15% 93%)" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(240 8% 55%)" }} axisLine={false} tickLine={false} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "hsl(240 8% 55%)" }} axisLine={false} tickLine={false} />
                      <Tooltip content={<CustomTooltip />} cursor={{ fill: "hsl(240 20% 96%)", radius: 6 }} />
                      <ReferenceLine y={80} stroke="hsl(243 85% 70%)" strokeDasharray="4 4" strokeOpacity={0.6} />
                      <Bar dataKey="score" radius={[6, 6, 0, 0]}>
                        {chartData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={
                              entry.score >= 80
                                ? "hsl(172 66% 46%)"
                                : entry.score >= 60
                                ? "hsl(243 85% 62%)"
                                : "hsl(0 72% 65%)"
                            }
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex items-center gap-5 mt-4 justify-center">
                  {[
                    { color: "bg-secondary", label: "≥ 80% (Mastery)" },
                    { color: "bg-primary", label: "60–79%" },
                    { color: "bg-red-400", label: "< 60%" },
                  ].map((l) => (
                    <div key={l.label} className="flex items-center gap-1.5">
                      <div className={`w-2.5 h-2.5 rounded-sm ${l.color}`} />
                      <span className="text-xs text-muted-foreground">{l.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent quizzes */}
            {history.length > 0 && (
              <div className="bg-white rounded-2xl border border-border/60 shadow-md p-6">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-2">
                    <ClipboardList className="w-4 h-4 text-primary" />
                    <h3 className="font-bold text-base text-foreground">Recent Quizzes</h3>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive hover:bg-destructive/5 gap-1.5 text-xs"
                    onClick={handleClearHistory}
                    data-testid="button-clear-history"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Clear History
                  </Button>
                </div>
                <div className="space-y-3">
                  {history
                    .slice(-5)
                    .reverse()
                    .map((r, i) => (
                      <div key={i} className="flex items-center gap-4 p-3.5 rounded-xl bg-muted/30 border border-border/40 hover:bg-muted/50 transition-colors">
                        <div className={`w-2 h-8 rounded-full shrink-0 ${
                          r.percentage >= 80 ? "bg-secondary" : r.percentage >= 60 ? "bg-primary" : "bg-red-400"
                        }`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground">
                            {r.score}/{r.total} correct
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {new Date(r.date).toLocaleString()}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className={`text-lg font-extrabold leading-tight ${
                            r.percentage >= 80 ? "text-secondary" : r.percentage >= 60 ? "text-primary" : "text-red-500"
                          }`}>
                            {r.percentage}%
                          </p>
                          <div className="w-20 h-1.5 rounded-full bg-muted overflow-hidden mt-1">
                            <div
                              className={`h-full rounded-full ${
                                r.percentage >= 80 ? "bg-secondary" : r.percentage >= 60 ? "bg-primary" : "bg-red-400"
                              }`}
                              style={{ width: `${r.percentage}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* ── Footer ── */}
      <footer className="relative z-10 border-t border-border/40 py-6 mt-4">
        <div className="max-w-5xl mx-auto px-4 sm:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-muted-foreground">
            <GraduationCap className="w-4 h-4" />
            <span className="text-xs font-medium">Smart Study Companion</span>
          </div>
          <p className="text-xs text-muted-foreground text-center">
            All processing happens locally in your browser · No data is stored externally
          </p>
        </div>
      </footer>
    </div>
  );
}
