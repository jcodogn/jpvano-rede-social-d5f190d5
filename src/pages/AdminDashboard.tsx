import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/layout/AppLayout";
import { ArrowLeft, Users, Image, Megaphone, DollarSign, Shield, TrendingUp, Wallet, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ users: 0, posts: 0, campaigns: 0, revenue: 0 });
  const [balance, setBalance] = useState(0);
  const [balanceId, setBalanceId] = useState<string | null>(null);
  const [newBalance, setNewBalance] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [recentUsers, setRecentUsers] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"overview" | "users" | "reports" | "finance">("overview");

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/login"); return; }

      // Check admin role
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin");

      if (!roles || roles.length === 0) {
        toast.error("Acesso negado. Você não é administrador.");
        navigate("/feed");
        return;
      }

      setIsAdmin(true);

      // Fetch real stats in parallel
      const [usersRes, postsRes, campaignsRes, paymentsRes, balanceRes, recentUsersRes, reportsRes] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("posts").select("id", { count: "exact", head: true }),
        supabase.from("ad_campaigns").select("id", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("payments").select("amount_cents").eq("status", "completed"),
        supabase.from("admin_balance").select("*").eq("admin_id", user.id).maybeSingle(),
        supabase.from("profiles").select("id, username, display_name, avatar_url, created_at").order("created_at", { ascending: false }).limit(20),
        supabase.from("reports").select("*, profiles:reporter_id(username)").order("created_at", { ascending: false }).limit(20),
      ]);

      const totalRevenue = (paymentsRes.data || []).reduce((sum: number, p: any) => sum + p.amount_cents, 0);

      setStats({
        users: usersRes.count || 0,
        posts: postsRes.count || 0,
        campaigns: campaignsRes.count || 0,
        revenue: totalRevenue,
      });

      if (balanceRes.data) {
        setBalance(balanceRes.data.balance_cents);
        setBalanceId(balanceRes.data.id);
      } else {
        // Create balance record for admin
        const { data: newBal } = await supabase
          .from("admin_balance")
          .insert({ admin_id: user.id, balance_cents: 0 })
          .select()
          .single();
        if (newBal) {
          setBalanceId(newBal.id);
          setBalance(0);
        }
      }

      setRecentUsers(recentUsersRes.data || []);
      setReports(reportsRes.data || []);
      setLoading(false);
    };
    init();
  }, [navigate]);

  const updateBalance = async () => {
    const cents = Math.round(parseFloat(newBalance) * 100);
    if (isNaN(cents) || cents < 0) { toast.error("Valor inválido"); return; }
    if (!balanceId) return;

    const { error } = await supabase
      .from("admin_balance")
      .update({ balance_cents: cents, updated_at: new Date().toISOString() })
      .eq("id", balanceId);

    if (error) { toast.error("Erro ao atualizar saldo"); return; }

    // Log the action
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("activity_logs").insert({
        user_id: user.id,
        action: "admin_balance_update",
        metadata: { old_balance: balance, new_balance: cents },
      });
    }

    setBalance(cents);
    setNewBalance("");
    toast.success("Saldo atualizado!");
  };

  const requestWithdrawal = async () => {
    const cents = Math.round(parseFloat(withdrawAmount) * 100);
    if (isNaN(cents) || cents <= 0) { toast.error("Valor inválido"); return; }
    if (cents > balance) { toast.error("Saldo insuficiente"); return; }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Create withdrawal request
    const { data: withdrawal, error } = await supabase.from("withdrawal_requests").insert({
      admin_id: user.id,
      amount_cents: cents,
      status: "pending",
    }).select().single();

    if (error || !withdrawal) { toast.error("Erro ao solicitar saque"); return; }

    // Process via Stripe
    toast.loading("Processando saque via Stripe...", { id: "withdrawal" });

    const { data: result, error: fnError } = await supabase.functions.invoke("process-withdrawal", {
      body: { withdrawal_id: withdrawal.id },
    });

    if (fnError || result?.error) {
      toast.error(result?.error || "Erro ao processar saque", { id: "withdrawal" });
      // Revert withdrawal status
      await supabase.from("withdrawal_requests").update({ status: "failed" }).eq("id", withdrawal.id);
      return;
    }

    // Debit balance
    await supabase
      .from("admin_balance")
      .update({ balance_cents: balance - cents, updated_at: new Date().toISOString() })
      .eq("id", balanceId);

    setBalance(balance - cents);
    setWithdrawAmount("");
    toast.success("Saque processado com sucesso via Stripe!", { id: "withdrawal" });
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
  };

  if (loading || !isAdmin) {
    return (
      <AppLayout hideNav>
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout hideNav>
      <header className="sticky top-0 z-40 flex items-center gap-4 border-b border-border bg-background px-4 py-3">
        <button onClick={() => navigate(-1)} className="text-foreground">
          <ArrowLeft className="h-6 w-6" />
        </button>
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <h1 className="font-display text-xl font-bold">Painel Admin</h1>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex border-b border-border">
        {(["overview", "users", "reports", "finance"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-3 text-xs font-medium transition-colors ${
              activeTab === tab ? "border-b-2 border-primary text-foreground" : "text-muted-foreground"
            }`}
          >
            {tab === "overview" ? "Visão Geral" : tab === "users" ? "Usuários" : tab === "reports" ? "Denúncias" : "Finanças"}
          </button>
        ))}
      </div>

      <div className="p-4 space-y-4">
        {activeTab === "overview" && (
          <>
            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: Users, label: "Usuários", value: stats.users.toLocaleString(), color: "text-primary" },
                { icon: Image, label: "Posts", value: stats.posts.toLocaleString(), color: "text-accent" },
                { icon: Megaphone, label: "Campanhas Ativas", value: stats.campaigns.toLocaleString(), color: "text-primary" },
                { icon: DollarSign, label: "Receita Total", value: formatCurrency(stats.revenue), color: "text-accent" },
              ].map(({ icon: Icon, label, value, color }) => (
                <div key={label} className="rounded-xl border border-border bg-card p-4">
                  <Icon className={`h-5 w-5 ${color} mb-2`} />
                  <p className="text-lg font-bold">{value}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 mb-3">
                <Wallet className="h-5 w-5 text-primary" />
                <h3 className="font-display font-semibold">Saldo Disponível</h3>
              </div>
              <p className="text-2xl font-bold gradient-text">{formatCurrency(balance)}</p>
            </div>
          </>
        )}

        {activeTab === "users" && (
          <div className="space-y-2">
            <h3 className="font-display font-semibold">Usuários Recentes</h3>
            {recentUsers.map((u) => (
              <div key={u.id} className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
                <div className="h-10 w-10 rounded-full bg-secondary overflow-hidden shrink-0">
                  {u.avatar_url ? (
                    <img src={u.avatar_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-muted-foreground">
                      {u.username?.charAt(0)?.toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate">{u.username}</p>
                  <p className="text-xs text-muted-foreground">{u.display_name || "Sem nome"}</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => navigate(`/user/${u.id}`)}>Ver</Button>
              </div>
            ))}
          </div>
        )}

        {activeTab === "reports" && (
          <div className="space-y-2">
            <h3 className="font-display font-semibold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" /> Denúncias
            </h3>
            {reports.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma denúncia</p>
            ) : (
              reports.map((r: any) => (
                <div key={r.id} className="rounded-lg border border-border bg-card p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{r.reason}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      r.status === "pending" ? "bg-accent/20 text-accent" : "bg-muted text-muted-foreground"
                    }`}>
                      {r.status}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    por @{r.profiles?.username || "desconhecido"}
                  </p>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === "finance" && (
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-card p-4">
              <h3 className="font-display font-semibold mb-2">Saldo Atual</h3>
              <p className="text-3xl font-bold gradient-text mb-4">{formatCurrency(balance)}</p>

              <div className="space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Editar saldo (R$)</label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={newBalance}
                      onChange={(e) => setNewBalance(e.target.value)}
                      placeholder="0.00"
                      className="flex-1 bg-secondary border-border"
                    />
                    <Button onClick={updateBalance} variant="brand" size="sm">Atualizar</Button>
                  </div>
                </div>

                <div className="border-t border-border pt-3">
                  <label className="text-xs text-muted-foreground mb-1 block">Solicitar saque (R$)</label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      placeholder="0.00"
                      className="flex-1 bg-secondary border-border"
                    />
                    <Button onClick={requestWithdrawal} size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90">Sacar</Button>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-4">
              <h3 className="font-display font-semibold mb-2 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" /> Resumo Financeiro
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Receita total</span>
                  <span className="font-semibold">{formatCurrency(stats.revenue)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Saldo disponível</span>
                  <span className="font-semibold">{formatCurrency(balance)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Campanhas ativas</span>
                  <span className="font-semibold">{stats.campaigns}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default AdminDashboard;
