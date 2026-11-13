# Conferência dos resultados matemáticos

Ao gerar uma prova de matemática ou salvar sua revisão, o Laravel executa uma conferência local com SymPy. O resultado aparece abaixo do gabarito de cada questão, apenas para o professor. Não há chamada adicional ao Gemini, envio a outro provedor ou alteração automática da resposta.

| Aviso | Significado |
| --- | --- |
| Resultado conferido | O resultado final coincide com o cálculo explícito do enunciado. A explicação e a adequação pedagógica ainda precisam de revisão. |
| Revise o gabarito | O resultado diverge ou há alternativas matematicamente equivalentes. |
| Revisão do professor | O formato não é reconhecido, há instruções adicionais ou a conferência não está disponível. |

Editar enunciado, resposta, alternativas, tipo, matéria ou instruções invalida o aviso anterior na interface. Salvar executa uma nova conferência; o servidor descarta resultados enviados pelo navegador ou pelo provedor de IA. Provas antigas são conferidas ao salvar, sem migração de dados. A aprovação continua sendo uma decisão do professor, inclusive quando houver aviso de divergência.

## Escopo atual

- Operações explícitas com inteiros, decimais exatos, frações, potências pequenas e raízes quadradas reais.
- Equações polinomiais de primeiro e segundo grau na variável `x`, com coeficientes racionais, considerando as raízes reais. Denominadores com variável não são aceitos.
- Quatro alternativas expressas como valores ou conjuntos de raízes: o gabarito precisa ser a única opção correta, e as alternativas não podem ser equivalentes.

Exemplos reconhecidos:

```text
Enunciado: Calcule \(\frac{1}{2}+\frac{1}{4}\).
Resposta: \(\frac{3}{4}\)

Enunciado: Resolva a equação \(x^2-5x+6=0\).
Resposta: Fatoramos a expressão. Resposta final: \(x=2; x=3\)
```

O enunciado inteiro precisa corresponder ao formato simples `Calcule ...` ou `Resolva ...`, com uma expressão delimitada. Instruções neutras como “Leia com atenção.”, “Responda às questões.” e “Mostre os cálculos.” são aceitas. Outras instruções ficam para revisão, pois podem mudar domínio, precisão ou arredondamento.

Problemas contextualizados, unidades, gráficos, matrizes, integrais, sistemas, funções, números complexos e notação não reconhecida **não são certificados**. O verificador não tenta interpretar fragmentos isolados de um problema. Nas respostas com explicação, somente o trecho após `Resposta final:` é comparado; os passos anteriores não são verificados. A cobertura é deliberadamente restrita e não substitui a revisão docente.

## Instalação local

Na raiz do projeto, com Python 3.11 ou superior:

```sh
python -m venv .venv
```

No Windows:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements-math.txt
.\.venv\Scripts\python.exe -m unittest discover -s tests/math_verifier
```

No Linux/macOS:

```sh
.venv/bin/python -m pip install -r requirements-math.txt
.venv/bin/python -m unittest discover -s tests/math_verifier
```

Configure `PYTHON_BINARY` no `.env` com o caminho absoluto do Python desse ambiente, entre aspas se houver espaços. Exemplo no Windows: `PYTHON_BINARY="C:/caminho/Provaai/.venv/Scripts/python.exe"`. Reinicie o worker após alterar a configuração. A pasta `.venv` e os caches Python são ignorados pelo Git e pelo build Docker.

O Docker instala as versões fixadas de SymPy e mpmath em `/opt/provaai-python`. O CI executa os testes Python e a integração Laravel. Na próxima publicação, é necessário reconstruir a imagem; copiar apenas os arquivos PHP não instala o verificador. Não há nova chave, API paga ou migração de banco.

## Limites e operação

`scripts/verify-math.py` interpreta apenas nós permitidos da árvore sintática. Não usa `eval`, `exec`, `sympify` ou o parser de texto do SymPy para executar entradas. Limites: 256 caracteres por expressão, 80 nós, profundidade 16, números com até seis dígitos consecutivos e expoentes inteiros de módulo até seis. Polinômios intermediários acima do segundo grau são recusados.

O processo recebe somente enunciados, respostas, alternativas e instruções por JSON na entrada padrão, sem nomes ou códigos de alunos. O Laravel limita a execução a seis segundos; no Linux, o processo também tem teto de quatro segundos de CPU e 256 MiB de memória. Em caso de indisponibilidade, timeout ou resultado inválido, as questões são preservadas e marcadas para revisão. Os logs registram apenas o tipo de falha, sem conteúdo da prova.

Arquivos principais: `app/Services/MathVerificationService.php`, `scripts/verify-math.py`, `components/math-review.tsx` e `lib/math-review.ts`. Os relatórios não são impressos nas provas nem nos gabaritos exportados.
