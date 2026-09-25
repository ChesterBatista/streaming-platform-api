# Testes do backend

Execute na raiz, após a instalação normal das dependências e geração do client Prisma:

```sh
npm test
npm run build
npx prisma validate
npm audit
```

No PowerShell com scripts bloqueados, use `npm.cmd` e `npx.cmd`. Validado com Node 24.18.0 e npm 11.16.0: **156 testes aprovados**, zero falhas/ignorados/cancelados, 17 suítes, build e schema válidos, audit com zero vulnerabilidades em 25/09/2026. Esta execução adicionou 14 casos: seis de IDs de categorias, um de subject JWT fora do intervalo, um de login/bcrypt e seis de multipart. Nenhuma dependência foi adicionada ou atualizada; Prisma e client continuam em 7.10.0.

## Estratégia e isolamento

- `node:test`, `node:assert/strict`, mocks nativos e o `ts-node/register` existente. Os arquivos `.cjs` ficam fora do build de produção; o TypeScript de produção importado pelos testes passa pelo ts-node.
- `backend.test.cjs` inicia um módulo Nest restrito aos controllers/serviços testados. Usa JWT/Passport, RolesGuard, ApiKeyGuard, DTOs, CurrentUser, pipes e serviços reais. Reproduz as opções do ValidationPipe de `main.ts`. Requisições usam `fetch`, localhost e porta efêmera; o servidor é fechado ao final.
- Não importa AppModule/PrismaModule, não carrega `.env`, não instancia PrismaClient e não abre conexão com PostgreSQL. O provider PrismaService é substituído por mocks; operações não configuradas falham. Fixtures e chamadas são reiniciadas entre testes. Nenhum seed, migration, reset ou db push é executado.
- JWT secret, API key e tokens são gerados exclusivamente para cada execução, em memória. Não são usadas credenciais reais. Casos de vigência usam relógio fixo, restaurado automaticamente pelo executor.
- `integrations.test.cjs` mantém testes unitários com HttpService simulado e acrescenta quatro casos com HttpService/Axios reais contra um mock HTTP em 127.0.0.1, porta efêmera: sucesso, 404, falha 500 e timeout. Servidor e conexões são fechados ao final. Não acessa um provedor na internet nem grava arquivos em `uploads`; escritas de arquivos continuam simuladas.

## Cobertura

| Arquivo | Casos | Verificações |
| --- | ---: | --- |
| `backend.test.cjs` | 123 | HTTP 400/401/403/404/409; JWT ausente/inválido/expirado e subject fora do intervalo; login/bcrypt; API key; RBAC; limites/nulabilidade/erros Prisma de Plans/Users; IDs de categorias; conteúdo DRAFT, publicação e estados; vínculos; assinaturas; progresso/ratings; identidade e paginação; seis cenários multipart com armazenamento simulado |
| `domain.test.cjs` | 18 | Predicado completo de acesso por plano associado e assinatura ACTIVE vigente; permissões de leitura administrativa; default DRAFT e constraints de unicidade no schema; datas de assinatura com relógio fixo; ciclo ACTIVE/INACTIVE/ACTIVE/CANCELLED; retries de conflitos Prisma |
| `integrations.test.cjs` | 15 | Metadados válidos, payload inválido, timeout, ausência e falha do provedor/configuração; quatro casos adicionais de HTTP real local; PNG válido, ausência, tamanho, extensão e assinatura binária inválidos |
| `helpers.cjs` | — | Mocks estritos, inspeção de chamadas e erros Prisma sintéticos |

## Limitações deliberadas

São testes HTTP de componentes e testes unitários, não E2E contra PostgreSQL. O sucesso de acesso usa resposta simulada do Prisma e é complementado pela verificação exata do predicado: status PUBLISHED, relação com o plano, assinatura ACTIVE do usuário, startsAt <= agora, expiresAt nulo ou > agora e usuário/plano ACTIVE. Isso detecta remoção dessas restrições, mas não executa a consulta SQL real.

A criação DRAFT depende do default do schema: o teste HTTP verifica que a aplicação delega a esse default e rejeita status no body; outro teste lê o schema real e verifica `@default(DRAFT)`. Não se afirma que o default foi executado em um banco.

Upserts repetidos são verificados por chamadas com a mesma chave composta e por armazenamento simulado, junto da constraint `@@unique([userId, contentId])` no schema. Unicidade persistida, isolamento Serializable, rollback e concorrência real exigem um PostgreSQL de teste dedicado e não são comprovados por mocks. Os retries são testados com erros sintéticos.

Ficam fora desta suíte: CRUD integral de todas as entidades, leitura de arquivos por HTTP, provedor na internet, bootstrap completo do AppModule, Helmet, Compression e logs. Login verifica bcrypt e JWT reais com usuário simulado. Upload multipart exercita FileInterceptor, guards, validação binária e serviço reais; mkdir/writeFile são simulados por teste para não modificar uploads. Schema, migrations e seed não foram alterados para viabilizar testes.

O banco principal não foi resetado, destruído nem acessado pela suíte. `prisma validate` lê a configuração existente e valida o schema; não aplica mudanças ao banco. `npm audit` somente consulta o registro, sem executar `audit fix`.

Fora da suíte permanente, a auditoria de 25/09 executou um smoke do main.js compilado com conexão Prisma desabilitada, credenciais sintéticas e porta efêmera. Conferiu 39 operações Swagger, segurança combinada, schemas multipart/binário, Helmet, gzip e log de resposta 400 sem segredos. Isso não valida conectividade nem persistência PostgreSQL.
