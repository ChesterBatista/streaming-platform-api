# Revisão do frontend — StreamOne

> Registro histórico da implementação. A conferência atual está em [AUDITORIA-FINAL.md](../AUDITORIA-FINAL.md). Em 25/09/2026, o formulário de planos foi alinhado a nome de 100 caracteres e preço máximo 99999999.99; a chave pública local foi identificada como demonstração em config.js e no README. Os nove JavaScripts passaram por node --check. Não houve redesenho nem teste visual de navegador nesta execução.

Implementação realizada em 23/09/2026, restrita a `frontend/`. Os controllers, DTOs e services existentes foram consultados para confirmar contratos e regras. Não foram alterados backend, banco, seed, credenciais, dependências ou configurações. Não foram criados endpoints, exclusão de entidades ou testes automatizados.

## Arquivos criados

- `js/presentation.js`: título de apresentação, capas locais e composição visual das capas.
- `js/admin-forms.js`: formulários, paginação, transições, vínculos e upload do Studio.
- `REVISAO-FRONTEND.md`: este relatório.

## Arquivos alterados

- `js/auth.js`: nomes amigáveis centralizados e mensagens de sessão/acesso no SweetAlert2.
- `js/login.js`: nomes amigáveis na saudação e nos cards demo.
- `js/home.js`: apresentação dos títulos e perfis, enquadramento das capas, compartilhamento de downloads, proteção contra renderizações atrasadas e retorno à última página válida.
- `js/content.js`: apresentação dos nomes e títulos e fallback compartilhado de capas.
- `js/admin.js`: integração das listagens e detalhes, indicadores, ações, nomes, capas e navegação acessível.
- `home.html`, `content.html`, `admin.html`: inclusão dos scripts auxiliares.
- `css/base.css`: camadas das capas, foco e limites dos modais.
- `css/home.css`: enquadramento de hero, catálogo e histórico e quebra de textos longos.
- `css/admin.css`: capas, formulários, modais, tabelas, textos e menu mobile.

`index.html`, `js/api.js` e `js/config.js` foram preservados. Os cards demo do login são atualizados pelo JavaScript, mantendo as credenciais originais.

## Funcionalidades implementadas

- Pedro, Aline e Chester apresentados por `Auth.getDisplayName`, sem alterar nomes persistidos.
- Remoção visual do prefixo inicial `[DEMO]` por helper compartilhado. Ao editar conteúdo demo, o prefixo original é preservado no envio à API.
- Capas com imagem inteira e camada desfocada de preenchimento. Thumbnail protegida continua prioritária; downloads repetidos da mesma capa são compartilhados e as URLs são liberadas ao sair, além da invalidação após upload no Studio.
- Conteúdos: listagem paginada, filtros explicitamente limitados à página atual, criação, edição, detalhes, status, planos e categorias vinculados, inclusão/remoção de vínculos e upload JPEG/PNG até 5 MiB pelo campo multipart `file`.
- Publicação condicionada à existência de plano. A interface impede remover o último plano de um conteúdo publicado e apresenta somente transições de status compatíveis com o estado atual.
- Categorias: listagem paginada, criação e edição.
- Planos: listagem paginada, criação, edição e alternância ACTIVE/INACTIVE.
- Assinaturas: listagem paginada, criação com usuários/planos ativos reais, expiração opcional convertida para ISO com fuso e alteração de status conforme estado e vigência. CANCELLED/EXPIRED não oferecem novas transições. Início e status de criação ficam a cargo do servidor.
- Usuários: listagem paginada somente de leitura, com nome, e-mail, papel e status; nenhuma senha ou hash é renderizado.
- Indicadores: categorias por `meta.total`; conteúdos por consulta de todas as páginas para contar corretamente os estados, sem novos endpoints.
- Anterior/próxima, limites, página fora do intervalo, estados vazios, erros e tentativa de recarregamento nas listagens do Studio.
- SweetAlert2 para formulários, confirmação de desvínculo, sucesso, erros, conflitos e sessão expirada. Mensagens retornadas pela API são preservadas e escapadas quando inseridas em HTML.
- Menu mobile com Escape, controle de foco e bloqueio de interação com o conteúdo ao fundo; foco visível e preferência por movimento reduzido preservados.

## Permissões

| Perfil | Interface disponível |
| --- | --- |
| SUBSCRIBER | Home e detalhes; acesso ao Studio recusado com redirecionamento. |
| CONTENT_MANAGER | Conteúdos, categorias, vínculos de planos/categorias e upload. Seções de planos, assinaturas e usuários ocultas. |
| ADMIN | Recursos do gestor, administração de planos e assinaturas e consulta de usuários. |

O gestor consulta planos para vinculação por endpoints de leitura existentes. A escrita de planos permanece exclusiva do ADMIN. O backend continua responsável por autorizar cada operação e resolver conflitos, inclusive mudanças concorrentes.

## Funcionalidades preservadas

Login real, API Key, JWT, redirecionamento por papel, logout, catálogo, histórico, cálculo do progresso, gravação de progresso, avaliação de 1 a 5 com comentário, consulta de avaliações, página de detalhes e capas demo existentes.

Os textos de assinatura e rodapé especificados em `content.html` foram preservados literalmente. A preservação do código de escrita de progresso/avaliação não equivale a uma regressão completa desses fluxos no navegador.

## Verificações executadas

| Verificação | Resultado |
| --- | --- |
| `npm.cmd run build` | Aprovado. |
| `npx.cmd prisma validate` | Schema válido. |
| `npm.cmd audit` | Zero vulnerabilidades. |
| `node --check` nos nove arquivos JS do frontend | Aprovado após os ajustes finais. |
| Login HTTP das três contas demo e `/users/me` | HTTP 200 para todos os perfis. |
| Conteúdos, categorias e planos paginados | HTTP 200 para os três perfis. |
| Usuários e assinaturas administrativas | HTTP 200 para ADMIN e HTTP 403 para SUBSCRIBER/CONTENT_MANAGER. |
| Conteúdo individual e seus vínculos | HTTP 200 nas consultas realizadas com os três perfis. |
| Histórico, assinatura própria e média de avaliações do assinante | HTTP 200. |
| Progresso e avaliação já existentes do conteúdo 2 | HTTP 200. |
| Progresso e avaliação ausentes do conteúdo 3 | HTTP 404 esperado, tratado pelo frontend como ausência de registro. |
| Thumbnail protegida do conteúdo 1 como ADMIN | HTTP 200, image/png, 1.620.590 bytes. |
| Conteúdos na página 999 | HTTP 200 com `data: []` e metadados válidos, para ADMIN e SUBSCRIBER. |

As consultas HTTP usaram as credenciais demo já presentes no frontend. Nenhum registro foi criado, editado ou removido; nenhum upload foi executado.

As primeiras invocações de `npm`/`npx` foram bloqueadas pela política de scripts do PowerShell; os equivalentes `.cmd` funcionaram sem alterar essa política. O audit inicialmente falhou no ambiente restrito e concluiu após autorização de acesso externo.

O navegador integrado foi acionado conforme a skill disponível, mas retornou indisponibilidade (`Browser is not available: iab`). Não foi possível executar inspeção visual ou testes interativos nesta sessão. O diretório não apresentou um repositório Git utilizável para comparação por `git diff`.

## Problemas corrigidos

- Ações administrativas ainda sem integração e botões de criação sem operação.
- Listagens administrativas limitadas à primeira página.
- Indicadores limitados aos primeiros 100 registros.
- Seções exclusivas de ADMIN sendo reveladas simultaneamente ao aplicar a visibilidade por papel.
- Prefixos e nomes técnicos exibidos ao público.
- Corte excessivo das capas verticais.
- Downloads repetidos da mesma thumbnail e renderizações assíncronas antigas que podiam inserir cards após uma nova filtragem.
- Ausência de tratamento explícito da navegação além da última página e do foco no menu mobile.

## Pendências manuais

1. **Resolvido na auditoria de 24/09/2026:** o arquivo existente `horizonte-final.png.png` foi renomeado para `horizonte-final.png`, conforme o caminho usado pelo fallback. Nenhuma imagem nova foi gerada. Thumbnail protegida continua prioritária.
2. **Executar o upload real da nova capa de Horizonte Final pelo Studio.** Apenas colocar um arquivo local não substitui a thumbnail real, que continua prioritária.
3. Abrir o frontend pelo Live Server e conferir desktop, tablet e celular: enquadramento, tabelas, modais, sidebar, teclado, foco e movimento reduzido.
4. Validar interativamente login/logout e isolamento das seções por perfil; home, catálogo, detalhes e persistência de progresso/avaliação após nova navegação.
5. Validar criação/edição, vínculos/desvínculos, upload, transições de conteúdo/assinatura e conflitos 409 usando registros adequados para teste. Essas operações foram implementadas conforme o contrato, mas **não foram executadas contra o banco** nesta revisão.
6. Conferir a interação dos controles anterior/próxima com volume suficiente de registros. O retorno HTTP além do fim foi confirmado; o clique nos controles não foi testado no navegador.

## Auditoria posterior

Veja [AUDITORIA-FINAL.md](../AUDITORIA-FINAL.md). Em 24/09/2026 foram ajustados o registro de progresso sem duração conhecida e os avisos de falha de thumbnail (sem objeto de erro bruto). O diretório vazio e não referenciado assets/icons foi removido. A API key literal de js/config.js coincide com a configuração local; permanece como pendência de segurança, sem alteração de secrets nesta auditoria. O navegador integrado continuou indisponível; não há nova evidência visual.
