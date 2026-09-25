# WatchHistory

Recurso pessoal do SUBSCRIBER, conforme `AV-10-STREAMING.md`. Todas as rotas
exigem x-api-key, JWT, JwtAuthGuard e RolesGuard. CONTENT_MANAGER e ADMIN
recebem 403; não há operações em nome de terceiros.

## Endpoints

| Método | URL | Body | Sucesso | Erros |
| --- | --- | --- | --- | --- |
| PUT | `/watch-history/:contentId` | progressSeconds e completed | 200: registro criado ou atualizado | 400, 401, 403, 404, 409 |
| GET | `/watch-history/me` | Nenhum; query page/limit | 200: data/meta pessoais | 400, 401, 403 |
| GET | `/watch-history/me/:contentId` | Nenhum | 200: registro pessoal | 400, 401, 403, 404 |

Exemplo de PUT `/watch-history/1`:

```json
{ "progressSeconds": 120, "completed": false }
```

O PUT define integralmente progresso e conclusão, ambos obrigatórios. Retorna 200
inclusive na primeira gravação para manter um contrato único de upsert.
Repetir a requisição mantém o mesmo registro, progresso e conclusão; os timestamps
do servidor refletem a última gravação. Não cria eventos ou incrementa progresso.
O usuário pode retroceder a posição. Nenhuma conclusão é inferida pela duração.

## Schema e validação

WatchHistory contém id, userId, contentId, progressSeconds, completed,
lastWatchedAt, createdAt e updatedAt.

- id: Int autoincrementado; userId/contentId: Int obrigatórios.
- progressSeconds: Int, padrão 0, unidade segundos; DTO aceita de 0 a 2147483647.
- completed: Boolean, padrão false; DTO exige booleano explícito, não aceita null.
- lastWatchedAt: DateTime, padrão now(); atualizado exclusivamente no servidor.
- createdAt: DateTime com padrão now(); updatedAt: DateTime com @updatedAt.
- Relações N:1 com User e Content, ambas com onDelete Cascade.
- Unicidade `(userId, contentId)`; índices em userId e contentId; tabela watch_history.

contentId usa ParseIntPipe e deve ser inteiro positivo até 2147483647.
Quando durationMinutes não é nula, progressSeconds não pode ultrapassar
`durationMinutes * 60`; excesso retorna 400. Sem duração, aplica-se apenas o
intervalo técnico do campo. Dados legados com duração negativa precisam ser
corrigidos por um fluxo autorizado; este módulo não os altera silenciosamente.

userId vem somente de @CurrentUser(). Não há parâmetro de usuário na rota.
GET /watch-history/me aceita somente page/limit (padrões 1/10, limit máximo 100); as demais rotas rejeitam query, inclusive userId/role. GET rejeita
body preenchido; PUT usa o ValidationPipe global para rejeitar campos desconhecidos,
inclusive userId, role, contentId, id e timestamps.

## Acesso, consultas pessoais e consistência

Antes do upsert, SubscriptionAccessService.requireAccessibleContent reutiliza
contentWhere: conteúdo PUBLISHED, assinatura ACTIVE do usuário, vigência válida,
plano ACTIVE e vínculo PlanContent compatível. A checagem e a escrita usam a mesma
transação Serializable, com até três tentativas para concorrência. Não existe
uma segunda implementação das regras de assinatura.

Conteúdo inexistente, DRAFT ou ARCHIVED retorna 404, preservando a ocultação de
Contents. Conteúdo publicado sem acesso retorna 403. A chave de upsert é sempre
userId_contentId, formada com a identidade autenticada. Uma segunda gravação
atualiza o registro existente. P2002/P2034 provocam repetição limitada; somente
conflito persistente retorna 409. P2003/P2025 retornam 404.

GET retorna apenas campos escalares do histórico do próprio usuário, sem incluir
Content ou User. O usuário pode consultar seus registros anteriores mesmo após a
assinatura vencer ou o conteúdo ser arquivado; isso não concede acesso ao conteúdo
nem permite nova gravação. Um ID de conteúdo com histórico apenas de outro usuário
retorna 404. Listagem ordenada por lastWatchedAt e id decrescentes.

Não há remoção, reset dedicado, administração ou filtros adicionais. A listagem
pessoal tem paginação e retorna `{data, meta}`, inclusive data vazio além do fim. O registro é um progresso por usuário/conteúdo, não
uma coleção de eventos de reprodução.

## Verificação e limites

Os testes atuais cobrem autorização, progresso, limite de duração, identidade e upsert com Prisma simulado. Veja [test/README.md](../../test/README.md). Não comprovam concorrência ou persistência PostgreSQL real. Os demais requisitos globais são avaliados em [AUDITORIA-FINAL.md](../../AUDITORIA-FINAL.md).
