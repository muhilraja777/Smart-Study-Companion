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
import { GraduationCap, UserPlus, ArrowRight, Sparkles, Brain, TrendingUp } from "lucide-react";
import { registerUser, setSession, loginUser } from "@/lib/user-store";

const registerSchema = z.object({
  username: z
    .string()
    .min(2, "Username must be at least 2 characters")
    .max(30, "Username must be under 30 characters")
    .regex(/^[a-zA-Z0-9_]+$/, "Only letters, numbers and underscores"),
  email: z.string().email("Enter a valid email address"),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function Register() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { username: "", email: "", password: "", confirmPassword: "" },
  });

  const onSubmit = (data: RegisterFormValues) => {
    const result = registerUser(data.username, data.email, data.password);

    if (result === "email_taken") {
      form.setError("email", { message: "An account with this email already exists" });
      return;
    }
    if (result === "username_taken") {
      form.setError("username", { message: "This username is already taken" });
      return;
    }

    const user = loginUser(data.email, data.password)!;
    setSession(user);

    toast({
      title: "Account created!",
      description: `Welcome, ${data.username}. Let's start studying.`,
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
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-10">
        {/* Hero */}
        <div className="text-center mb-8 space-y-2">
          <div className="inline-flex items-center gap-2 bg-primary/8 text-primary text-xs font-semibold px-4 py-1.5 rounded-full border border-primary/15 mb-2">
            <UserPlus className="w-3.5 h-3.5" />
            Create your free account
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
            Start Learning{" "}
            <span className="text-gradient">Smarter Today</span>
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base max-w-sm mx-auto">
            Your account is stored locally — no servers, no subscriptions, no data shared.
          </p>
        </div>

        {/* Registration card */}
        <div className="w-full max-w-sm">
          <div className="bg-white rounded-2xl shadow-xl shadow-primary/8 border border-border/60 p-7 sm:p-8">
            <div className="mb-5">
              <h2 className="text-xl font-bold text-foreground">Create an account</h2>
              <p className="text-sm text-muted-foreground mt-1">Fill in your details below</p>
            </div>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-foreground/80">Username</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g. student123"
                          data-testid="input-username"
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
                          placeholder="At least 6 characters"
                          data-testid="input-password"
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
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-foreground/80">Confirm Password</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="Re-enter your password"
                          data-testid="input-confirm-password"
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
                  className="w-full h-11 font-semibold gap-2 bg-primary hover:bg-primary/90 shadow-md shadow-primary/25 hover:shadow-lg hover:shadow-primary/30 transition-all duration-200 hover:-translate-y-0.5 mt-1"
                  data-testid="button-register"
                >
                  Create Account <ArrowRight className="w-4 h-4" />
                </Button>
              </form>
            </Form>

            <div className="mt-5 pt-5 border-t border-border/40 text-center">
              <p className="text-sm text-muted-foreground">
                Already have an account?{" "}
                <button
                  onClick={() => setLocation("/")}
                  className="font-semibold text-primary hover:underline"
                >
                  Sign in
                </button>
              </p>
            </div>
          </div>

          {/* Feature pills */}
          <div className="mt-5 grid grid-cols-3 gap-3">
            {[
              { icon: <Sparkles className="w-4 h-4" />, label: "Smart Summaries", bg: "bg-violet-50", gradient: "from-violet-500 to-indigo-600", text: "text-violet-700" },
              { icon: <Brain className="w-4 h-4" />, label: "AI Quizzes", bg: "bg-teal-50", gradient: "from-teal-400 to-emerald-500", text: "text-teal-700" },
              { icon: <TrendingUp className="w-4 h-4" />, label: "Progress", bg: "bg-amber-50", gradient: "from-amber-400 to-orange-500", text: "text-amber-700" },
            ].map((f) => (
              <div key={f.label} className={`${f.bg} rounded-xl p-3 flex flex-col items-center gap-1.5 text-center`}>
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
