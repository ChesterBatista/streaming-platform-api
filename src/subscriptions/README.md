# Subscriptions

Implementação dos requisitos obrigatórios de `AV-10-STREAMING.md`, em especial
"assinatura inativa bloqueia" e "conteúdo depende do plano". O documento não
define uma assinatura única por usuário nem um fluxo exato de estados; as
decisões de contrato deste módulo estão descritas abaixo.

## Modelo e cardinalidade

O modelo Subscription contém:

- `id`: Int, chave primária autoincrementada.
- `userId` e `planId`: Int obrigatórios, relações com User e Plan, onDelete Restrict.
- `status`: SubscriptionStatus, padrão ACTIVE.
- `startsAt`: DateTime obrigatório, padrão now().
- `expiresAt`: DateTime opcional.
- `createdAt`: DateTime com padrão now(); `updatedAt`: DateTime com @updatedAt.

SubscriptionStatus: ACTIVE, INACTIVE, CANCELLED e EXPIRED.
PlanStatus e UserStatus: ACTIVE e INACTIVE.
User e Plan têm relações 1:N com Subscription. Existem índices em userId,
planId e status; não existe restrição única em userId ou no par userId/planId.
Content pertence a planos pela relação N:N PlanContent.

## Autenticação, endpoints e permissões

Todas as rotas exigem `x-api-key` e `Authorization: Bearer <JWT>`.
Os guards, a estratégia JWT e `@CurrentUser()` existentes são reutilizados.

| Método | URL | Perfil | Body | Sucesso | Erros específicos |
| --- | --- | --- | --- | --- | --- |
| POST | `/subscriptions` | ADMIN | userId, planId, expiresAt opcional | 201: assinatura | 400, 404, 409 |
| GET | `/subscriptions/me` | SUBSCRIBER | Nenhum | 200: array das próprias assinaturas | 400, 404 |
| GET | `/subscriptions/:id` | ADMIN | Nenhum | 200: assinatura | 400, 404 |
| GET | `/subscriptions` | ADMIN | Nenhum; query page/limit | 200: data/meta | 400 |
| PATCH | `/subscriptions/:id/status` | ADMIN | status | 200: assinatura | 400, 404, 409 |

Todas também podem retornar 401 por credenciais ausentes/inválidas e 403 por
papel sem permissão. CONTENT_MANAGER não tem acesso a nenhuma rota de
Subscriptions. SUBSCRIBER não pode escrever nem consultar por ID, mesmo uma
assinatura própria. ADMIN usa as rotas administrativas, não `/me`.

`/me` usa exclusivamente o ID autenticado. Parâmetros de query ou body preenchido
são rejeitados com 400, inclusive userId, planId ou role. Retorna todos os registros
do usuário, em qualquer estado, ordenados por createdAt e id decrescentes.
O retorno pessoal é uma coleção porque o schema permite planos distintos e histórico de
assinaturas. Sem registros, retorna 404. A listagem administrativa retorna `{data, meta}`,
com page=1/limit=10 por padrão e limit máximo 100; data é vazio sem registros ou além do fim.
Não há filtros adicionais nem endpoint administrativo por usuário.

As respostas contêm somente os campos escalares de Subscription; não incluem
User, senha ou dados de outros assinantes nas rotas pessoais.

## Criação e conflitos

Exemplo de POST:

```json
{
  "userId": 10,
  "planId": 2,
  "expiresAt": null
}
```

- IDs devem ser inteiros positivos até 2147483647; IDs de rota usam ParseIntPipe.
- Usuário e plano devem existir (404) e estar ACTIVE (409 se inativos).
- `userId` identifica o beneficiário definido pelo ADMIN, nunca a identidade do
  operador. A autorização do operador vem exclusivamente do JWT.
- Estado inicial ACTIVE e startsAt igual ao instante de criação, definidos pelo servidor.
- expiresAt aceita null ou omissão (sem expiração), ou string ISO 8601 estrita
  com data, horário com segundos e fuso, como `2030-01-01T00:00:00Z`.
  Se informada, deve ser posterior ao início; caso contrário, 400.
- Não são aceitos status, startsAt, role, id, timestamps ou outros campos desconhecidos.
- É permitido assinar planos diferentes simultaneamente. Para o mesmo usuário e
  plano, um registro ACTIVE ou INACTIVE sem expiração transcorrida bloqueia nova
  criação/reativação (409), mesmo se ainda não tiver começado por dados externos.
  Uma assinatura suspensa deve ser reativada ou cancelada, não duplicada.
- CANCELLED, EXPIRED e registros cuja expiresAt já passou não impedem uma nova
  assinatura. O histórico permanece intacto.

Criação e mudanças de estado usam transações Serializable com até três tentativas
em P2034. A consulta de conflito e a escrita fazem parte da mesma transação.
P2002 retorna 409, P2003/P2025 retornam 404 e conflito concorrente persistente
retorna 409. Não foi criada unicidade no banco: esta garantia vale para escritas
através deste módulo; dados externos/legados não são corrigidos automaticamente.

## Fluxo de estados

Exemplo de PATCH `/subscriptions/1/status`:

```json
{ "status": "INACTIVE" }
```

| Origem | Destinos permitidos |
| --- | --- |
| ACTIVE | INACTIVE, CANCELLED, EXPIRED |
| INACTIVE | ACTIVE, CANCELLED, EXPIRED |
| CANCELLED | Nenhum: estado terminal |
| EXPIRED | Nenhum: estado terminal |

Repetição do estado atual e transições fora da tabela retornam 409.
EXPIRED só é permitido quando expiresAt existe e já foi atingida.
Após vencer, não é permitido transitar para ACTIVE ou INACTIVE; pode-se cancelar
ou registrar EXPIRED. Reativar exige startsAt já atingido, usuário/plano ativos e
ausência de outro registro conflitante. Uma renovação após encerramento cria um
novo registro. Datas existentes não são prorrogadas ou sobrescritas na mudança de
estado; updatedAt continua gerenciado pelo Prisma.

O simples passar do tempo já bloqueia acesso, sem depender de atualizar o status
persistido para EXPIRED. Leituras retornam o estado armazenado e as datas reais;
não há job de expiração nem escrita em GET. Pausar não congela a vigência.

## Integração com Contents

SubscriptionAccessService exporta a regra reutilizável de autorização por
assinatura. ContentsModule importa SubscriptionsModule; o controller de Contents
passa a identidade completa de `@CurrentUser()` ao service.

Para SUBSCRIBER, a consulta Prisma exige simultaneamente:

1. Content.status = PUBLISHED.
2. Um PlanContent ligando o conteúdo a um plano da assinatura do usuário autenticado.
3. Subscription.status = ACTIVE e startsAt <= instante da consulta.
4. expiresAt nula ou estritamente maior que esse instante.
5. Plan.status = ACTIVE e User.status = ACTIVE.

As condições de autorização estão no where que busca os dados, não apenas numa
checagem anterior. Nenhum planId fornecido pelo cliente concede acesso. O horário
do servidor é a referência para a vigência.

- `GET /contents`: sem assinatura válida, 403. Com assinatura válida, retorna
  somente publicados permitidos por ao menos um plano em `{data, meta}`; data pode ser vazio.
- `GET /contents/:id`: 404 para inexistente, DRAFT ou ARCHIVED; 403 para publicado
  sem assinatura válida compatível. Uma consulta adicional apenas classifica o
  erro, nunca retorna os dados que foram negados.
- `GET /contents/:id/plans` e `/categories`: aplicam a mesma autorização de
  conteúdo para impedir consulta indireta sem assinatura. Após autorizar, retornam
  os relacionamentos do conteúdo, preservando o contrato dessas rotas.
- CONTENT_MANAGER e ADMIN mantêm leitura de todos os estados sem assinatura.
- INACTIVE, CANCELLED, EXPIRED, prazo vencido, início futuro e plano inativo não
  concedem acesso. Uma outra assinatura válida compatível ainda pode concedê-lo.

Exigir plano ACTIVE é uma decisão de domínio documentada: um plano desativado não
deve conceder novos acessos. A regra foi aplicada na criação/reativação e na leitura;
o contrato de publicação de Contents e o módulo Plans permanecem preservados.
Reativar um plano volta a permitir acesso se a assinatura continuar válida.

## Limites e pendências

Não houve alteração de schema, migrations, autenticação, API Key, Users, Plans ou
Categories. Não há endpoint de cobrança, alteração de vigência, renovação automática
ou job de expiração nesta etapa.

WatchHistory e Ratings reutilizam requireAccessibleContent nas gravações pessoais
e na agregação de notas. O método aceita uma transação Prisma para manter a
autorização e a operação no mesmo contexto; reutiliza contentWhere e o tratamento
404/403 existente. Os métodos usados por Contents preservam seus contratos.
A unicidade de avaliação é atendida pelo upsert e pela constraint userId/contentId.
Consulte [WatchHistory](../watch-history/README.md) e [Ratings](../ratings/README.md).
Upload, HttpService, Interceptor e demais entregáveis globais permanecem fora deste
recorte. Nenhum desses módulos foi implementado aqui.

Há testes HTTP de componentes e unitários em [test/README.md](../../test/README.md), com Prisma simulado e relógio fixo nos limites de vigência. Não há prova de concorrência PostgreSQL real. A auditoria final separa essas evidências das consultas de leitura realizadas na API local.
