# Segurança — versão Laravel

Atualizado em 10/11/2026. Este documento registra controles e testes locais; não certifica segurança nem conclui a auditoria formal anterior. A [revisão histórica](SEGURANCA-LEGADO.md) foi preservada com suas limitações.

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

O relato anterior de acesso a turmas/alunos no Supabase não foi reproduzido nem diagnosticado em produção nesta migração. Não se afirma que o ambiente antigo foi corrigido. Uma chave publicável não é segredo administrativo; o isolamento depende das permissões/políticas efetivas.

## Pendência: expansão de DOCX

O limite de upload e os tamanhos declarados no ZIP não limitam necessariamente os bytes realmente descompactados. A conversão agora é um processo separado com timeout de 120 segundos, mas ainda não há contagem interrompível de todos os bytes expandidos nem isolamento completo de memória/rede. A hipótese de consumo excessivo segue pendente de validação; não foi demonstrado ataque contra produção.

Solução proposta: limitar bytes efetivamente emitidos por entrada/documento, número de entradas e XMLs; interromper antes de acumular excedentes; proteger extração e exportação igualmente. Para dependências sem interrupção confiável, usar worker com limites de CPU/memória e rede bloqueada. Validar com arquivos pequenos e orçamento reduzido em ambiente isolado. O Dockerfile sozinho não comprova essa proteção.

## Operação e limites

No Supabase, não exponha as tabelas Laravel pela Data API. Use schema privado fora dos schemas expostos ou desabilite essa API em projeto dedicado. Confira permissões, TLS, backups e limites dos workers antes do corte. O banco publicado não foi alterado aqui.

Testes funcionais não substituem auditoria atualizada de dependências ou carga. Docker, PostgreSQL hospedado, SMTP e cotas/latências reais de IA precisam de homologação. Use `APP_DEBUG=false` em produção. O mailer `log` serve somente ao desenvolvimento, pois grava códigos no disco.

As ferramentas de auditoria e seus arquivos operacionais ficam fora do repositório. Não foram adicionadas skills ou instruções de agentes ao projeto.
