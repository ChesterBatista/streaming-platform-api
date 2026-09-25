# Ratings

Recurso pessoal do SUBSCRIBER, conforme `AV-10-STREAMING.md`. Todas as rotas
exigem x-api-key, JWT, JwtAuthGuard e RolesGuard. CONTENT_MANAGER e ADMIN
recebem 403, inclusive na agregação; não há operação em nome de outro usuário.

## Endpoints

| Método | URL | Body | Sucesso | Erros |
| --- | --- | --- | --- | --- |
| PUT | `/ratings/:contentId` | score e comment opcional | 200: avaliação criada ou atualizada | 400, 401, 403, 404, 409 |
| GET | `/ratings/me` | Nenhum; query page/limit | 200: data/meta pessoais | 400, 401, 403 |
| GET | `/ratings/me/:contentId` | Nenhum | 200: avaliação pessoal | 400, 401, 403, 404 |
| GET | `/ratings/content/:contentId` | Nenhum | 200: average e count | 400, 401, 403, 404, 409 |

Exemplo de PUT `/ratings/1`:

```json
{ "score": 4, "comment": "Gostei do conteúdo." }
```

O PUT substitui score/comment. score é obrigatório; omitir comment ou enviar null
limpa o comentário. Repetir a operação mantém o mesmo registro e valores, com
updatedAt gerenciado pelo Prisma. Retorna 200 também na criação.

## Schema e validação

Rating contém id, userId, contentId, score, comment, isActive, createdAt e updatedAt.

- id: Int autoincrementado; userId/contentId: Int obrigatórios.
- score: Int obrigatório; a aplicação adota escala de 1 a 5.
- comment: String opcional, VarChar(1000); aceita string de até 1000 caracteres ou null.
- isActive: Boolean com padrão true.
- createdAt: DateTime com padrão now(); updatedAt: DateTime com @updatedAt.
- Relações N:1 com User e Content, ambas com onDelete Cascade.
- Unicidade `(userId, contentId)`; índices em userId, contentId e isActive; tabela ratings.

**Escala de nota:** a implementação adota uma escala de 1 a 5.

O DTO exige valor inteiro com:

- mínimo: 1
- máximo: 5

Valores fora dessa faixa são rejeitados com 400 Bad Request.

contentId usa ParseIntPipe e deve ser inteiro positivo até 2147483647.
userId vem apenas de @CurrentUser(); não há parâmetro de usuário na rota. Somente
GET /ratings/me aceita query page/limit; as demais rejeitam query preenchida, inclusive userId/role. GET rejeita body
preenchido. Campos desconhecidos no PUT são rejeitados pelo ValidationPipe global,
inclusive userId, role, contentId, id, isActive e timestamps.

## Unicidade e acesso

A constraint existente é mais forte que "uma avaliação ativa por usuário/conteúdo":
permite apenas um registro por par, independentemente de isActive. O upsert usa
userId_contentId com a identidade autenticada; novas avaliações usam o padrão true,
e atualizações preservam isActive. Um registro legado inativo continua inativo;
nenhuma reativação/moderação foi inventada ou exposta nesta tarefa.

Gravações e agregação usam SubscriptionAccessService.requireAccessibleContent:
conteúdo PUBLISHED, assinatura ACTIVE do usuário, vigente, plano ACTIVE e vínculo
PlanContent compatível. A regra é a mesma de Contents. Conteúdo inexistente ou
não publicado retorna 404; publicado sem acesso retorna 403.

Autorização e upsert são executados na mesma transação Serializable. P2002/P2034
provocam até três tentativas; uma segunda gravação normal atualiza a existente,
sem 409 de duplicidade. Conflito persistente retorna 409 e P2003/P2025 retornam 404.

GET /me e /me/:contentId consultam somente os campos escalares das próprias
avaliações, inclusive inativas, sem incluir User ou Content. Permanecem disponíveis
mesmo sem assinatura vigente para permitir consulta dos próprios registros; não
liberam consumo de conteúdo. Avaliação existente apenas para outro usuário retorna
404. A listagem é ordenada por updatedAt e id decrescentes.

## Agregação por conteúdo

A consulta por relacionamento solicitada retorna somente a média de score e a
quantidade de avaliações com isActive=true. Não expõe comentários, IDs de usuários
ou dados privados. Não é uma rota pública: exige SUBSCRIBER com acesso ao conteúdo.
Não exige que o solicitante já tenha avaliado. A autorização e a agregação ocorrem
na mesma transação, usando um estado consistente.

Sem avaliações ativas, retorna:

```json
{ "average": null, "count": 0 }
```

A média considera a escala de notas de 1 a 5 e é calculada somente com avaliações ativas. Não há listagem pública de comentários, exclusão ou moderação.

## Verificação e limites

Há testes HTTP de componentes e unitários em [test/README.md](../../test/README.md), com Prisma simulado. GET /ratings/me retorna `{data, meta}`; page=1/limit=10 por padrão e limit máximo 100. Página além do fim retorna data vazio. Persistência e concorrência PostgreSQL não são comprovadas por essa suíte. Consulte a auditoria final para as verificações atuais dos demais módulos.
