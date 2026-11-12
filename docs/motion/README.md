# Provaai — Cada aluno, uma possibilidade

## Versão atual: Motion V6 — Bloub reage às ações

- **Vídeo:** `output/v6/Provaai-motion-v6-1080p.mp4`, 28 segundos, 1080p, 60 fps.
- **Render:** `render-v6.mjs`; atuação: `bloub-choreography.mjs`.
- **Quadros:** `output/v6/bloub-no-filme.jpg`; poses: `output/v6/bloub-coreografia.json`.

As formas originais do Bloub são preservadas, mas os ciclos repetidos do site foram substituídos por movimentos únicos para cada cena. O olhar antecede a inclinação do corpo; compressão, impulso e acomodação respondem às mudanças de estado. As expressões trocam durante o fechamento das pálpebras, sem sobrepor dois desenhos de olhos.

| Trecho | Relação com a ação |
| --- | --- |
| Abertura e conexões | Olha para o cursor, comprime no clique e acompanha os quatro recursos. Reage ao retorno do sinal. |
| Perfis | Recebe os sinais dos alunos e acompanha suas direções. |
| Preparo | Inclina-se para ler, acompanha as linhas de cima para baixo e confirma a conclusão. |
| Aprovação | Segue a resposta e o botão. Antecipa, salta uma única vez após aprovar e aterrissa com acomodação. |
| Download | Segue a trajetória descendente dos arquivos, inclina-se para a bandeja e reage à conclusão com um recuo curto. |
| Encerramento | Entra de lado, olha para o convite, faz um aceno com o corpo e termina com olhar aberto. Sem olhos de coração. |

Os gatilhos de aprovação, download e conexões usam `timing-v6.mjs`, compartilhado com o áudio. Mantidos a trilha, os 66 eventos sonoros e os efeitos de luz da V5. Não há locução.

```powershell
node docs/motion/render-v6.mjs --stills
node docs/motion/render-v6.mjs
node docs/motion/verify-sync-v6.mjs
```

V5 preservada. Nenhum commit criado.

## Motion V5, preservada — Bloub animado

- **Vídeo:** `output/v5/Provaai-motion-v5-1080p.mp4`, 28 segundos, 1080p, 60 fps.
- **Render:** `render-v5.mjs`; animação do personagem: `bloub-animation.mjs`.
- **Quadros do personagem:** `output/v5/bloub-no-filme.jpg`.
- **Tempos e transformações lidos dos SVGs:** `output/v5/bloub-animacoes-originais.json`.

O personagem usa as camadas originais de corpo e rosto dos SVGs do site. Como o renderizador Canvas não executa CSS dentro de SVG, `bloub-animation.mjs` lê os keyframes e os avalia no tempo de cada quadro, com a curva CSS `ease-in-out` e o ponto de transformação do personagem. Não é uma gravação de tela: são as formas e os valores de animação do site compostos diretamente no filme.

| Trecho | Expressão e movimento |
| --- | --- |
| Abertura | Flutuação e piscada de `resources/css/bloub.css`, com olhar dirigido ao cursor. |
| Conexões e perfis | Bloub curioso, com inclinação e deslocamento do olhar do SVG original. |
| Preparo | Personagem curioso ao lado dos rascunhos. |
| Aprovação | Transição para o feliz e salto com compressão/alongamento do corpo. |
| Download | Curioso enquanto prepara, feliz quando conclui. |
| Encerramento | Carinhoso, com olhos de coração e pulsação do SVG original. |

As formas vêm de `public/bloub/animated/`. As entradas e saídas no enquadramento são específicas do filme. Foram preservados os sons, a duração, os efeitos nas conexões e o destaque da palavra “aluno” da V4. A mudança para feliz começa no mesmo instante da aprovação.

```powershell
node docs/motion/render-v5.mjs --stills
node docs/motion/render-v5.mjs
node docs/motion/verify-sync-v5.mjs
```

Sem locução. Versões anteriores preservadas e nenhum commit criado.

## Motion V4, preservada — conexões e seleção com luz

- **Vídeo:** `output/v4/Provaai-motion-v4-1080p.mp4`, 28 segundos, 1080p, 60 fps.
- **Render:** `render-v4.mjs`; áudio: `audio-v4.mjs`; tempos compartilhados: `timing-v4.mjs`.
- **Detalhes dos efeitos:** `output/v4/detalhes-efeitos.jpg`.
- **Verificação de áudio exportado:** `node docs/motion/verify-sync-v4.mjs`.

As conexões recebem partículas que percorrem a distância real de cada segmento, com cauda, núcleo luminoso, pulso de chegada, pequena reação do ícone e retorno ao centro. O fluxo dos perfis também acende ao chegar ao ponto de geração. Os sons de chegada usam os mesmos tempos de percurso da animação.

Na palavra “aluno”, o destaque se expande atrás das letras, as alças acompanham a seleção e se acomodam com um pequeno impulso, e uma faixa de luz verde atravessa o fundo. Há anéis, partículas discretas e um brilho de confirmação. O texto continua nítido sobre o efeito. A faixa de luz e o brilho sonoro compartilham o instante central.

```powershell
node docs/motion/render-v4.mjs --stills
node docs/motion/render-v4.mjs
node docs/motion/verify-sync-v4.mjs
```

As versões anteriores permanecem disponíveis. Sem locução e sem commit.

## Motion V3, preservada — fluidez e sincronização

- **Vídeo:** `output/v3/Provaai-motion-v3-1080p.mp4` — 28 segundos, Full HD, 60 fps.
- **Edição:** `render-v3.mjs`, `audio-v3.mjs` e `timing-v3.mjs`.
- **Áudio:** `output/v3/mix-v3.wav`, `efeitos-v3.wav` e `musica-v3.wav`.
- **Verificação:** `verify-sync-v3.mjs` decodifica o áudio AAC do MP4 e compara sua posição temporal com o mix original. O relatório é salvo em `output/v3/verificacao-sincronia.json`.

Na V2, alguns efeitos de passagem começavam antes da troca de cena e seu envelope atingia o pico aproximadamente 0,4–0,6 segundo antes da velocidade máxima da transição. A V3 centraliza o envelope no mesmo instante do pico visual. Cliques, digitação, seleção, aprovação e download usam tempos compartilhados entre render e áudio.

O movimento usa desaceleração cúbica, molas com menor oscilação, trajetórias curvas para cartões e cursor, aproximações de câmera mais longas e deriva discreta durante as cenas. As passagens laterais e verticais agora usam exatamente a largura/altura do quadro, eliminando o espaço entre os planos. Cada quadro combina três amostras temporais centradas no tempo de apresentação, para suavizar o deslocamento sem acrescentar atraso ao vídeo.

```powershell
node docs/motion/render-v3.mjs --stills
node docs/motion/render-v3.mjs
node docs/motion/verify-sync-v3.mjs
```

A V1 e a V2 continuam disponíveis. Sem locução, com textos em português. Nenhum commit criado.

## Motion V2, preservada

Refação a partir da referência de motion design fornecida pelo usuário: elementos centrais, seleção de palavras, zooms de câmera, linhas que conectam recursos, transformação de superfícies e cortes com desfoque de movimento. Cenas curtas alternam acelerações com pausas para leitura.

- **MP4 V2:** `output/v2/Provaai-motion-v2-1080p.mp4` — 28 segundos, 1920 × 1080, 60 fps, H.264 + AAC estéreo.
- **Player:** `index.html`, agora abre a V2 e oferece um link para a anterior.
- **Render e movimentos:** `render-v2.mjs`.
- **Música e efeitos:** `audio-v2.mjs`, com 51 eventos sincronizados: cliques, teclas, estalos, passagens de ar, papel, impactos graves e confirmações.
- **Áudio para edição:** `output/v2/efeitos-v2.wav`, `musica-v2.wav` e `mix-v2.wav`. O áudio do MP4 recebe normalização de loudness com alvo de -16 LUFS e limite de true peak de -1,5 dBTP.
- **Marcadores de áudio:** `output/v2/marcadores-sonoros.json`.
- **Quadros:** `output/v2/storyboard-v2.jpg` e 12 PNGs.
- **Idioma:** textos em português; sem locução.

```powershell
node docs/motion/render-v2.mjs --stills
node docs/motion/render-v2.mjs
```

| Tempo | Movimento e conteúdo |
| --- | --- |
| 00:00–00:01.6 | Bloub transforma-se no botão de criar prova; cursor clica. |
| 00:01.6–00:04 | Linhas desenham conexões com turmas, perfis, questões e modelos. |
| 00:04–00:06.4 | Palavras entram em sequência; zoom e seleção em “aluno”. |
| 00:06.4–00:09.6 | Campo recebe conteúdo digitado; opções aparecem; clique para criar. |
| 00:09.6–00:12 | Perfis se abrem e conectam seus critérios ao preparo. |
| 00:12–00:15 | Abertura circular para a composição escura dos rascunhos. |
| 00:15–00:18 | Deslocamento vertical para a prova; resposta e aprovação. |
| 00:18–00:20.8 | Arquivos se abrem em leque e são recolhidos pelo download. |
| 00:20.8–00:23 | Passagem lateral para a tela real; aproximação de câmera. |
| 00:23–00:25 | Tipografia entra em direções opostas: mais tempo para ensinar. |
| 00:25–00:28 | Assinatura da marca, chamada e endereço. |

O vídeo de referência foi analisado em quadros locais. Ele informa o ritmo e a linguagem visual; suas imagens, logotipos, música e eventuais vozes não foram incorporados ao material final. A análise temporária está em `reference-analysis/`, ignorada pelo Git. Toda a trilha e os efeitos da V2 são sintetizados pelo código do projeto.

## Primeira versão, preservada

Filme de apresentação com direção visual inspirada em lançamentos de produto: tipografia grande, fundos limpos, superfícies flutuantes, entradas com amortecimento e transições curtas. Mantém a paleta e o Bloub do Provaai.

- **Entrega:** `output/Provaai-apresentacao-1080p.mp4` — 36 segundos, 1920 × 1080, 60 fps, H.264 + AAC estéreo.
- **Player local:** `index.html`.
- **Storyboard:** `output/storyboard.jpg` e oito quadros PNG.
- **Áudio:** `output/trilha-original.wav`, trilha instrumental sintetizada para este filme, sem locução.
- **Edição:** `render.mjs` contém cenas, textos, tempos, movimentos e síntese da trilha. Cada quadro é calculado pelo tempo; a exportação é determinística.

## Roteiro

| Tempo | Sequência |
| --- | --- |
| 00:00–00:05.5 | Uma turma. Muitos jeitos de aprender. Apresentação da marca. |
| 00:05.5–00:10.5 | Organização das turmas, com captura real do modo demonstração. |
| 00:10.5–00:15.5 | Perfis pedagógicos e diferentes necessidades dos alunos. |
| 00:15.5–00:21 | Conteúdo, distribuição das questões e rascunhos com IA. |
| 00:21–00:26 | Revisão e aprovação pelo professor. |
| 00:26–00:30.5 | PDF, Word e gabarito. |
| 00:30.5–00:36 | Marca, assinatura e endereço do site. |

## Renderizar

O render usa `@napi-rs/canvas` já instalado no projeto e um executável FFmpeg. Não modifica a aplicação nem exige uma alteração no package.json da raiz.

```powershell
node docs/motion/render.mjs --stills
node docs/motion/render.mjs
```

Por padrão, o executável é `docs/motion/ffmpeg.exe`. Para usar outro local:

```powershell
$env:FFMPEG_PATH = 'C:\caminho\ffmpeg.exe'
node docs/motion/render.mjs
```

As fontes são Segoe UI e Trebuchet MS do Windows. Para renderizar em outro sistema, atualize os caminhos de `GlobalFonts.registerFromPath`.

`capture.mjs` é uma ferramenta opcional para renovar as capturas do site público em um perfil temporário do Chrome. Usa Playwright Core do runtime local do Codex; ajuste o caminho do import em outro computador. A captura entra apenas na demonstração, com dados fictícios. Não envia e-mail, gera provas ou altera dados reais.

## Origem dos elementos

- Marca, cores e Bloub: `docs/IDENTIDADE-VISUAL.md` e `public/bloub`.
- Capturas: site público `https://provaai.vercel.app/`, modo demonstração, em 12/11/2026.
- Perfis e questões: exemplos fictícios já existentes em `lib/model.ts`.
- Formulário ampliado, revisão e arquivos: composições gráficas simplificadas para apresentação; não são gravações de execução da IA ou dos downloads.
- Música e efeitos: síntese original no próprio renderizador; nenhum áudio externo.

O Higgsfield foi consultado para avaliar os modelos disponíveis. O filme final foi composto e renderizado localmente para controlar a legibilidade da interface e a animação da tipografia.

Os arquivos de saída e o executável FFmpeg estão ignorados pelo Git para evitar acrescentar renderizações e binários ao código-fonte. Os arquivos continuam disponíveis localmente para compartilhar. Nenhum commit foi criado.
