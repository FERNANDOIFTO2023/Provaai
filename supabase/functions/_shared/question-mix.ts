export function questionMix(total: number, objectives = Math.floor(total / 2)) {
  if (
    !Number.isInteger(total) ||
    total < 1 ||
    total > 30 ||
    !Number.isInteger(objectives) ||
    objectives < 0 ||
    objectives > total
  ) {
    throw new Error(
      'A soma das questões objetivas e discursivas deve ser igual ao total da prova.',
    );
  }
  return { objective: objectives, essay: total - objectives };
}

export function checkQuestionMix(
  questions: { type: 'objective' | 'essay' }[],
  mix: ReturnType<typeof questionMix>,
) {
  const objectives = questions.filter((q) => q.type === 'objective').length;
  if (
    objectives !== mix.objective ||
    questions.length - objectives !== mix.essay
  ) {
    throw new Error(
      'A IA não respeitou a divisão entre objetivas e discursivas. Tente gerar novamente.',
    );
  }
}
