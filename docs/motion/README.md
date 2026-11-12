# Provaai — Cada aluno, uma possibilidade

## Versão atual: Motion V9 — sincronia visual e dinâmica por cena

- **Vídeo:** `output/v9/Provaai-motion-v9-1080p-120fps.mp4`.
- **Edição:** `audio-v9.mjs`, `timing-v9.mjs` e `remix-v9.mjs`.

A revisão anterior verificava principalmente o atraso introduzido pelo AAC. Esta revisão também confronta os acentos com a animação: os sons das palavras estavam 150–180 ms após o fim de suas entradas; os arrastes estavam até 33 ms afastados do pico real de velocidade da câmera. A V9 usa a curva de câmera amostrada a 120 Hz, o travamento das alças da seleção, os quadros de digitação e os estados visuais dos botões para reposicionar os sons.

Trilha com crescimento no preparo/download, menos percussão durante a revisão, pequenos preparos rítmicos nas passagens e resoluções musicais junto às confirmações. Mantidos os arrastes suaves da V8. O volume integrado medido continua em **-16,15 LUFS**; a faixa de loudness sobe de **1,3 para 2,7 LU**, com true peak de **-1,81 dBTP**. Dinâmica por contraste entre momentos, sem aumentar o volume médio final.

Verificações:
- 54 eventos comparados entre o mix e o áudio AAC decodificado: nenhum atraso de codificação medido.
- Leitura dos pixels do vídeo final: confirmação verde da aprovação em 18,975 s e do download em 22,5917 s, nos mesmos quadros dos respectivos marcadores sonoros.
- Hash SHA-256 do fluxo de vídeo idêntico à V8: animação, 30 segundos e 120 fps preservados.

Os testes de marcadores verificam o instante de início ou a âncora energética programada, conforme o efeito; não significam que todas as notas de uma confirmação musical tenham seu pico no mesmo quadro. Relatórios e âncoras estão em `output/v9/`.

```powershell
node docs/motion/remix-v9.mjs
node docs/motion/verify-sync-v9.mjs
node docs/motion/verify-actions-v9.mjs
```

O remix requer o vídeo V7 e seu `camera-120fps.json`, gerados por `render-v7.mjs`. V8 preservada. Nenhum commit criado.

## Motion V8, preservada — trilha mais ativa e arrastes suaves

- **Vídeo:** `output/v8/Provaai-motion-v8-1080p-120fps.mp4`.
- **Áudio:** `audio-v8.mjs`; montagem: `remix-v8.mjs`.
- **Mix e camadas:** `mix-v8.wav`, `musica-v8.wav` e `efeitos-v8.wav`, em `output/v8/`.

A trilha ganhou baixo sincopado com harmônicos, percussão a 120 BPM, notas curtas com eco discreto e variações por compasso. A redução de volume da música ocorre apenas nos cliques e confirmações principais e é menor que na V7.

O arraste sintético foi substituído por três gravações da soundcn: `card-slide-1`, `card-slide-4` e `card-slide-8`, de Kenney, CC0 segundo os módulos instalados. São filtradas e ajustadas à duração da ação; seu pico de energia é alinhado ao relógio visual da V7. Removido o impacto grave automático das passagens. Os módulos foram instalados em `C:/Users/R3/.codex/tools/soundcn`, fora do projeto; só os recursos de áudio usados no filme estão em `assets/soundcn/`.

O vídeo é copiado diretamente da V7 sem recodificação: preserva exatamente a animação, os 30 segundos e os 120 fps. Normalização de áudio em duas passagens com alvo de -16 LUFS e margem de true peak de -1,8 dBTP. Medições do MP4 em `output/v8/loudness-final.json`; sincronia em `verificacao-sincronia.json`.

```powershell
node docs/motion/remix-v8.mjs
node docs/motion/verify-sync-v8.mjs
```

V7 preservada para comparação. Sem locução e sem commit.

## Motion V7 / Modelo B, preservada — câmera contínua, 120 fps

- **Vídeo:** `output/v7/Provaai-motion-v7-1080p-120fps.mp4`, 30 segundos, 1920 × 1080, **120 fps nativos**.
- **Render:** `render-v7.mjs`; roteiro/relógio: `timing-v7.mjs`; áudio: `audio-v7.mjs`.
- **Storyboard:** `output/v7/storyboard-v7.jpg`.
- **Relatórios:** `verificacao-video.json`, `verificacao-sincronia.json` e `verificacao-camera.json`, em `output/v7/`.

Modelo alternativo inspirado na referência local enviada pelo usuário. Os nove momentos ocupam uma composição espacial única: a câmera percorre os painéis, recua durante as passagens, faz curvas e inclinações, e se aproxima da palavra selecionada. Não há cortes entre slides. Cartões, sinais luminosos e personagem reagem às ações em seus próprios planos. O encerramento mantém o Bloub sem olhos de coração.

Cada quadro é calculado a 120 Hz. Passagens rápidas recebem duas amostras subquadro de exposição curta; não há duplicação de um vídeo de 60 fps nem interpolação de vídeo por IA. A verificação decodifica os 3.600 quadros e confere a base temporal, continuidade e repetição de quadros adjacentes. Telas e players de menor frequência podem apresentar menos quadros que os contidos no arquivo.

### Áudio e instalações solicitadas

O `click-soft` foi instalado com o CLI shadcn em **`C:/Users/R3/.codex/tools/soundcn`**, fora do repositório. O áudio foi extraído do módulo instalado e incorporado aos cliques e seleções do filme. Autor e licença informados pelo registro: **Kenney, CC0**. Arquivo e origem em `assets/soundcn/`. Fonte: [soundcn](https://github.com/kapishdima/soundcn).

Trilha original refeita com 50 eventos sonoros: cliques suaves, passagens estéreo em camadas, impactos graves, papel, sinais de conexão e confirmações. A música abre espaço para os efeitos por redução localizada de volume; reflexões curtas dão profundidade. O MP4 usa AAC estéreo 48 kHz/256 kbps e normalização com alvo de -16 LUFS e true peak de -1,5 dBTP. Sem locução.

A skill [motion-design / LottieFiles](https://github.com/LottieFiles/motion-design-skill) está instalada em **`C:/Users/R3/.codex/skills/motion-design`**, pelo instalador do Codex. Nenhum arquivo de skill foi instalado no projeto. Aplicados seus princípios de antecipação, trajetórias em arco, movimentos secundários e hierarquia de atenção. O catálogo de motion SaaS do Higgsfield foi consultado; não foi gerado ou incorporado material de lá.

```powershell
node docs/motion/render-v7.mjs --stills
node docs/motion/render-v7.mjs
node docs/motion/verify-sync-v7.mjs
node docs/motion/verify-video-v7.mjs
```

V6 e demais versões preservadas. Nenhum commit criado pelo agente.

## Motion V6, preservada — Bloub reage às ações

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
