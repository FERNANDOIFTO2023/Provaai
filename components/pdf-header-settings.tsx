'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Template } from '@/lib/model';

export default function PdfHeaderSettings({template,onSaved}: {template:Template;onSaved:(template:Template)=>void}) {
  const [ratio,setRatio] = useState(template.pdf_header_ratio ?? 0.25);
  const [preview,setPreview] = useState('');
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState('');
  useEffect(()=>()=>{if(preview) URL.revokeObjectURL(preview);},[preview]);
  async function submit(previewOnly: boolean) {
    setBusy(true);setMessage('');
    try {
      const {data:{session}} = await supabase.auth.getSession();
      if (!session) throw new Error('Entre novamente para continuar.');
      const response = await fetch('/api/template/process',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`},
        body:JSON.stringify({templateId:template.id,headerRatio:ratio,preview:previewOnly})});
      if (!response.ok) { const data=await response.json();throw new Error(data.error?.message || 'Não foi possível preparar o cabeçalho.'); }
      if (previewOnly) setPreview(URL.createObjectURL(await response.blob()));
      else { onSaved((await response.json()).template);setMessage('Cabeçalho salvo. As próximas exportações usarão este recorte.'); }
    } catch(error) {setMessage(error instanceof Error?error.message:'Tente novamente.');}
    finally {setBusy(false);}
  }
  return <details><summary>Ajustar cabeçalho do PDF</summary>
    <p className="helper-note">Somente a faixa superior da primeira página será repetida nas provas. Ajuste até as perguntas antigas ficarem fora da prévia. O restante da página recebe as novas questões.</p>
    <label>Altura do cabeçalho: {Math.round(ratio*100)}%
      <input aria-label={`Altura do cabeçalho de ${template.name}`} type="range" min="5" max="45" step="1" value={Math.round(ratio*100)} disabled={busy}
        onChange={e=>{setRatio(Number(e.target.value)/100);setPreview('');}}/></label>
    <div className="actions"><button className="button secondary small-button" disabled={busy} onClick={()=>void submit(true)}>Ver prévia</button>
      <button className="button primary small-button" disabled={busy || !preview} onClick={()=>void submit(false)}>Salvar cabeçalho</button></div>
    {preview && <img src={preview} alt="Prévia do cabeçalho que será repetido nas provas" style={{width:'100%',height:'auto',marginTop:12,border:'1px solid #ddd'}}/>}
    <p role="status">{busy?'Preparando cabeçalho…':message}</p>
  </details>;
}
