import { z } from 'zod';
export const questionSchema = z
  .object({
    statement: z.string().min(5).max(3000),
    type: z.enum(['objective', 'essay']),
    options: z.array(z.string().min(1).max(500)).max(4),
    answer: z.string().min(1).max(3000),
    objective: z.string().min(1).max(500),
    points: z.number().min(0.1).max(100),
  })
  .superRefine((q, c) => {
    if (
      q.type === 'objective' &&
      (q.options.length !== 4 || !q.options.includes(q.answer))
    )
      c.addIssue({
        code: 'custom',
        message:
          'Questão objetiva exige quatro alternativas e resposta igual a uma delas.',
      });
    if (q.type === 'essay' && q.options.length)
      c.addIssue({
        code: 'custom',
        message: 'Questão discursiva não deve ter alternativas.',
      });
  });
export const examContentSchema = z.object({
  mathReview: z.object({
    version: z.literal(1),
    subject: z.string(),
    instructions: z.string(),
    results: z.array(z.object({
      status: z.enum(['verified', 'mismatch', 'needs_review']),
      message: z.string(),
      input: z.object({
        statement: z.string(),
        type: z.enum(['objective', 'essay']),
        options: z.array(z.string()),
        answer: z.string(),
      }),
    })),
  }).optional(),
  objectiveCount: z.number().int().min(0).max(30).optional(),
  instructions: z.string().max(2000),
  questions: z.array(questionSchema).min(1).max(30),
});
export type ExamContent = z.infer<typeof examContentSchema>;
export const generationSchema = z.object({
  examId: z.string().uuid(),
  objectiveCount: z.number().int().min(0).max(30).optional(),
});
export function normalizedQuestion(text: string) {
  return text
    .normalize('NFKC')
    .toLocaleLowerCase('pt-BR')
    .replace(/\s+/g, ' ')
    .trim();
}
export function duplicateQuestions(
  content: ExamContent,
  others: ExamContent[],
) {
  const used = new Set(
    others.flatMap((x) =>
      x.questions.map((q) => normalizedQuestion(q.statement)),
    ),
  );
  for (const q of content.questions) {
    const t = normalizedQuestion(q.statement);
    if (used.has(t)) return true;
    used.add(t);
  }
  return false;
}
