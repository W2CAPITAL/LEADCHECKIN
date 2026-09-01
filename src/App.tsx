import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  ExternalLink,
  LayoutDashboard,
  LogOut,
  Plus,
  RefreshCw,
  ScanSearch,
  Search,
  Users,
} from 'lucide-react';
import type { Lead, LeadStatus } from './types';
import { configured, supabase } from './supabase';

const statuses: LeadStatus[] = [
  'novo',
  'contatado',
  'qualificado',
  'proposta',
  'convertido',
  'perdido',
];

function calculateScore(lead: Partial<Lead>) {
  let value = 0;
  if (lead.phone) value += 25;
  if (lead.email) value += 20;
  if (lead.company) value += 20;
  if (lead.consent_at) value += 20;
  if (lead.source === 'site_publico') value += 10;
  if (lead.interest) value += 5;
  return Math.min(100, value);
}

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [view, setView] = useState<'dashboard' | 'crm' | 'scanner'>('dashboard');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [scanUrl, setScanUrl] = useState('');
  const [scan, setScan] = useState<any>(null);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  async function load() {
    if (!supabase || !session) return;
    setBusy(true);
    let query = supabase
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status as LeadStatus);
    if (q.trim()) {
      const term = q.trim().replace(/[%(),]/g, ' ');
      query = query.or(
        `name.ilike.%${term}%,email.ilike.%${term}%,company.ilike.%${term}%,phone.ilike.%${term}%`,
      );
    }

    const { data, error } = await query;
    setBusy(false);
    if (error) setMsg(error.message);
    else setLeads((data || []) as Lead[]);
  }

  useEffect(() => {
    void load();
  }, [session, status, q]);

  async function authenticate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    setMsg('');
    const result =
      mode === 'login'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });

    if (result.error) setMsg(result.error.message);
    else if (mode === 'signup') {
      setMsg('Conta criada. Verifique o e-mail se a confirmação estiver ativada.');
    }
  }

  async function addLead(data: Partial<Lead>) {
    if (!supabase || !session) return;
    const payload = {
      name: data.name || 'Novo lead',
      phone: data.phone || null,
      email: data.email || null,
      company: data.company || null,
      source: data.source || 'manual',
      source_url: data.source_url || null,
      source_detail: data.source_detail || null,
      status: data.status || 'novo',
      score: calculateScore(data),
      interest: data.interest || null,
      notes: data.notes || null,
      consent_at: data.consent_at || null,
      consent_source: data.consent_source || null,
      owner_id: session.user.id,
    };

    const { error } = await supabase.from('leads').insert(payload);
    if (error) setMsg(error.message);
    else {
      setMsg('Lead salvo no CRM.');
      await load();
    }
  }

  async function updateLead(id: string, patch: Partial<Lead>) {
    if (!supabase) return;
    const { error } = await supabase.from('leads').update(patch).eq('id', id);
    if (error) setMsg(error.message);
    else await load();
  }

  async function scanPage() {
    setBusy(true);
    setScan(null);
    setMsg('');
    try {
      const response = await fetch('/api/public-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: scanUrl }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Falha no scanner');
      setScan(result);
    } catch (error) {
      setMsg(error instanceof Error ? error.message : 'Falha no scanner');
    } finally {
      setBusy(false);
    }
  }

  const total = leads.length;
  const qualified = leads.filter(
    (lead) => lead.status === 'qualificado' || lead.status === 'proposta',
  ).length;
  const converted = leads.filter((lead) => lead.status === 'convertido').length;
  const conversionRate = total ? Math.round((converted / total) * 100) : 0;

  if (!configured) {
    return (
      <div className="center">
        <div className="card">
          <h1>Leadcheck</h1>
          <p>
            Configure <code>VITE_SUPABASE_URL</code> e{' '}
            <code>VITE_SUPABASE_ANON_KEY</code> na Vercel.
          </p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="center">
        <form className="card auth" onSubmit={authenticate}>
          <div className="logo">LC</div>
          <h1>Leadcheck</h1>
          <p>CRM + geração de leads.</p>
          <input
            placeholder="E-mail"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <input
            placeholder="Senha"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={6}
          />
          <button type="submit">{mode === 'login' ? 'Entrar' : 'Criar conta'}</button>
          {msg && <small>{msg}</small>}
          <button
            type="button"
            className="linkButton"
            onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
          >
            {mode === 'login' ? 'Criar uma conta' : 'Já tenho conta'}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="app">
      <aside>
        <div className="brand">
          <b>LC</b>
          <span>Leadcheck</span>
        </div>
        <button className={view === 'dashboard' ? 'nav active' : 'nav'} onClick={() => setView('dashboard')}>
          <LayoutDashboard /> Dashboard
        </button>
        <button className={view === 'crm' ? 'nav active' : 'nav'} onClick={() => setView('crm')}>
          <Users /> CRM
        </button>
        <button className={view === 'scanner' ? 'nav active' : 'nav'} onClick={() => setView('scanner')}>
          <ScanSearch /> Lead Generator
        </button>
        <div className="sideBottom">
          <button className="nav" onClick={() => supabase?.auth.signOut()}>
            <LogOut /> Sair
          </button>
        </div>
      </aside>

      <main>
        <header>
          <div>
            <h2>
              {view === 'dashboard' ? 'Visão geral' : view === 'crm' ? 'CRM de leads' : 'Lead Generator'}
            </h2>
            <span>Base própria • Supabase • Vercel</span>
          </div>
          <button className="icon" onClick={() => void load()} title="Atualizar">
            <RefreshCw size={18} />
          </button>
        </header>

        {msg && <div className="notice">{msg}</div>}

        {view === 'dashboard' && (
          <>
            <section className="grid">
              <div className="metric"><span>Leads</span><strong>{total}</strong></div>
              <div className="metric"><span>Qualificados</span><strong>{qualified}</strong></div>
              <div className="metric"><span>Convertidos</span><strong>{converted}</strong></div>
              <div className="metric"><span>Taxa conversão</span><strong>{conversionRate}%</strong></div>
            </section>
            <section className="card">
              <div className="sectionTitle">
                <h3>Últimos leads</h3>
                <button onClick={() => setView('crm')}>Abrir CRM <ArrowRight size={16} /></button>
              </div>
              <LeadTable leads={leads.slice(0, 8)} update={updateLead} />
            </section>
          </>
        )}

        {view === 'crm' && (
          <section className="card">
            <div className="toolbar">
              <div className="search">
                <Search size={16} />
                <input
                  placeholder="Buscar nome, empresa, e-mail ou telefone"
                  value={q}
                  onChange={(event) => setQ(event.target.value)}
                />
              </div>
              <select value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="">Todos os status</option>
                {statuses.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
              <button onClick={() => void addLead({ name: 'Novo lead', source: 'manual' })}>
                <Plus size={16} /> Novo lead
              </button>
            </div>
            <LeadTable leads={leads} update={updateLead} />
            {busy && <small className="muted">Atualizando…</small>}
          </section>
        )}

        {view === 'scanner' && (
          <>
            <section className="card">
              <h3>Scanner de páginas públicas</h3>
              <p className="muted">
                Encontre contatos comerciais publicados pela própria empresa. Registre a origem antes de usar o lead.
              </p>
              <div className="scanrow">
                <input
                  placeholder="https://empresa.com.br/contato"
                  value={scanUrl}
                  onChange={(event) => setScanUrl(event.target.value)}
                />
                <button onClick={() => void scanPage()} disabled={busy || !scanUrl}>
                  <ScanSearch size={16} /> {busy ? 'Consultando…' : 'Escanear'}
                </button>
              </div>
            </section>

            {scan && (
              <section className="card">
                <div className="scanResult">
                  <div>
                    <b>{scan.title || 'Página pública'}</b>
                    <span>{scan.url}</span>
                  </div>
                  <div>
                    <h4>E-mails</h4>
                    <p>{scan.emails?.join(', ') || 'Nenhum encontrado'}</p>
                    <h4>Telefones</h4>
                    <p>{scan.phones?.join(', ') || 'Nenhum encontrado'}</p>
                  </div>
                  <button
                    onClick={() =>
                      void addLead({
                        name: scan.title || 'Empresa encontrada',
                        company: scan.title || null,
                        email: scan.emails?.[0] || null,
                        phone: scan.phones?.[0] || null,
                        source: 'site_publico',
                        source_url: scan.url,
                        source_detail: 'Contato publicado em página pública',
                      })
                    }
                  >
                    <Plus size={16} /> Salvar no CRM
                  </button>
                </div>
              </section>
            )}

            <section className="card">
              <h3>Importação gratuita</h3>
              <p className="muted">
                A versão inicial não depende de WhatsApp, APIs pagas ou CNPJ. O CRM aceita leads manuais e o scanner trabalha com páginas públicas.
              </p>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function LeadTable({
  leads,
  update,
}: {
  leads: Lead[];
  update: (id: string, patch: Partial<Lead>) => void;
}) {
  const rows = useMemo(() => leads, [leads]);

  return (
    <div className="tableWrap">
      <table>
        <thead>
          <tr><th>Lead</th><th>Origem</th><th>Score</th><th>Status</th><th>Contato</th><th /></tr>
        </thead>
        <tbody>
          {rows.map((lead) => (
            <tr key={lead.id}>
              <td><b>{lead.name}</b><small>{lead.company || '—'}</small></td>
              <td>{lead.source}</td>
              <td><span className="score">{lead.score}</span></td>
              <td>
                <select
                  value={lead.status}
                  onChange={(event) => update(lead.id, { status: event.target.value as LeadStatus })}
                >
                  {statuses.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </td>
              <td><small>{lead.email || lead.phone || '—'}</small></td>
              <td>
                {lead.source_url && (
                  <a href={lead.source_url} target="_blank" rel="noreferrer" aria-label="Abrir origem">
                    <ExternalLink size={16} />
                  </a>
                )}
              </td>
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={6} className="empty">Nenhum lead ainda.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
