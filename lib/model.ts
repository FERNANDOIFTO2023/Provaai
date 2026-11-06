import { z } from 'zod';
import type { ExamContent } from '../supabase/functions/_shared/exam.ts';
export * from '../supabase/functions/_shared/exam.ts';
export type ClassRoom = {
  id: string;
  user_id: string;
  name: string;
  grade: string;
  subject: string;
  period: string;
  template_override_id?: string | null;
  use_provaai_template?: boolean;
  color: string;
  created_at: string;
};
export type Student = {
  archived_at?: string | null;
  id: string;
  user_id: string;
  class_id: string;
  name: string;
  code: string;
  difficulties: string;
  criteria: string;
  level: string;
  created_at: string;
};
export type Exam = {
  purpose?: 'regular' | 'recovery';
  id: string;
  user_id: string;
  class_id: string;
  student_id: string;
  title: string;
  subject: string;
  topics: string;
  question_count: number;
  status: 'draft' | 'approved';
  content: ExamContent;
  profile_snapshot: {
    name: string;
    code: string;
    difficulties: string;
    criteria: string;
    level: string;
  };
  created_at: string;
  updated_at: string;
  template_id?: string | null;
};
export type Template = {
  id: string;
  user_id: string;
  name: string;
  filename: string;
  path: string;
  reference_text: string;
  extracted_text?: string;
  processing_status?: string;
  processing_error?: string | null;
  created_at: string;
};
export type DataSet = {
  classes: ClassRoom[];
  students: Student[];
  exams: Exam[];
  templates: Template[];
};
export const classSchema = z.object({
  name: z.string().trim().min(2).max(80),
  grade: z.string().trim().min(1).max(80),
  subject: z.string().trim().min(2).max(80),
  color: z.enum(['sage', 'peach', 'blue', 'lilac']),
});
export const studentSchema = z.object({
  name: z.string().trim().min(2).max(100),
  code: z.string().trim().min(1).max(30),
  difficulties: z.string().trim().max(2000),
  criteria: z.string().trim().max(2000),
  level: z.enum(['Em desenvolvimento', 'Intermediário', 'Avançado']),
});
export function cleanError(error: unknown) {
  const e = error as { message?: string; code?: string };
  if (e.code === 'PGRST205' || e.message?.includes('schema cache'))
    return 'Não foi possível carregar os dados. Tente novamente mais tarde.';
  if (e.code === '23505') return 'Este código de aluno já existe nesta turma.';
  if (e.message?.includes('Invalid login credentials'))
    return 'E-mail ou senha incorretos.';
  if (e.message?.includes('Email not confirmed'))
    return 'Confirme seu e-mail antes de entrar.';
  return e.message || 'Não foi possível concluir. Tente novamente.';
}
export function demoData(): DataSet {
  const now = '2026-10-29T12:00:00.000Z';
  const user = 'demo';
  const classes: ClassRoom[] = [
    ['c1', '7º ano A', '7º ano', 'Matemática', 'Manhã', 'sage'],
    ['c2', '8º ano B', '8º ano', 'Matemática', 'Tarde', 'peach'],
    ['c3', '6º ano A', '6º ano', 'Ciências', 'Manhã', 'blue'],
  ].map(([id, name, grade, subject, period, color]) => ({
    id,
    name,
    grade,
    subject,
    period,
    color,
    user_id: user,
    created_at: now,
  }));
  const students: Student[] = [
    [
      's1',
      'c1',
      'Ana Clara Martins',
      'A001',
      'Operações com frações de denominadores diferentes.',
      'Enunciados curtos e espaço para os cálculos.',
    ],
    [
      's2',
      'c1',
      'Bruno Henrique Costa',
      'A002',
      'Interpretação de problemas com porcentagens.',
      'Usar exemplos do cotidiano.',
    ],
    [
      's3',
      'c1',
      'Camila Oliveira',
      'A003',
      '',
      'Incluir uma questão de desafio.',
    ],
    [
      's4',
      'c1',
      'Daniel Santos',
      'A004',
      'Multiplicação e divisão de frações.',
      'Exercícios em ordem crescente de complexidade.',
    ],
    [
      's5',
      'c2',
      'Elisa Almeida',
      'B001',
      'Equações de primeiro grau.',
      'Reservar espaço para desenvolvimento.',
    ],
    ['s6', 'c2', 'Felipe Ribeiro', 'B002', '', ''],
    [
      's7',
      'c3',
      'Gabriela Souza',
      'C001',
      'Diferenciar células animais e vegetais.',
      'Linguagem direta.',
    ],
  ].map(([id, class_id, name, code, difficulties, criteria]) => ({
    id,
    class_id,
    name,
    code,
    difficulties,
    criteria,
    user_id: user,
    level: 'Intermediário',
    created_at: now,
  }));
  const content: ExamContent = {
    instructions:
      'Leia com atenção. Apresente os cálculos e responda com suas próprias palavras.',
    questions: [
      {
        statement:
          'Uma receita usa 1/2 de xícara de leite e 1/4 de xícara de água. Qual é o volume total de líquidos, em xícaras?',
        type: 'objective',
        options: ['1/4', '1/2', '3/4', '1'],
        answer: '3/4',
        objective: 'Somar frações de denominadores diferentes',
        points: 5,
      },
      {
        statement:
          'Explique como encontrar um denominador comum para somar 1/3 e 1/6. Em seguida, resolva a soma.',
        type: 'essay',
        options: [],
        answer: 'Usar denominador 6: 2/6 + 1/6 = 3/6 = 1/2.',
        objective: 'Compreender frações equivalentes',
        points: 5,
      },
    ],
  };
  return {
    classes,
    students,
    templates: [],
    exams: [
      {
        id: 'e1',
        user_id: user,
        class_id: 'c1',
        student_id: 's1',
        title: 'Frações no cotidiano',
        subject: 'Matemática',
        topics: 'Frações e equivalência',
        question_count: 2,
        status: 'draft',
        content,
        profile_snapshot: students[0],
        created_at: now,
        updated_at: now,
      },
    ],
  };
}
