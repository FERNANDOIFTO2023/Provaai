import type { ExamContent } from './exam';

/** Hide a saved result as soon as the teacher changes the checked inputs. */
export function currentMathResult(content: ExamContent, subject: string, index: number) {
  const report = content.mathReview;
  const result = report?.results[index];
  const question = content.questions[index];
  if (!result || !question || report?.subject !== subject || report.instructions !== content.instructions)
    return undefined;
  const input = result.input;
  if (input.statement !== question.statement || input.answer !== question.answer || input.type !== question.type ||
      input.options.length !== question.options.length || input.options.some((value, i) => value !== question.options[i]))
    return undefined;
  return result;
}
