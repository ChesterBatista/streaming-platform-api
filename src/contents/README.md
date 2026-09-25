# Contents

Implementação do recorte de conteúdo dos requisitos obrigatórios de
`AV-10-STREAMING.md`. As decisões abaixo concretizam os contratos e as regras
que o documento deixa a cargo da aplicação.

## Autenticação e permissões

Todas as rotas exigem `x-api-key` e `Authorization: Bearer <JWT>`.
O papel vem de `@CurrentUser()` e dos guards existentes, nunca do body.

| Operação | SUBSCRIBER | CONTENT_MANAGER | ADMIN |
| --- | --- | --- | --- |
| Ler conteúdo e seus relacionamentos | PUBLISHED com assinatura válida compatível | Todos os estados | Todos os estados |
| Criar, editar, alterar status e vínculos | Não | Sim | Sim |

Conteúdo não publicado é tratado como não encontrado (404) para assinantes,
inclusive nas consultas de relacionamentos. A listagem retorna apenas publicados
associados a planos cobertos por assinatura ACTIVE do usuário, já iniciada, ainda
não vencida e com plano ACTIVE. Sem assinatura válida, a listagem retorna 403;
com assinatura válida sem conteúdos correspondentes, retorna data vazio em `{data, meta}`. Conteúdo publicado
sem assinatura compatível retorna 403 no detalhe e nas consultas de relacionamentos.
A identidade vem de @CurrentUser(), sem confiar em userId/planId do cliente.
Consulte [Subscriptions](../subscriptions/README.md) para o contrato completo.

## Endpoints

`id`, `planId` e `categoryId` devem ser inteiros positivos de até 2147483647.
Todos passam por `ParseIntPipe` e validação de intervalo antes da consulta correspondente.

| Método | URL | Permissão | Body | Sucesso | Erros específicos |
| --- | --- | --- | --- | --- | --- |
| POST | `/contents` | Gestão | CreateContentDto | 201: conteúdo | 400, 409 |
| GET | `/contents` | Leitura | Nenhum; query page/limit | 200: data/meta | 400, 403 |
| GET | `/contents/:id` | Leitura | Nenhum | 200: conteúdo | 400, 403, 404 |
| PATCH | `/contents/:id` | Gestão | UpdateContentDto | 200: conteúdo | 400, 404, 409 |
| PATCH | `/contents/:id/status` | Gestão | `{"status":"PUBLISHED"}` | 200: conteúdo | 400, 404, 409 |
| GET | `/contents/:id/plans` | Leitura | Nenhum | 200: array de planos | 400, 403, 404 |
| POST | `/contents/:id/plans/:planId` | Gestão | Nenhum | 201: vínculo | 400, 404, 409 |
| DELETE | `/contents/:id/plans/:planId` | Gestão | Nenhum | 204: sem body | 400, 404, 409 |
| GET | `/contents/:id/categories` | Leitura | Nenhum | 200: array de categorias | 400, 403, 404 |
| POST | `/contents/:id/categories/:categoryId` | Gestão | Nenhum | 201: vínculo | 400, 404, 409 |
| DELETE | `/contents/:id/categories/:categoryId` | Gestão | Nenhum | 204: sem body | 400, 404, 409 |

Todas as rotas também podem retornar 401 por API Key/JWT ausente ou inválido
e 403 por perfil sem permissão. As respostas de erro seguem as exceções NestJS
existentes. As consultas de vínculos retornam `[]` quando o conteúdo visível não
tem associações. POST de vínculo retorna os dois IDs e `createdAt`.

## Criação e edição

Exemplo de POST `/contents`:

```json
{
  "title": "Exemplo de documentário",
  "type": "DOCUMENTARY",
  "synopsis": "Uma sinopse.",
  "releaseYear": 2026,
  "durationMinutes": 90,
  "externalId": "documentario-001"
}
```

- `title`: obrigatório na criação, string não vazia após trim, até 180 caracteres.
- `type`: obrigatório na criação; MOVIE, SERIES, DOCUMENTARY ou OTHER.
- `synopsis`: string opcional, aceita null.
- `releaseYear`: inteiro opcional entre 1800 e o ano UTC de inicialização da
  aplicação mais 5, inclusive; aceita null. A margem permite lançamentos futuros
  próximos sem aceitar números arbitrariamente altos.
- `durationMinutes`: inteiro opcional entre 1 e 2147483647; aceita null.
- `externalId`: string opcional de até 120 caracteres; aceita null; duplicidade
  não nula retorna 409. Não é normalizado silenciosamente.

PATCH aceita os mesmos campos, todos opcionais. Campos omitidos são preservados;
null limpa somente campos anuláveis. PATCH vazio é permitido. `id`, `status`,
`createdAt`, `updatedAt`, `role`, `userId` e propriedades desconhecidas não são
aceitos nos DTOs gerais. `thumbnailUrl` é retornado nas leituras, mas sua escrita
é realizada por `POST /contents/:id/thumbnail`; enviá-lo em POST/PATCH geral retorna 400.
O upload retorna a referência da imagem, cuja leitura exige autenticação e acesso
ao conteúdo. Consulte [integrações obrigatórias](../docs/required-integrations.md).

## Estados e dependência de plano

Todo conteúdo nasce em DRAFT. Transições permitidas:

- DRAFT → PUBLISHED: exige ao menos um plano associado.
- DRAFT → ARCHIVED: permite abandonar um rascunho.
- PUBLISHED → ARCHIVED: retira o conteúdo do catálogo de assinantes.
- ARCHIVED → DRAFT: permite preparar uma nova publicação.

Repetir o estado atual ou solicitar qualquer outra transição retorna 409.
ARCHIVED não volta diretamente a PUBLISHED: deve passar por DRAFT e pela
verificação de planos. O endpoint de status aceita somente a propriedade status.

Rascunhos e arquivados podem existir sem plano. Publicados devem manter ao menos
um vínculo; tentar remover o último retorna 409. A publicação não exige plano ACTIVE,
mas a autorização do assinante exige plano ACTIVE e assinatura válida compatível.
Nenhuma categoria é obrigatória para publicar.

## Relacionamentos e consistência

PlanContent e ContentCategory representam relações N:N. A API verifica ambas as
entidades antes de escrever e usa as chaves compostas existentes para impedir
duplicidades (409). Recurso ou vínculo a remover inexistente retorna 404.
Remover vínculo não remove Content, Plan ou Category.

Alterações de status e vínculos usam transações Serializable, com até três
tentativas em conflitos de concorrência. Isso protege a verificação de planos
na publicação e na remoção simultânea dos últimos vínculos. Conflito persistente
retorna 409 com orientação para repetir. A garantia cobre as operações deste
módulo; uma futura exclusão de Plan deve preservar a mesma regra, pois o schema
configura cascade em PlanContent.

## Pendências fora deste recorte

WatchHistory e Ratings agora reutilizam a autorização de Subscriptions. Veja
[WatchHistory](../watch-history/README.md) e [Ratings](../ratings/README.md).

Upload de thumbnail, HttpService, Interceptor, Helmet e Compression estão
implementados e documentados em [integrações obrigatórias](../docs/required-integrations.md).
A configuração do provedor/mock depende do ambiente. Instalação, frontend e endpoints estão no [README geral](../../README.md); o estado de entrega está em [AUDITORIA-FINAL.md](../../AUDITORIA-FINAL.md).

GET /contents tem paginação: padrões page=1/limit=10, limit máximo 100, `{data, meta}` e página além do fim com data vazio. Não há filtros genéricos na API. A suíte cobre criação, estados, vínculos e autorização com Prisma simulado; veja [test/README.md](../../test/README.md). Não equivale a teste de concorrência PostgreSQL real.
