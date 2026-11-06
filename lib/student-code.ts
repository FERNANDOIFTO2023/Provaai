/** Codes are scoped to a class, including its archived students. */
export function nextStudentCode(codes: readonly string[]): string {
  const used = new Set(codes.map(code => code.trim().toUpperCase()));
  let highest = 0;
  for (const code of used) {
    const match = /^A(\d+)$/.exec(code);
    if (!match) continue;
    const value = Number(match[1]);
    if (Number.isSafeInteger(value)) highest = Math.max(highest, value);
  }
  if (highest >= Number.MAX_SAFE_INTEGER) {
    throw new Error('Não foi possível gerar um código para esta turma.');
  }
  return `A${String(highest + 1).padStart(3, '0')}`;
}

/** The unique constraint decides the winner if another tab saves the same code. */
export async function saveWithStudentCode<T>(
  suggested: string,
  readCodes: () => Promise<string[]>,
  insert: (code: string) => Promise<T>,
): Promise<{ student: T; code: string }> {
  let candidate = suggested;
  for (let attempt = 0; attempt < 5; attempt++) {
    const codes = await readCodes();
    if (!/^A\d{3,}$/.test(candidate) || codes.some(code => code.trim().toUpperCase() === candidate)) {
      candidate = nextStudentCode(codes);
    }
    try {
      return { student: await insert(candidate), code: candidate };
    } catch (error) {
      if ((error as { code?: string })?.code !== '23505') throw error;
      candidate = '';
    }
  }
  throw new Error('A turma recebeu novos cadastros ao mesmo tempo. Tente salvar novamente.');
}
