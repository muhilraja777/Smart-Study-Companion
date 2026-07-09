import { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { useLocation } from "wouter";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { GraduationCap, ArrowRight, Sparkles, Brain, TrendingUp, AlertCircle } from "lucide-react";
import { loginUser, setSession } from "@/lib/user-store";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

const FEATURES = [
  {
    icon: <Sparkles className="w-4 h-4" />,
    label: "Smart Summaries",
    desc: "Key ideas extracted instantly",
    gradient: "from-violet-500 to-indigo-600",
    bg: "bg-violet-50",
    text: "text-violet-700",
  },
  {
    icon: <Brain className="w-4 h-4" />,
    label: "Concept Quizzes",
    desc: "MCQ, True/False & Short Answer",
    gradient: "from-teal-400 to-emerald-500",
    bg: "bg-teal-50",
    text: "text-teal-700",
  },
  {
    icon: <TrendingUp className="w-4 h-4" />,
    label: "Progress Tracking",
    desc: "Charts, streaks & mastery rate",
    gradient: "from-amber-400 to-orange-500",
    bg: "bg-amber-50",
    text: "text-amber-700",
  },
];

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [authError, setAuthError] = useState(false);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = (data: LoginFormValues) => {
    setAuthError(false);
    const user = loginUser(data.email, data.password);
    if (!user) {
      setAuthError(true);
      return;
    }
    setSession(user);
    toast({
      title: `Welcome back, ${user.username}!`,
      description: "Redirecting to your study space…",
    });
    setLocation("/dashboard");
  };

  return (
    <div className="min-h-[100dvh] w-full flex flex-col bg-background">
      {/* Ambient glows */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -left-32 w-[600px] h-[600px] rounded-full bg-primary/8 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 w-[500px] h-[500px] rounded-full bg-secondary/8 blur-3xl" />
      </div>

      {/* Nav */}
      <header className="relative z-10 flex items-center justify-between px-6 sm:px-10 py-5">
        <div className="flex items-center gap-2.5">
          <div className="bg-gradient-to-br from-primary to-primary/70 p-2 rounded-xl shadow-md shadow-primary/20">
            <GraduationCap className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-base tracking-tight text-foreground">
            Smart Study Companion
          </span>
        </div>
        <span className="text-xs font-medium text-muted-foreground bg-muted px-3 py-1.5 rounded-full">
          For College Students
        </span>
      </header>

      {/* Content */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-12">
        {/* Hero */}
        <div className="text-center mb-10 space-y-3">
          <div className="inline-flex items-center gap-2 bg-primary/8 text-primary text-xs font-semibold px-4 py-1.5 rounded-full border border-primary/15 mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            AI-Powered · 100% Offline · Free
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-foreground">
            Study Smarter,{" "}
            <span className="text-gradient">Not Harder</span>
          </h1>
          <p className="text-muted-foreground text-base sm:text-lg max-w-sm mx-auto leading-relaxed">
            Paste your notes. Get summaries, quizzes and progress tracking — all in seconds.
          </p>
        </div>

        {/* Login card */}
        <div className="w-full max-w-sm">
          <div className="bg-white rounded-2xl shadow-xl shadow-primary/8 border border-border/60 p-7 sm:p-8">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-foreground">Sign in to your space</h2>
              <p className="text-sm text-muted-foreground mt-1">Enter your email and password</p>
            </div>

            {authError && (
              <div className="flex items-center gap-2.5 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 mb-4 text-sm font-medium">
                <AlertCircle className="w-4 h-4 shrink-0" />
                Invalid email or password
              </div>
            )}

            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-4"
                onChange={() => setAuthError(false)}
              >
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-foreground/80">Email</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="student@university.edu"
                          data-testid="input-email"
                          className="h-10 bg-muted/50 border-border/70 focus:bg-white transition-colors"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-foreground/80">Password</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="••••••••"
                          data-testid="input-password"
                          className="h-10 bg-muted/50 border-border/70 focus:bg-white transition-colors"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  className="w-full h-11 font-semibold gap-2 bg-primary hover:bg-primary/90 shadow-md shadow-primary/25 hover:shadow-lg hover:shadow-primary/30 transition-all duration-200 hover:-translate-y-0.5 mt-2"
                  data-testid="button-login"
                >
                  Sign In <ArrowRight className="w-4 h-4" />
                </Button>
              </form>
            </Form>

            <div className="mt-5 pt-5 border-t border-border/40 text-center">
              <p className="text-sm text-muted-foreground">
                Don't have an account?{" "}
                <button
                  onClick={() => setLocation("/register")}
                  className="font-semibold text-primary hover:underline"
                  data-testid="link-register"
                >
                  Create one free
                </button>
              </p>
            </div>
          </div>

          {/* Feature pills */}
          <div className="mt-6 grid grid-cols-3 gap-3">
            {FEATURES.map((f) => (
              <div key={f.label} className={`${f.bg} rounded-xl p-3 flex flex-col items-center gap-1.5 text-center border border-transparent`}>
                <div className={`bg-gradient-to-br ${f.gradient} p-1.5 rounded-lg text-white`}>
                  {f.icon}
                </div>
                <span className={`text-xs font-semibold ${f.text} leading-tight`}>{f.label}</span>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 py-5 text-center border-t border-border/40">
        <p className="text-xs text-muted-foreground">
          Smart Study Companion · All processing happens in your browser · No data is stored externally
        </p>
      </footer>
    </div>
  );
}
