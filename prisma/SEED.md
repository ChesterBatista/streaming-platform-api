# Seed de demonstração

Execute na raiz, com as dependências e o client Prisma existentes e o banco já
preparado pelo projeto. Usa DATABASE_URL do ambiente/.env, sem alterar esse arquivo.

```sh
npm run seed
```

O comando executa `ts-node prisma/seed.ts`. O hook `migrations.seed` de
`prisma.config.ts` também aponta para esse comando. Não executa migrations,
reset, db push, upload ou chamadas externas. Prisma permanece na versão instalada
7.10.0; nenhuma dependência foi alterada.

## Credenciais fictícias

| E-mail | Papel |
| --- | --- |
| subscriber.demo@streaming.local | SUBSCRIBER |
| manager.demo@streaming.local | CONTENT_MANAGER |
| admin.demo@streaming.local | ADMIN |

Senha de demonstração para os três: `DemoStreaming@123`.
Todos são ACTIVE. Cada senha nova recebe um salt próprio e hash bcrypt com custo
12, igual ao UsersService. Não há utilitário separado de hash no projeto.
O seed verifica bcrypt.compare e o custo, sem imprimir senhas ou hashes.
Essas contas são exclusivamente demonstrativas, incluindo o administrador.

## Dados

Planos ACTIVE: `[DEMO] Plano Essencial` (19,90) e `[DEMO] Plano Premium` (39,90).
Categorias: `[DEMO] Ficção Científica`, `[DEMO] Ação`, `[DEMO] Drama`.

| Conteúdo (todos com prefixo [DEMO]) | externalId | Tipo | Status | Ano | Minutos | Planos | Categorias |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Órbita Azul | demo-orbita-azul | MOVIE | PUBLISHED | 2024 | 100 | Essencial, Premium | Ficção Científica, Ação |
| Caminhos do Vale | demo-caminhos-do-vale | SERIES | PUBLISHED | 2025 | 45 | Essencial, Premium | Drama |
| Memórias do Futuro | demo-memorias-do-futuro | DOCUMENTARY | PUBLISHED | 2025 | 80 | Premium | Ficção Científica, Drama |
| Projeto Aurora | demo-projeto-aurora | MOVIE | DRAFT | 2026 | 95 | Premium | Ação |
| O Último Farol | demo-ultimo-farol | MOVIE | ARCHIVED | 2023 | 90 | Essencial | Drama |

Todos têm sinopse fictícia. Novos conteúdos têm thumbnailUrl null; não há arquivos
ou URLs de upload inventados. Uma thumbnail real adicionada posteriormente é preservada.
Os externalIds são identificadores fictícios locais, sem promessa de resposta de um provedor externo.

O assinante tem uma assinatura ACTIVE no Essencial, iniciada na primeira execução,
sem expiração. Acessa Órbita Azul e Caminhos do Vale. Memórias do Futuro permanece
restrito ao Premium; DRAFT e ARCHIVED não aparecem para o assinante.

Órbita Azul tem um WatchHistory do assinante com 1.200 segundos, completed false,
lastWatchedAt da primeira execução, e uma Rating ativa com score 4 e comentário
“Ótimo conteúdo para demonstração.”. Alterações manuais válidas nesses dois
registros são preservadas na reaplicação.

## Idempotência e preservação

Usuários são localizados por e-mail; planos/categorias por nome; conteúdos por
externalId. Vínculos, histórico e avaliação usam as chaves compostas do schema.
Upserts têm update vazio: não sobrescrevem registros existentes. O seed não apaga
dados nem redefine senhas, estados, progresso ou timestamps.

Subscription não tem chave única por usuário/plano. O seed consulta o par demo
antes de criar, dentro de uma transação Serializable que contém toda a operação.
Conflitos concorrentes abortam a transação; o comando pode ser reaplicado.
Não são utilizados IDs fixos.

Registros encontrados com campos incompatíveis, assinatura sem vigência ativa,
duplicação de assinatura, avaliação inválida/inativa ou distribuição de acesso
divergente fazem a execução falhar e desfazer suas inserções. O seed não corrige
alterações manuais silenciosamente. A conferência de quantidades considera apenas
as chaves demo declaradas; registros externos a esse conjunto não são removidos.

Cada execução confere papéis, estado ativo dos usuários/planos, hashes, campos dos
conteúdos, vínculos, assinatura vigente, acesso efetivo aos dois publicados do
Essencial, limites de progresso, data do histórico e avaliação inteira de 1 a 5.
Imprime as contagens antes/depois e a diferença criada, sem dados sensíveis.

## Validação realizada

`npm run build`: exit 0, saída:

```text
> streaming-platform-api@1.0.0 build
> nest build
```

`npx prisma validate`: exit 0, saída:

```text
◇ injected env (5) from .env
Loaded Prisma config from prisma.config.ts.

Prisma schema loaded from prisma\schema.prisma.
The schema at prisma\schema.prisma is valid 🚀
```

As duas execuções de `npm run seed` terminaram com exit 0 e a mensagem:

```text
Seed DEMO concluído. Papéis, bcrypt (12), vínculos, acesso, vigência, histórico e avaliação verificados.
```

| Registros DEMO | Antes | Após primeira execução | Após segunda execução |
| --- | --- | --- | --- |
| Users | 0 | 3 | 3 |
| Plans | 0 | 2 | 2 |
| Categories | 0 | 3 | 3 |
| Contents | 0 | 5 | 5 |
| PlanContent | 0 | 7 | 7 |
| ContentCategory | 0 | 7 | 7 |
| Subscription | 0 | 1 | 1 |
| WatchHistory | 0 | 1 | 1 |
| Rating | 0 | 1 | 1 |

A segunda execução criou zero registros em todas as categorias acima.
Não foram executados testes HTTP; estas verificações são do seed e dos dados.

Arquivos criados: prisma/seed.ts e prisma/SEED.md. Alterados: package.json e
prisma.config.ts. Schema, migrations, services, controllers, guards, autenticação,
Swagger, .env e README geral não foram alterados nesta tarefa.

As evidências acima pertencem à implementação original do seed. Na auditoria de 24/09/2026 ele foi analisado estaticamente e não reexecutado: upserts de vínculos poderiam restaurar associações demo removidas de propósito. A documentação de Ratings está alinhada à escala 1–5. Consulte AUDITORIA-FINAL.md na raiz para os limites da verificação atual.
