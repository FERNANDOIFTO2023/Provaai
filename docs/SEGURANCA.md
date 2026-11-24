# Segurança — versão Laravel

Atualizado em 24/11/2026. Este documento registra controles implementados e evidências datadas; não certifica segurança nem conclui uma auditoria integral. A [revisão histórica](SEGURANCA-LEGADO.md) foi preservada com suas limitações.

## Controles e correções

| Tema | Solução | Evidência local |
| --- | --- | --- |
| Sessão ausente/forjada | Cookie Laravel; marcador de atividade não concede acesso. | Requisições anônimas/forjadas recebem 401. |
| Acesso cruzado | Escopo de proprietário em registros, referências, arquivos, geração e cópias. | Testes com professores distintos recusam acessos cruzados. |
| Chaves no cliente | SDK/configuração Supabase removidos; IA chamada pelo servidor com variáveis privadas. | Build sem configuração de chaves no cliente; `.env` ignorado. |
| Sessão e CSRF | HttpOnly, SameSite, regeneração de sessão e middleware CSRF. | Login/logout automatizados e fluxo local no navegador. HTTPS/Secure dependem do deploy. |
| Códigos | HMAC, prazo, limite de envios/tentativas, sem renovar validade no reaproveitamento. | Testes com Mail simulado. |
| Arquivos | Propriedade, assinatura básica, limite de 20 MiB, rotas autenticadas e cache privado. | Isolamento e conversões reais testados. |
| Aprovação | Edição relevante revoga aprovação; exportação exige aprovação e propriedade. | Testes de edição e exportação recusada. |
| Cópias/duplicatas | Cópia independente, aceitação idempotente, códigos alocados sob transação e validação de questões no servidor. | Testes de cópias de turma/aluno e duplicatas manuais. |
| PDF após renomear turma | Nome da turma incluído na chave de cache. | Correção implementada; conversor coberto na suíte. |
| Importação | Banco vazio, referências do mesmo proprietário e hashes. | Validação sem gravação e recusa de referências cruzadas testadas. |
| Importação XLSX de alunos | Turma ativa do proprietário, prévia sem gravação, confirmação transacional, limites de ZIP/XML e códigos atribuídos no servidor. | Casos de acesso cruzado, duplicatas, arquivo inválido e reenvio nos testes de importação. |
| Materiais da turma | Upload, prévia, download e remoção autenticados; fontes congeladas nos rascunhos e anexos fora das cópias compartilhadas. | Testes de acesso entre professores, limites e geração restrita; respostas dos provedores simuladas. |
| Indicadores | Agregação pelo professor da sessão, sem aceitar outro proprietário do cliente; resposta privada sem cache público. | Testes de autenticação, isolamento, períodos e dados de consumo ausentes. |

A importação de uma planilha recebida de outro professor cria cadastros na turma do importador; não autoriza consulta ou edição da turma de origem. Compartilhar pelo site exige o fluxo de convite e aceite, que cria cópias independentes. Restringir o botão na interface não substitui autorização no servidor.

O relato anterior de acesso a turmas/alunos no Supabase não foi reproduzido nem diagnosticado em produção nesta migração. Não se afirma que o ambiente antigo foi corrigido. Uma chave publicável não é segredo administrativo; o isolamento depende das permissões/políticas efetivas.

## Pendência: expansão de DOCX

O limite de upload não garante isolamento de recursos em todos os leitores. A importação XLSX e a extração dos materiais têm validações de ZIP/XML, mas isso não comprova proteção de todos os caminhos do LibreOffice e da exportação. A conversão de documentos usa subprocessos com timeout de 120 segundos por operação; o worker de preparação tem prazo próprio de 420 segundos. Não há comprovação de isolamento completo de memória/rede nem de contagem interrompível de todos os bytes processados pelas dependências. A hipótese de consumo excessivo segue como limite da análise; não foi demonstrado ataque contra produção.

Solução proposta: limitar bytes efetivamente emitidos por entrada/documento, número de entradas e XMLs; interromper antes de acumular excedentes; proteger extração e exportação igualmente. Para dependências sem interrupção confiável, usar worker com limites de CPU/memória e rede bloqueada. Validar com arquivos pequenos e orçamento reduzido em ambiente isolado. O Dockerfile sozinho não comprova essa proteção.

## Operação e limites

No Supabase, não exponha as tabelas Laravel pela Data API. Use schema privado fora dos schemas expostos ou desabilite essa API em projeto dedicado. Confira permissões, TLS, backups e limites dos workers antes do corte. O banco publicado não foi alterado aqui.

Testes funcionais não substituem auditoria atualizada de dependências ou carga. Os relatórios de publicação registram Docker e PostgreSQL em operação na AWS; isso não garante disponibilidade contínua dos provedores, entrega de e-mail ou isolamento absoluto. Use `APP_DEBUG=false` em produção. O mailer `log` serve somente ao desenvolvimento, pois grava códigos no disco.

As ferramentas de auditoria e seus arquivos operacionais ficam fora do repositório. As regras de colaboração e entrega estão em [CONTRIBUTING.md](../CONTRIBUTING.md) e [AGENTS.md](../AGENTS.md).
