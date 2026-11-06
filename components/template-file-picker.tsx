import { useState } from 'react';
import { Upload, X } from './animated-icons';
import { Field } from './workspace-ui';

function fileKey(file: File) {
  return JSON.stringify([file.name, file.size, file.lastModified]);
}

export default function TemplateFilePicker({ files, onChange, disabled }: {
  files: File[];
  onChange: (files: File[]) => void;
  disabled: boolean;
}) {
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');
  function add(incoming: FileList) {
    if (disabled) return;
    const selected = new Map(files.map(file => [fileKey(file), file]));
    const rejected: string[] = [];
    for (const file of incoming) {
      if (!/\.(pdf|docx?)$/i.test(file.name) || !file.size || file.size > 20 * 1024 * 1024)
        rejected.push(file.name);
      else selected.set(fileKey(file), file);
    }
    setError(rejected.length ? `Confira o formato e o tamanho: ${rejected.join(', ')}.` : '');
    onChange([...selected.values()]);
  }
  return <>
    <label className="template-dropzone" data-dragging={dragging}
      onDragOver={event => {
        event.preventDefault();
        const allowed = !disabled && event.dataTransfer.types.includes('Files');
        event.dataTransfer.dropEffect = allowed ? 'copy' : 'none';
        setDragging(allowed);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={event => {
        event.preventDefault();
        setDragging(false);
        add(event.dataTransfer.files);
      }}>
      <Upload size={22} aria-hidden="true" />
      <strong>{dragging ? 'Solte os arquivos aqui' : 'Arraste os modelos ou clique para selecionar'}</strong>
      <small id="template-file-limits">PDF, DOC ou DOCX · Até 20 MB por arquivo</small>
      <input type="file" multiple accept=".pdf,.doc,.docx" disabled={disabled}
        aria-label="Selecionar arquivos de modelo" aria-describedby="template-file-limits"
        onChange={event => {
          if (event.target.files) add(event.target.files);
          event.target.value = '';
        }} />
    </label>
    {error && <p className="error" role="alert">{error}</p>}
    {files.map(file => <div className="template-file-row" key={fileKey(file)}>
      <Field label={`Nome do modelo · ${file.name}`}>
        <input name="template_name" required maxLength={100} disabled={disabled}
          defaultValue={(file.name.replace(/\.[^.]+$/, '') || file.name).slice(0, 100)} />
      </Field>
      <button type="button" className="icon-button" aria-label={`Remover ${file.name}`}
        disabled={disabled} onClick={() => onChange(files.filter(item => item !== file))}>
        <X size={17} />
      </button>
    </div>)}
  </>;
}
