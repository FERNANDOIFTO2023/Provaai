# Verificação da publicação do painel

Data: 23/11/2026.

O commit `a01d762d59dacddd951749884ba9cdad5995f11c` foi confirmado na `main` remota e no checkout local. O [workflow 45241966428](https://github.com/FERNANDOIFTO2023/Provaai/actions/runs/45241966428) terminou com sucesso às 15h50min22s de Brasília, nos jobs `validate` e `migration`. Passaram as verificações de frontend, backend, matemática, construção da imagem e migração em PostgreSQL isolado.

Na primeira consulta, o site ainda entregava `app-CA5GGAxA.js`, sem o endpoint do painel. Durante a investigação passou a servir `app-KMYWwWa7.js`, contendo o calendário e `/api/teacher/dashboard`. O processo existente aguarda o CI aprovado e verifica releases a cada três minutos, além do tempo de construção/publicação. A atualização ocorreu automaticamente, sem repetir jobs, criar commits ou alterar configurações.

Um Edge isolado abriu o site público, entrou em **Explorar demonstração**, clicou em **Meu espaço / Área do professor** e confirmou os títulos **Calendário de atividade** e **Consumo de IA**, sem exceções JavaScript. [Captura da versão publicada](painel-publicado.png). Os números da captura são fictícios da demonstração.

A rota do painel respondeu HTTP 401 ao acesso sem sessão, preservando a autenticação. Não foi acessada a conta real do professor nem validado seu consumo particular. A confirmação visual foi feita na demonstração pública.

Resultado: painel confirmado na versão publicada. Para uma aba já aberta, recarregar com **Ctrl + F5** e clicar em **Meu espaço / Área do professor**, acima de **Minhas turmas**. No celular, abrir o menu primeiro.

Validações desta investigação: `git ls-remote`, GitHub Actions via conector, leitura HTTP do HTML/JavaScript, consulta não autenticada ao endpoint, teste de navegador real e `git diff --check`. Não houve mudança de implementação, portanto não foi necessário repetir as suítes locais. Apenas este relatório e a captura foram adicionados, sem staging ou commit.
