'use client';
import { useRef, useState, type FormEvent } from 'react';
import type { ClassRoom } from '@/lib/model';
import type { CopyInvitation, ShareTarget } from '@/lib/classroom';
import { Field, Empty } from './workspace-ui';

export function ShareCopyForm({ target, demo, busy, onSend, onCancel }: {
  target: ShareTarget; demo: boolean; busy: boolean;
  onSend: (id: string, email: string) => Promise<void>; onCancel: () => void;
}) {
  const request = useRef({ id: crypto.randomUUID(), email: '' });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get('email')).trim().toLowerCase();
    if (email !== request.current.email) request.current = { id: crypto.randomUUID(), email };
    void onSend(request.current.id, email);
  }
  return <form onSubmit={submit}>
    <p>Compartilhar <strong>{target.name}</strong> com outro professor.</p>
    <p className="helper-note">{target.kind === 'class' ? 'A cópia inclui as configurações da turma e os perfis dos alunos, ativos e inativos.' : 'O professor poderá importar este perfil para uma turma dele.'} Provas e arquivos de modelos não são copiados. Cada professor poderá editar sua própria cópia.</p>
    <Field label="E-mail do professor"><input type="email" name="email" required maxLength={254} autoComplete="off" placeholder="professor@escola.edu.br" disabled={busy || demo} /></Field>
    <p className="helper-note">O convite aparecerá em Compartilhamentos quando o destinatário entrar na Provaai com esse e-mail. Não é enviada uma mensagem de e-mail.</p>
    {demo && <p className="helper-note">Entre na sua conta para compartilhar com outros professores.</p>}
    <div className="dialog-actions"><button type="button" className="button secondary" disabled={busy} onClick={onCancel}>Cancelar</button>
      <button className="button primary" disabled={busy || demo}>{busy ? 'Compartilhando…' : 'Disponibilizar cópia'}</button></div>
  </form>;
}

export default function CopySharing({ invitations, userId, classes, busy, demo, onAccept, onCancel, onRefresh }: {
  invitations: CopyInvitation[]; userId?: string; classes: ClassRoom[]; busy: boolean; demo: boolean;
  onAccept: (invitation: CopyInvitation, classId: string) => void;
  onCancel: (invitation: CopyInvitation) => void; onRefresh: () => void;
}) {
  const [tab, setTab] = useState('received');
  const list = invitations.filter(item => (item.owner_id === userId) === (tab === 'sent'));
  return <section><div className="page-heading"><div><span className="eyebrow">TROCAS ENTRE PROFESSORES</span>
    <h1>Compartilhamentos<span>.</span></h1><p>Receba cópias independentes de turmas e alunos. As alterações ficam na conta de quem as faz.</p></div>
    <button className="button secondary" onClick={onRefresh} disabled={busy || demo}>Atualizar convites</button></div>
    <div className="library-filters"><select aria-label="Convites recebidos ou enviados" value={tab} onChange={e => setTab(e.target.value)}>
      <option value="received">Recebidos</option><option value="sent">Enviados</option></select></div>
    {demo && <p className="helper-note">O compartilhamento entre contas está disponível após entrar com seu e-mail.</p>}
    <div className="student-directory">{list.map(item => <InvitationCard key={item.id} item={item} sent={tab === 'sent'} classes={classes} busy={busy} onAccept={onAccept} onCancel={onCancel} />)}</div>
    {!list.length && <Empty title={tab === 'sent' ? 'Nenhuma cópia compartilhada' : 'Nenhum convite recebido'} text={tab === 'sent' ? 'Use Compartilhar cópia em uma turma ou no perfil de um aluno.' : 'Peça ao outro professor que compartilhe usando o mesmo e-mail da sua conta.'} />}
  </section>;
}
function InvitationCard({ item, sent, classes, busy, onAccept, onCancel }: {
  item: CopyInvitation; sent: boolean; classes: ClassRoom[]; busy: boolean;
  onAccept: (item: CopyInvitation, classId: string) => void; onCancel: (item: CopyInvitation) => void;
}) {
  const [destination, setDestination] = useState('');
  const pending = !item.accepted_at && !item.revoked_at;
  return <article className="directory-card"><span className="eyebrow">{item.kind === 'class' ? 'CÓPIA DE TURMA' : 'CÓPIA DE ALUNO'}</span><h2>{item.resource_name}</h2>
    <p>{sent ? `Para: ${item.recipient_email}` : `De: ${item.sender_email}`}</p>
    <p className="helper-note">{item.student_count} {item.student_count === 1 ? 'perfil' : 'perfis'} · {new Date(item.created_at).toLocaleDateString('pt-BR')}</p>
    <span className={`status ${item.accepted_at ? 'good' : 'pending'}`}>{item.accepted_at ? 'Cópia recebida' : item.revoked_at ? 'Cancelado' : 'Aguardando recebimento'}</span>
    {pending && <div className="copy-invitation-actions">
      {!sent && item.kind === 'student' && <Field label="Copiar para a turma"><select value={destination} onChange={e => setDestination(e.target.value)} disabled={busy}><option value="">Selecione uma turma ativa</option>
        {classes.filter(room => !room.archived_at).map(room => <option key={room.id} value={room.id}>{room.name} · {room.subject}</option>)}</select></Field>}
      {!sent && <p className="helper-note">{item.kind === 'class' ? 'Uma nova turma ativa será criada na sua conta, com os perfis e seus status.' : 'O perfil será adicionado com um novo código. O status ativo ou inativo será mantido.'} Você poderá editar a cópia livremente.</p>}
      <div className="actions">{!sent && <button className="button primary" disabled={busy || (item.kind === 'student' && !destination)} onClick={() => onAccept(item, destination)}>Receber cópia</button>}
        <button className="button secondary" disabled={busy} onClick={() => onCancel(item)}>{sent ? 'Cancelar convite' : 'Recusar'}</button></div>
    </div>}
  </article>;
}
