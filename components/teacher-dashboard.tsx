/* Área do professor / atividade privada, calendário e consumo informado pelos provedores. */
import { useEffect, useState, type CSSProperties } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { apiFetch } from '@/lib/api-client';
import { activityBars, activityLevel, calendarDays, dashboardToday, demoDashboard, formatDay, monthLabel, shiftMonth, type DashboardData } from '@/lib/teacher-dashboard';
import { ArrowLeft, ArrowRight, CheckCircle2, FileText, GraduationCap, Loader2, Sparkles, Users } from './animated-icons';

const number = (value: number) => value.toLocaleString('pt-BR');
const stageNames: Record<string, string> = { generation: 'Geração', review: 'Revisão', research: 'Pesquisa externa' };

/** Anéis independentes: cada arco representa uma parcela do total, sem sugerir uma meta. */
function ExamOverview({ summary }: { summary: DashboardData['summary'] }) {
  const reduce = useReducedMotion();
  const series = [
    { label: 'Aprovadas', value: summary.approved, color: 'var(--dashboard-purple)' },
    { label: 'Coletivas', value: summary.regular, color: 'var(--dashboard-teal)' },
    { label: 'Individuais', value: summary.recovery, color: 'var(--dashboard-amber)' },
  ];
  const approvedPercent = summary.exams ? Math.round(summary.approved / summary.exams * 100) : 0;
  return <section className="dashboard-card dashboard-overview" aria-label="Panorama das provas">
    <div className="dashboard-card-heading"><h2><FileText size={20}/>Panorama das provas</h2><span className="dashboard-total">No período</span></div>
    <div className="dashboard-overview-body">
      <svg className="dashboard-rings" viewBox="0 0 240 240" aria-hidden="true">
        {series.map((item, i) => <g key={item.label} transform="rotate(-90 120 120)">
          <circle cx="120" cy="120" r={102 - i * 22} fill="none" stroke="var(--dashboard-track)" strokeWidth="13" />
          <motion.circle cx="120" cy="120" r={102 - i * 22} fill="none" stroke={item.color} strokeWidth="13" strokeLinecap="round" pathLength="100"
            strokeDasharray="100 100" initial={reduce ? false : { strokeDashoffset: 100 }}
            animate={{ strokeDashoffset: 100 - (summary.exams ? Math.min(100, item.value / summary.exams * 100) : 0) }}
            style={{ opacity: item.value > 0 ? 1 : 0 }} transition={{ duration: reduce ? 0 : .7, delay: reduce ? 0 : i * .08 }} />
        </g>)}
      </svg>
      <div className="dashboard-overview-values"><p>Total de provas</p><strong>{number(summary.exams)}</strong>
        <span className="dashboard-approval-rate">{summary.exams ? `${approvedPercent}% aprovadas` : 'Sem provas no período'}</span>
        <dl>{series.map(item => <div key={item.label}><dt><i style={{ background: item.color }} />{item.label}</dt><dd>{number(item.value)}</dd></div>)}</dl>
      </div>
    </div>
    <p className="dashboard-ring-note">Cada anel mostra a proporção sobre o total. Coletivas e individuais também podem estar aprovadas.</p>
  </section>;
}

export default function TeacherDashboard({ demo, name, onNavigate }: { demo: boolean; name: string; onNavigate: (view: string) => void }) {
  const today = dashboardToday(), currentMonth = today.slice(0, 7);
  const [month, setMonth] = useState(currentMonth), [period, setPeriod] = useState('month');
  const [data, setData] = useState<DashboardData | null>(null), [error, setError] = useState('');
  const [loading, setLoading] = useState(true), [revision, setRevision] = useState(0);
  const [selected, setSelected] = useState(today);
  const reduce = useReducedMotion();
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(''); setData(null);
    async function load() {
      try {
        let result: DashboardData;
        if (demo) result = demoDashboard(month, period);
        else {
          const response = await apiFetch(`/api/teacher/dashboard?${new URLSearchParams({ month, period })}`, { signal: controller.signal });
          if (!response.ok) throw Error('Não foi possível carregar seus indicadores. Tente atualizar novamente.');
          result = await response.json();
        }
        if (!controller.signal.aborted) setData(result);
      } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Falha ao carregar.'); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }
    void load(); return () => controller.abort();
  }, [month, period, demo, revision]);
  function changeMonth(value: string) {
    if (!/^\d{4}-\d{2}$/.test(value) || value < '2000-01' || value > currentMonth) return;
    setMonth(value); setSelected(value === currentMonth ? today : `${value}-01`);
  }
  const bars = data ? activityBars(data.daily, period) : [];
  const highest = Math.max(1, ...bars.map(b => b.regular + b.recovery));
  const days = calendarDays(month), byDate = new Map(data?.daily.map(day => [day.date, day]));
  const selectedDay = byDate.get(selected);
  const cards = data ? [
    { label: 'Provas feitas', value: number(data.summary.exams), hint: `${number(data.summary.regular)} coletivas · ${number(data.summary.recovery)} individuais`, icon: FileText },
    { label: 'Aprovadas', value: number(data.summary.approved), hint: `${number(data.summary.drafts)} com questões em revisão`, icon: CheckCircle2 },
    { label: 'Questões criadas', value: number(data.summary.questions), hint: 'Nas provas do período', icon: GraduationCap },
    { label: 'Tokens de IA', value: data.usage.measured_requests ? number(data.usage.total_tokens) : '—', hint: data.usage.measured_requests ? 'Consumo informado pelo provedor' : 'Sem medição disponível no período', icon: Sparkles },
  ] : [];
  return <div className="teacher-dashboard">
    <div className="dashboard-title"><div><span className="eyebrow">MEU ESPAÇO</span><h1>Área do professor<span>.</span></h1><p>Um olhar sobre suas provas e o uso da IA.</p></div>
      <button className="button secondary" disabled={loading} onClick={() => setRevision(n => n + 1)}>Atualizar dados</button></div>
    <div className="dashboard-welcome"><div><h2>Olá, {name}.</h2><p>{formatDay(today)} · Seu trabalho em perspectiva.</p></div>
      <button className="button primary" onClick={() => onNavigate('classes')}>Ir para minhas turmas <ArrowRight size={17} /></button></div>
    {demo && <p className="dashboard-demo" role="note">Dados ilustrativos de demonstração. Não representam provas ou consumo reais.</p>}
    <div className="dashboard-filters"><div><label htmlFor="dashboard-period">Período</label><select id="dashboard-period" value={period} onChange={e => setPeriod(e.target.value)}>
      <option value="month">Mês selecionado</option><option value="quarter">3 meses até o selecionado</option><option value="year">12 meses até o selecionado</option></select></div>
      <div><label htmlFor="dashboard-month">Mês de referência</label><input id="dashboard-month" type="month" min="2000-01" max={currentMonth} value={month} onChange={e => changeMonth(e.target.value)} /></div>
      <p>Datas no horário de Brasília.<br />{data ? `${formatDay(data.from)} a ${formatDay(data.to)}` : 'Selecione o período para consultar.'}</p></div>
    {loading && <div className="dashboard-loading" role="status"><Loader2 size={22} />Carregando seus indicadores…</div>}
    {error && <div className="dashboard-error" role="alert">{error}<button className="button secondary" onClick={() => setRevision(n => n + 1)}>Tentar novamente</button></div>}
    {data && <motion.div key={`${month}-${period}-${revision}`} initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .25 }}>
      <div className="dashboard-overview-grid">
        <ExamOverview summary={data.summary}/>
        <section className="dashboard-card dashboard-work-summary" aria-label="Resumo do trabalho">
          <div className="dashboard-card-heading"><h2><GraduationCap size={20}/>Resumo do trabalho</h2><span className="dashboard-total">{number(data.active_classes)} turmas ativas</span></div>
          <div className="dashboard-stats">{cards.map(card => <article key={card.label}><span className="dashboard-stat-icon"><card.icon size={18} /></span><p>{card.label}</p><strong>{card.value}</strong><small>{card.hint}</small></article>)}</div>
          <div className="dashboard-review-strip"><span><i className="dashboard-dot-approved"/>Aprovadas <strong>{number(data.summary.approved)}</strong></span><span><i className="dashboard-dot-draft"/>Em revisão <strong>{number(data.summary.drafts)}</strong></span></div>
          <div className="dashboard-review-bar" aria-hidden="true"><span style={{ width: `${data.summary.exams ? data.summary.approved / data.summary.exams * 100 : 0}%` }}/><i style={{ width: `${data.summary.exams ? data.summary.drafts / data.summary.exams * 100 : 0}%` }}/></div>
        </section>
      </div>
      <p className="dashboard-definition">Cada prova com questões conta uma vez, pela data de criação. Rascunhos vazios ({number(data.summary.empty_drafts)}) ficam fora da contagem. Provas excluídas deixam de aparecer.</p>
      <div className="dashboard-main-grid">
        <section className="dashboard-card dashboard-activity" aria-label="Provas por período"><div className="dashboard-card-heading"><div><h2>Seu ritmo de criação</h2><p>{period === 'month' ? 'Provas agrupadas por dias do mês' : 'Provas agrupadas por mês'}</p></div><span className="dashboard-total">{number(data.summary.exams)} provas</span></div>
          <div className="dashboard-chart" aria-hidden="true">{bars.map((bar, i) => <div className="dashboard-chart-column" key={bar.label}>
            <span>{number(bar.regular + bar.recovery)}</span><div className="dashboard-bar-track"><motion.div className="dashboard-bar-stack" initial={reduce ? false : { scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ duration: .4, delay: reduce ? 0 : i * .025 }} style={{ height: `${(bar.regular + bar.recovery) / highest * 100}%` }}>
              <i className="is-individual" style={{ flex: bar.recovery }} /><i className="is-collective" style={{ flex: bar.regular }} /></motion.div></div><small>{bar.label}</small></div>)}</div>
          <div className="dashboard-legend"><span><i className="is-collective" />Coletivas</span><span><i className="is-individual" />Individuais</span></div>
          {!data.summary.exams && <p className="dashboard-empty">Nenhuma prova com questões neste período. Suas próximas provas aparecerão aqui.</p>}
          <details className="dashboard-data-table"><summary>Ver valores do gráfico</summary><table><caption>Provas por {period === 'month' ? 'dias do mês' : 'mês'}</caption><thead><tr><th>Período</th><th>Coletivas</th><th>Individuais</th></tr></thead><tbody>{bars.map(b => <tr key={b.label}><th scope="row">{b.label}</th><td>{b.regular}</td><td>{b.recovery}</td></tr>)}</tbody></table></details>
          <div className="dashboard-workspace-totals"><span><Users size={17} /><strong>{number(data.active_students)}</strong> alunos ativos</span><span><GraduationCap size={17} /><strong>{number(data.active_classes)}</strong> turmas ativas</span></div>
        </section>
        <section className="dashboard-card dashboard-calendar" aria-label="Calendário de provas"><div className="dashboard-card-heading"><h2>Calendário de atividade</h2></div>
          <div className="dashboard-calendar-nav"><button className="icon-button" aria-label="Mês anterior" disabled={month <= '2000-01'} onClick={() => changeMonth(shiftMonth(month, -1))}><ArrowLeft size={18} /></button><strong>{monthLabel(month)}</strong><button className="icon-button" aria-label="Próximo mês" disabled={month >= currentMonth} onClick={() => changeMonth(shiftMonth(month, 1))}><ArrowRight size={18} /></button></div>
          <div className="dashboard-calendar-grid"><div className="dashboard-weekdays" aria-hidden="true">{['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map(day => <span key={day}>{day}</span>)}</div>
            {Array.from({ length: days.offset }, (_, i) => <span key={`blank-${i}`} aria-hidden="true" />)}
            {days.dates.map(date => { const count = byDate.get(date)?.exams ?? 0; return <button key={date} className={`dashboard-day level-${activityLevel(count)}`} disabled={date > today}
              aria-label={`${formatDay(date)}: ${count} ${count === 1 ? 'prova' : 'provas'}`} aria-pressed={selected === date} aria-current={date === today ? 'date' : undefined}
              onClick={() => setSelected(date)} title={`${count} ${count === 1 ? 'prova' : 'provas'}`}><span>{Number(date.slice(8))}</span>{count > 0 && <small>{count}</small>}</button>; })}</div>
          <div className="dashboard-heat-legend" aria-label="Intensidade: nenhuma, 1 a 2, 3 a 5, 6 a 10, 11 ou mais provas"><span>Menos</span>{[0, 1, 2, 3, 4].map(level => <i key={level} className={`level-${level}`} aria-hidden="true" />)}<span>Mais provas</span></div>
          <div className="dashboard-day-detail" aria-live="polite"><strong>{formatDay(selected)}</strong><p>{number(selectedDay?.exams ?? 0)} provas · {number(selectedDay?.regular ?? 0)} coletivas · {number(selectedDay?.recovery ?? 0)} individuais</p></div>
        </section>
      </div>
      <div className="dashboard-bottom-grid">
        <section className="dashboard-card" aria-label="Consumo de IA"><div className="dashboard-card-heading"><div><h2>Consumo de IA</h2><p>Geração, revisão e pesquisa externa</p></div><Sparkles size={23} /></div>
          <div className="dashboard-token-head"><strong>{data.usage.measured_requests ? number(data.usage.total_tokens) : '—'}</strong><span>tokens informados</span></div>
          <p className="dashboard-token-explanation">Tokens são partes do texto processadas pela IA. Este painel mostra uso, não uma cobrança.</p>
          <dl className="dashboard-token-breakdown"><div><dt>Entrada</dt><dd>{data.usage.input_measured_requests ? number(data.usage.input_tokens) : '—'}</dd></div><div><dt>Saída</dt><dd>{data.usage.output_measured_requests ? number(data.usage.output_tokens) : '—'}</dd></div><div><dt>Chamadas à IA</dt><dd>{number(data.usage.requests)}</dd></div><div><dt>Tempo médio / chamada</dt><dd>{data.usage.average_seconds === null ? '—' : `${data.usage.average_seconds.toLocaleString('pt-BR')} s`}</dd></div></dl>
          <div className="dashboard-token-stages">{Object.entries(stageNames).map(([stage, label]) => <div key={stage}><span>{label}</span><strong>{data.usage.measured_requests ? number(data.usage.stages[stage] ?? 0) : '—'}</strong></div>)}</div>
          <p className="dashboard-measurement-note">{data.usage.first_recorded_at ? 'Medição disponível desde ' + formatDay(data.usage.first_recorded_at.slice(0, 10)) + '.' : 'A medição começa nas próximas chamadas à IA. O consumo de provas anteriores não foi registrado.'} {data.usage.unmeasured_requests > 0 && `${number(data.usage.unmeasured_requests)} chamadas sem contagem informada; o total pode estar incompleto.`}</p>
          <details className="dashboard-data-table"><summary>Como esse consumo é contado</summary><p>Inclui tentativas e respostas descartadas na revisão. Reutilizar uma pesquisa já salva não adiciona tokens. O total do provedor pode incluir raciocínio e ferramentas além da entrada e saída. Chamadas sem resposta não permitem saber o consumo exato.</p><p>Entrada informada em {number(data.usage.input_measured_requests)} chamadas; saída em {number(data.usage.output_measured_requests)}. Quando o provedor omite esses detalhes, a soma é parcial.</p><p>Falhas de conexão ou HTTP no período: {number(data.usage.http_failures)}. O tempo por chamada não é o tempo total até a prova ficar pronta.</p>
            {Object.entries(data.usage.providers).map(([provider, tokens]) => <p key={provider}>{provider}: {number(tokens)} tokens informados.</p>)}</details>
        </section>
        <section className="dashboard-card" aria-label="Atividade das turmas"><div className="dashboard-card-heading"><div><h2>Turmas em atividade</h2><p>As 5 turmas com mais provas no período</p></div></div>
          {!data.classes.length ? <p className="dashboard-empty">As turmas aparecerão aqui quando tiverem provas com questões.</p> : <ol className="dashboard-class-ranking">{data.classes.map((room, i) => <li key={i}><div><span className="dashboard-rank">{i + 1}</span><strong>{room.name}</strong><span>{number(room.exams)} provas</span></div><div className="dashboard-rank-track" aria-hidden="true"><span style={{ '--rank-width': `${room.exams / Math.max(1, data.classes[0].exams) * 100}%` } as CSSProperties} /></div></li>)}</ol>}
          <button className="button secondary" onClick={() => onNavigate('exams')}>Ver provas coletivas <ArrowRight size={16} /></button>
        </section>
      </div>
    </motion.div>}
  </div>;
}
