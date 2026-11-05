'use client';

import { useState } from 'react';

type Props = {
  fixedTotal?: number;
  objectives?: number;
  onChange?: (count: number) => void;
};

export default function QuestionCounts({
  fixedTotal,
  objectives,
  onChange,
}: Props) {
  const [totalInput, setTotalInput] = useState('5');
  const [chosen, setChosen] = useState<number | null>(null);
  const total = fixedTotal ?? Number(totalInput);
  const valid = Number.isInteger(total) && total >= 1 && total <= 30;
  const objective = valid
    ? Math.min(total, objectives ?? chosen ?? Math.floor(total / 2))
    : 0;
  const choices = valid
    ? Array.from({ length: total + 1 }, (_, i) => <option key={i}>{i}</option>)
    : [];

  function choose(value: number) {
    setChosen(value);
    onChange?.(value);
  }

  return (
    <fieldset className="question-counts">
      <legend>Questões por aluno</legend>
      <div className="count-fields">
        <label className="field">
          <span>Total</span>
          <input
            type="number"
            name="count"
            min={1}
            max={30}
            step={1}
            required
            readOnly={fixedTotal !== undefined}
            value={fixedTotal ?? totalInput}
            onChange={(event) => setTotalInput(event.target.value)}
          />
        </label>
        <label className="field">
          <span>Objetivas</span>
          <select
            name="objectiveCount"
            value={valid ? objective : ''}
            disabled={!valid}
            onChange={(event) => choose(Number(event.target.value))}
          >
            {choices}
          </select>
        </label>
        <label className="field">
          <span>Discursivas</span>
          <select
            value={valid ? total - objective : ''}
            disabled={!valid}
            onChange={(event) => choose(total - Number(event.target.value))}
          >
            {choices}
          </select>
        </label>
      </div>
      <small>Ao gerar com IA, cada prova seguirá essa divisão.</small>
    </fieldset>
  );
}
