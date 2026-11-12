# Identidade visual do Provaai

[Abrir o kit de marca e telas no Figma](https://www.figma.com/design/56btn1bwQAtgCEk3gAi4ef?node-id=6-132)

O arquivo documenta a interface de referência em 11/11/2026. Os textos, formas, ícones e componentes são editáveis. Os exemplos utilizam dados fictícios; não reproduzem registros de professores em produção.

## Organização do arquivo

| Página | Conteúdo |
| --- | --- |
| 01 · Marca e componentes | Assinatura, paleta, tipografia, voz, mascote, botões, campos e estados de feedback |
| 02 · Telas desktop | 12 telas de acesso e organização do trabalho do professor |
| 03 · Mobile e fluxos | 10 telas mobile e 16 formulários e estados de uso |

As telas desktop incluem login por e-mail e código, Minhas turmas, detalhe da turma, Alunos, Provas coletivas e sua listagem por turma, Provas individuais, Modelos, Ajustes, Compartilhamentos e alunos inativos.

Os formulários abrangem criação e edição de turma, cadastro de aluno, preparação coletiva e individual, anexação de modelos, revisão de prova, compartilhamento, download, envio em segundo plano, geração com IA, reativação de aluno, exclusão de turma, validação de login, sessão por inatividade e carregamento de página.

## Cores e fontes

| Uso | Cor |
| --- | --- |
| Ação principal | `#5210CE` |
| Destaque da marca | `#2ADFB8` |
| Texto principal | `#0D1823` |
| Fundo | `#F5F3F5` |
| Superfície | `#FFFFFF` |
| Borda | `#DAD6DF` |

A fonte de referência é definida em `resources/css/bloub-tokens.css`: Trebuchet MS nos títulos e Segoe UI no corpo. No Figma, foram autorizadas Lato e Open Sans como alternativas disponíveis. Essa substituição é exclusiva do arquivo de design.

O mascote vem de `public/bloub`, e os ícones seguem os SVGs usados pela interface. Os componentes de turma incluem as dez opções de ícone e as dez cores definidas no projeto.

## Movimento e comportamento

O kit registra as expressões do mascote e as orientações de movimento: botões em 160 ms, indicador da header em 200 ms, ativação dos ícones por hover ou foco e respeito à preferência de movimento reduzido. As animações executáveis continuam implementadas no site; o arquivo não é uma reprodução funcional da autenticação, da IA ou dos downloads.

Os percentuais exibidos nos quadros são exemplos de estados do produto. Na aplicação, o progresso da geração é medido pelas etapas concluídas e o download acompanha o preparo e a transferência. Nenhuma tarefa real é executada pelo arquivo de design.

## Revisão e atualização

As telas são referências editáveis, com adaptações de tipografia autorizadas, e não capturas idênticas de cada combinação possível de dados. Ao alterar uma tela no código, revise o quadro correspondente e os componentes compartilhados.

Foram conferidos visualmente os quadros de marca e componentes e amostras dos fluxos desktop, mobile, preparação e download. A limpeza da captura temporária de referência e a revisão final de todos os quadros aguardam permissão de edição para a conta conectada ao Figma.
