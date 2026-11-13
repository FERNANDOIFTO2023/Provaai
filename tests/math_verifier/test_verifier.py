import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('verify_math', Path(__file__).resolve().parents[2] / 'scripts/verify-math.py')
verifier = importlib.util.module_from_spec(spec)
spec.loader.exec_module(verifier)


def question(statement, answer, options=None):
    return dict(statement=statement, answer=answer, type='objective' if options else 'essay', options=options or [])


class VerificationTest(unittest.TestCase):
    def status(self, statement, answer, options=None, instructions='Leia com atenção.'):
        return verifier.verify(dict(instructions=instructions, questions=[question(statement, answer, options)]))[0]['status']

    def test_exact_arithmetic_and_latex(self):
        for expression, answer in [(r'\frac{1}{2}+\frac{1}{4}', r'\frac{3}{4}'),
                                   ('0,1 + 0,2', '0,3'), ('-2^2', '-4'),
                                   (r'\sqrt{8}/2', r'\sqrt{2}'),
                                   (r'\frac{\frac{1}{2}}{3}', '1/6')]:
            with self.subTest(expression=expression):
                self.assertEqual('verified', self.status(r'Calcule \(' + expression + r'\).', r'\(' + answer + r'\)'))

    def test_wrong_answer_and_missing_roots(self):
        self.assertEqual('mismatch', self.status(r'Calcule \(3+4\).', '8'))
        self.assertEqual('mismatch', self.status(r'Resolva \(x^2-5x+6=0\).', 'x=2'))

    def test_linear_and_quadratic_equations(self):
        for equation, answer in [('2x+1=7', 'x=3'), ('x^2-5x+6=0', 'x=2; x=3'),
                                 ('x^2-2=0', r'x=-\sqrt{2}; x=\sqrt{2}'),
                                 ('x^2-2x+1=0', 'x=1'), ('x^2+1=0', 'sem raízes reais')]:
            with self.subTest(equation=equation):
                self.assertEqual('verified', self.status(r'Resolva a equação \(' + equation + r'\).', answer))

    def test_objective_options_have_one_correct_and_no_equivalents(self):
        self.assertEqual('verified', self.status(r'Calcule \(1/2+1/4\).', '0,75', ['0,75', '1', '2', '3']))
        self.assertEqual('mismatch', self.status(r'Calcule \(1/2\).', '1/2', ['1/2', '0,5', '2', '3']))
        self.assertEqual('mismatch', self.status(r'Calcule \(1/2\).', '2', ['1/2', '1', '2', '3']))
        self.assertEqual('needs_review', self.status(r'Calcule \(1/2\).', '1/2', ['1/2', '1', '2', 'nenhuma das anteriores']))

    def test_only_final_result_is_compared(self):
        self.assertEqual('verified', self.status(r'Calcule \(2+3\).', r'Somamos os termos. Resposta final: \(5\)'))
        self.assertEqual('needs_review', self.status(r'Calcule \(2+3\).', 'A resposta é 5, pois somamos os termos.'))

    def test_ambiguous_context_and_unsupported_domains_require_review(self):
        cases = [r'Calcule \(2+3\) e explique por que não é 6.',
                 r'Resolva \(x^3=8\).', r'Resolva \((x^2-1)/(x-1)=0\).',
                 r'João tem \(2+3\) maçãs. Quantas tem?', r'Calcule \(\int x dx\).',
                 r'Resolva \(x+y=2\).', r'Calcule \(1/0\).', r'Calcule \(0^0\).']
        for statement in cases:
            with self.subTest(statement=statement):
                self.assertEqual('needs_review', self.status(statement, '5'))
        self.assertEqual('needs_review', self.status(r'Calcule \(1/3\).', '1/3', instructions='Arredonde para duas casas decimais.'))
        self.assertEqual('needs_review', self.status(r'Resolva \(x^2=2\).', r'x=-\sqrt{2}; x=\sqrt{2}', instructions='Resolva nos inteiros.'))

    def test_untrusted_expressions_and_complexity_are_rejected(self):
        for source in ["__import__('os').system('whoami')", 'x.__class__', '[1][0]',
                       'sqrt(x)', '9^999999', '((((x+1)^6)^6)^6)^6', '2**999999',
                       '(' * 90 + '1' + ')' * 90, '1+' * 90 + '1']:
            with self.subTest(source=source):
                self.assertEqual('needs_review', self.status(r'Calcule \(' + source + r'\).', '1'))


if __name__ == '__main__':
    unittest.main()
