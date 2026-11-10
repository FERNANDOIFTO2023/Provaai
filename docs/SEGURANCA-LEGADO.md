> Registro histórico da versão anterior (Next.js/Supabase). Os caminhos citados podem ter sido removidos na migração. Não descreve a segurança da versão Laravel.

# Revisão de segurança

**Data:** 8 de novembro de 2026 · **Base revisada:** `fac0d9e93a4e90db1ef6864ebd509814e705144e`

Esta é uma revisão parcial do código, com conferência independente dos pontos levantados. Não houve teste de exploração, acesso a contas reais, alteração do banco ou publicação. Nenhuma vulnerabilidade foi confirmada por execução; isso não significa que o sistema esteja livre de falhas.

O principal ponto pendente é o controle de recursos durante a descompactação de modelos DOCX. A causa observada e a solução proposta estão abaixo. **As mudanças de código propostas neste documento ainda não foram implementadas nem testadas.**

## Escopo e resultado

| Área | O que foi observado no código |
| --- | --- |
| Login por e-mail | Verificação inicial pelo Auth; reutilização vinculada ao e-mail, código, identidade e prazo original. Estado privilegiado restrito ao serviço de autenticação. |
| Dados de professores | Políticas RLS, chaves compostas e verificações de proprietário nas operações revisadas. |
| Compartilhamento | Envio exige propriedade; aceitação usa o e-mail confirmado do destinatário. Cópias aceitas ficam independentes. |
| Exportação | Exige sessão, propriedade e aprovação. A chave do cache inclui o professor e o conteúdo; a resposta é privada e não deve ser armazenada pelo cache HTTP. |
| Geração com IA | Contexto consultado com a identidade do professor; saída validada e salva como rascunho. Não há execução de ferramentas escolhidas pelo modelo. |
| Interface | Os caminhos revisados renderizam texto por React ou APIs de texto; não foi identificado um caminho de execução de HTML não confiável. |
| Preparação da publicação | `npm ci`, dependências resolvidas no lockfile e exclusão de arquivos de ambiente. A chave publicável do Supabase não é uma credencial administrativa. |

Esses resultados descrevem os arquivos revisados. Não comprovam que as mesmas políticas, versões e configurações estejam aplicadas no ambiente publicado. A revisão também não examinou todo o histórico do Git nem consultou uma base atualizada de vulnerabilidades de dependências.

## Ponto pendente: tamanho real de expansão do DOCX

**Situação:** hipótese sustentada pelo código, ainda dependente de validação. Sem classificação de severidade enquanto o comportamento e o impacto não forem demonstrados.

### Causa observada

Um DOCX é um pacote compactado. O limite de **20 MiB do arquivo enviado** não limita, por si só, os dados produzidos durante sua abertura.

Na exportação, [lib/docx-layout.ts](../lib/docx-layout.ts#L18) soma os tamanhos descompactados **declarados pelo ZIP** e rejeita uma soma acima de 80 MiB. Em seguida, lê o XML com `async('string')`. Na versão local inspecionada do JSZip, os blocos produzidos são acumulados e a divergência entre tamanho declarado e real só é verificada ao final da descompactação.

Na leitura inicial, os adaptadores [Gemini](../supabase/functions/sala-ai/index.ts#L120) e [Mistral](../supabase/functions/sala-ai-mistral/index.ts#L76) chamam `WordExtractor.extract` antes de conferir o limite de 60 mil caracteres. Os controles internos dessa dependência não estavam disponíveis para inspeção local.

Assim, existe uma diferença entre limitar o arquivo enviado, conferir seus metadados e limitar o trabalho real do descompactador. Um documento fora dos limites pode consumir recursos antes da rejeição. Não foi demonstrado que isso afete outros professores ou derrube o serviço.

### Controles que já existem

- Autenticação, propriedade do modelo e bucket privado com limite de envio.
- Aprovação da prova antes da exportação e verificação de propriedade das referências.
- Rejeição de determinados objetos incorporados e remoção de relacionamentos externos no exportador DOCX.
- Tratamento de falhas da exportação, cache de resultados com limite e prazo configurado para a função.

Esses controles devem ser preservados. Eles não substituem a contagem dos bytes efetivamente produzidos durante a descompactação.

### Solução proposta

1. Aplicar um orçamento de **bytes efetivamente emitidos**, por entrada e por documento, interrompendo a leitura antes de acumular o excedente. Manter a verificação dos metadados apenas como rejeição antecipada.
2. Limitar a quantidade de entradas e o tamanho dos XMLs, evitando confiar somente no tamanho final do texto extraído.
3. Aplicar proteção equivalente na leitura inicial e na exportação. Para extratores sem interrupção confiável, usar um processo isolado com memória e tempo limitados.
4. Verificar os limites reais do ambiente e a recuperação após uma tarefa rejeitada, sem testes de sobrecarga no site publicado.

### Como validar a correção

Em ambiente descartável, sem rede externa e com dados fictícios, reduzir o orçamento de uma cópia de teste para 32 KiB. Comparar um documento normal com pequenos arquivos que produzam 48 e 64 KiB, incluindo metadados inconsistentes. Medir os bytes emitidos e verificar a interrupção no limite, sem esgotar a memória. Repetir os testes nos dois adaptadores e na exportação, preservando os casos de cabeçalhos, imagens, caracteres especiais e gabarito.

O teste com orçamento reduzido comprova a regra local; não demonstra, sozinho, impacto sobre a disponibilidade em produção. O relatório formal mantém este ponto como `needs_validation`.

## Melhorias preventivas recomendadas

Estas recomendações não são vulnerabilidades confirmadas:

| Tema | Situação atual | Melhoria sugerida |
| --- | --- | --- |
| Corpos das requisições | Algumas rotas leem o corpo inteiro antes de conferir seu tamanho; os adaptadores de modelos usam leitura JSON sem o mesmo limite do proxy. | Compartilhar um leitor com limite em bytes durante a leitura e prazo máximo, incluindo as chamadas diretas às funções. |
| Fila de exportação | Resultados prontos têm limite de cache, mas trabalhos distintos pendentes não têm uma admissão agregada explícita. | Limitar trabalhos pendentes e conectar cancelamento à fila. O conversor já possui timeout interno; não foi comprovada espera indefinida. |
| Troca de conta durante download | Uma exportação já solicitada pode continuar após a desmontagem da tela. A saída normal aguarda a conclusão. | Considerar cancelamento na mudança de identidade para consistência do fluxo. Não foi demonstrado acesso indevido entre contas: concluir um download autorizado no mesmo perfil do navegador não constitui, sozinho, uma violação. |
| Incorporação em outros sites | Os cabeçalhos efetivamente publicados não foram verificados. | Conferir a política de enquadramento, como `frame-ancestors`, antes de decidir por alterações. A ausência no arquivo local não comprova clickjacking. |

## Próximas verificações

A revisão de cobertura identificou dois temas que ficaram para uma nova rodada:

- **Consumo dos provedores:** comparar reservas, repetição de leitura de PDF, novas gerações e permissões diretas sobre tarefas. Definir o orçamento por professor antes de avaliar abuso de quota.
- **Dependências das Edge Functions:** conferir a resolução e a integridade das dependências transitivas do Deno separadamente do `package-lock.json` usado pelo Next.js. Versões principais fixadas são um controle; a ausência de um `deno.lock` não é, isoladamente, uma vulnerabilidade.

Também permanecem pendentes a correspondência entre migrações e banco publicado, os limites do Auth, as políticas efetivas do Storage e o isolamento dos workers.

## Limitações da execução

A metodologia utilizada exige isolamento de sistema operacional, bloqueio de rede externa, ambiente sem credenciais, escrita apenas em área temporária e limites de recursos para executar código sob auditoria. Esses controles não estavam disponíveis nesta sessão. Por isso, os testes existentes foram lidos, mas não executados, e não foram feitas requisições de auditoria ao site ou ao banco.

Os validadores formais também recusaram a execução neste Windows por falta das primitivas de leitura protegida exigidas (`no-follow` e `nonblocking`). A execução formal está registrada como **incompleta**, com a revisão estática e as pendências preservadas. Não há certificado de segurança ou aprovação para produção.

A ferramenta de auditoria e seus arquivos operacionais foram instalados e mantidos fora do repositório. Esta revisão alterou somente a documentação do projeto.
