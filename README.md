# Streaming Platform API

API backend para gestão de uma plataforma de streaming, desenvolvida conforme os requisitos de [AV-10-STREAMING.md](AV-10-STREAMING.md). O acesso ao catálogo combina publicação do conteúdo, vínculo com planos e vigência da assinatura do usuário.

## 1. Visão geral

- Autenticação JWT, API Key global e autorização por perfil (RBAC).
- Gestão de usuários, planos, categorias, conteúdos e assinaturas.
- Histórico pessoal de reprodução e avaliações de 1 a 5.
- Upload e leitura protegida de thumbnails.
- Consulta de metadados externos via HttpService, com provedor configurável.
- Paginação, Swagger/OpenAPI e seed de demonstração idempotente.
- PostgreSQL com Prisma, validação de entradas, Helmet, Compression e interceptor de logs HTTP.

O projeto entrega a API e um frontend estático em `frontend/`; não inclui player nem hospedagem de vídeos. O veredito e as pendências da revisão de entrega estão em [AUDITORIA-FINAL.md](AUDITORIA-FINAL.md).

## 2. Stack tecnológica

| Tecnologia | Uso |
| --- | --- |
| NestJS 12 e TypeScript | Módulos, controllers, services e injeção de dependências |
| PostgreSQL e Prisma 7.10.0 | Persistência, migrations e client gerado |
| @prisma/adapter-pg e pg | Driver adapter PostgreSQL |
| Passport, passport-jwt e @nestjs/jwt | Autenticação JWT |
| class-validator e class-transformer | Validação e transformação de entradas |
| @nestjs/swagger | Documentação OpenAPI e interface Swagger |
| Multer / FileInterceptor | Recebimento de uploads |
| @nestjs/axios, Axios e RxJS | Integração HTTP externa |
| bcrypt | Hash de senhas com custo 12 |
| Helmet e Compression | Cabeçalhos de segurança e compressão HTTP |
| @nestjs/config e dotenv | Configuração por ambiente |

## 3. Requisitos

- Node.js compatível com `^20.19 || ^22.12 || >=24.0` (requisito declarado pelo Prisma instalado) e npm. Esta auditoria executou os comandos com **Node 24.18.0 e npm 11.16.0**; não há versão fixada em `engines`.
- PostgreSQL acessível, com banco e usuário configurados. O projeto não fixa uma versão do servidor PostgreSQL.
- Git para clonar o repositório.

Não há versão de npm fixada no projeto.

## 4. Instalação

Substitua o placeholder pela URL do repositório:

```sh
git clone <URL_DO_REPOSITORIO>
cd streaming-platform-api
npm install
```

Copie o arquivo de exemplo:

```sh
cp .env.example .env
```

No PowerShell:

```powershell
Copy-Item .env.example .env
```

Edite `.env` antes de preparar o banco e iniciar a aplicação. Se o PowerShell bloquear os scripts `npm.ps1`/`npx.ps1`, use `npm.cmd`/`npx.cmd` ou execute os comandos pelo Prompt de Comando.

## 5. Variáveis de ambiente

Os exemplos abaixo são fictícios. Substitua os placeholders; não reutilize valores de demonstração como segredos.

| Variável | Obrigatória | Descrição | Exemplo seguro |
| --- | --- | --- | --- |
| `DATABASE_URL` | Sim | Conexão PostgreSQL usada pelo Prisma e pela aplicação | `postgresql://USER:PASSWORD@localhost:5432/streaming_platform?schema=public` |
| `JWT_SECRET` | Sim | Segredo JWT com pelo menos 32 bytes | `<SEGREDO_ALEATORIO_COM_PELO_MENOS_32_BYTES>` |
| `JWT_EXPIRES_IN` | Sim | Prazo de validade dos tokens | `1h` |
| `API_KEY` | Sim | Chave exigida no header `x-api-key`, com pelo menos 32 bytes | `<CHAVE_ALEATORIA_COM_PELO_MENOS_32_BYTES>` |
| `PORT` | Não | Porta TCP de 1 a 65535; padrão 3000 | `3000` |
| `MEDIA_METADATA_BASE_URL` | Não | Base HTTP(S) do provedor/mock; vazia desabilita a consulta | `http://localhost:4000/media/` |
| `MEDIA_METADATA_TIMEOUT_MS` | Não | Timeout de 1 a 30000 ms; padrão 5000 | `5000` |

A URL de metadados não aceita credenciais, query ou fragmento. Para usar o mock incluído, configure `http://127.0.0.1:3100/` conforme a seção 14. Substitua os placeholders de `.env.example`. Use `JWT_EXPIRES_IN="1h"`; valores arbitrários não são validados integralmente no bootstrap e podem impedir a emissão de tokens.

Gere valores independentes para JWT_SECRET e API_KEY executando duas vezes `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`. Mantenha-os somente no ambiente local. Na demonstração com frontend estático, a API key enviada ao navegador é pública por definição; veja a seção 21.

## 6. Banco de dados e Prisma

Prepare um banco PostgreSQL e configure `DATABASE_URL`. Execute os comandos na raiz:

Por exemplo, conectado como administrador no `psql` (substitua a senha fictícia):

```sql
CREATE ROLE streaming_app LOGIN PASSWORD 'SUBSTITUA_POR_UMA_SENHA_LOCAL';
CREATE DATABASE streaming_platform OWNER streaming_app;
```

Nesse exemplo, use `postgresql://streaming_app:SENHA_LOCAL@localhost:5432/streaming_platform?schema=public`. Codifique caracteres reservados da senha na URL (por exemplo, `@` como `%40`). Não publique essa URL com credenciais reais. O serviço PostgreSQL deve estar iniciado. Então execute:

```sh
npx prisma validate
npx prisma generate
npx prisma migrate deploy
```

`migrate deploy` aplica as migrations existentes em `prisma/migrations`, incluindo a migration inicial. Não é um comando de reset. O usuário do banco precisa ter permissão para aplicar as alterações.

`prisma.config.ts` define schema, diretório de migrations, conexão e comando de seed. O generator `prisma-client` produz código em `src/generated/prisma`, ignorado pelo Git; por isso a geração é necessária após o clone e antes do build/seed. A aplicação usa o adapter PostgreSQL.

## 7. Seed de demonstração

Com o banco preparado e o client gerado:

```sh
npm run seed
```

**As credenciais abaixo são fictícias e exclusivas de desenvolvimento/demonstração.**

| E-mail | Perfil | Senha demo |
| --- | --- | --- |
| subscriber.demo@streaming.local | SUBSCRIBER | `DemoStreaming@123` |
| manager.demo@streaming.local | CONTENT_MANAGER | `DemoStreaming@123` |
| admin.demo@streaming.local | ADMIN | `DemoStreaming@123` |

O seed cria 3 usuários ativos, 2 planos ativos, 3 categorias, 5 conteúdos, 7 vínculos Content–Plan, 7 vínculos Content–Category, 1 assinatura ativa, 1 WatchHistory e 1 Rating ativa com nota 4. As senhas são armazenadas com bcrypt, custo 12 e salt individual.

O assinante recebe o Plano Essencial, sem expiração: acessa **Órbita Azul** e **Caminhos do Vale**. **Memórias do Futuro** exige o Premium. Os outros dois conteúdos são DRAFT e ARCHIVED. Thumbnails começam como `null`.

O seed não depende de IDs fixos. Usa chaves naturais/compostas e transação Serializable; reaplicá-lo não duplica registros nem redefine dados existentes. Divergências incompatíveis em dados demo abortam a operação, sem corrigir alterações manuais silenciosamente. Consulte [prisma/SEED.md](prisma/SEED.md) para o conjunto completo e as verificações.

## 8. Execução

Desenvolvimento, com recompilação automática:

```sh
npm run start:dev
```

Build e execução de produção:

```sh
npm run build
npm run start:prod
```

O script de produção executa `node dist/src/main.js`. A API usa `http://localhost:3000` por padrão; ajuste a URL se alterar `PORT`. Execute a partir da raiz para manter o caminho de uploads esperado.

## 9. Swagger / OpenAPI

Acesse **http://localhost:3000/api** com a aplicação iniciada. A interface apresenta endpoints, entradas, respostas e permite executar requisições.

No botão **Authorize**, preencha:

- **API_KEY:** a chave configurada no ambiente, enviada em `x-api-key`.
- **JWT:** o valor de `accessToken` recebido no login; o esquema Bearer acrescenta o prefixo ao header.

Login e cadastro não exigem JWT, mas continuam sujeitos à API Key global, também anotada no Swagger. As demais rotas privadas exigem JWT e API Key.

## 10. Autenticação e autorização

1. Envie `POST /auth/login` com `email`, `password` e o header `x-api-key`.
2. Receba `accessToken` e os dados seguros do usuário.
3. Nas rotas privadas, envie `Authorization: Bearer <ACCESS_TOKEN>`.
4. Inclua também `x-api-key: <API_KEY>`.

Exemplo de body para o ambiente demo:

```json
{
  "email": "subscriber.demo@streaming.local",
  "password": "DemoStreaming@123"
}
```

O cadastro `POST /users` cria SUBSCRIBER ACTIVE; não permite escolher papel pelo body. A identidade e as permissões são obtidas do JWT e do usuário consultado no banco.

| Operação | SUBSCRIBER | CONTENT_MANAGER | ADMIN |
| --- | --- | --- | --- |
| Consultar o próprio usuário | Sim | Sim | Sim |
| Listar usuários | Não | Não | Sim |
| Ler planos e categorias | Sim | Sim | Sim |
| Criar/editar planos e status | Não | Não | Sim |
| Criar/editar categorias | Não | Sim | Sim |
| Ler conteúdos e thumbnails | Publicados com assinatura compatível | Todos os estados | Todos os estados |
| Gerir conteúdos, vínculos, status e thumbnails | Não | Sim | Sim |
| Consultar metadados externos | Não | Sim | Sim |
| Gerir assinaturas e consultar por ID | Não | Não | Sim |
| Consultar `/subscriptions/me` | Próprias | Não | Não |
| Histórico, avaliações pessoais e agregação de notas | Sim | Não | Não |

ADMIN não substitui o assinante nas rotas pessoais de histórico e avaliações.

## 11. Endpoints

Todos os endpoints de domínio abaixo exigem API Key. Exceto cadastro/login, exigem também JWT. **Gestão** significa CONTENT_MANAGER ou ADMIN; **leitura de conteúdo** segue a visibilidade descrita acima. Consulte o Swagger para DTOs e respostas detalhadas.

| Módulo | Método e rota | Permissão / finalidade |
| --- | --- | --- |
| Auth | `POST /auth/login` | Sem JWT; autenticar |
| Users | `POST /users` | Sem JWT; cadastrar assinante |
| Users | `GET /users/me` | Autenticado; próprios dados |
| Users | `GET /users` | ADMIN; listagem paginada |
| Plans | `GET /plans` | Autenticado; listagem paginada |
| Plans | `GET /plans/:id` | Autenticado; detalhe |
| Plans | `POST /plans` | ADMIN; criar |
| Plans | `PATCH /plans/:id` | ADMIN; editar |
| Plans | `PATCH /plans/:id/status` | ADMIN; ACTIVE/INACTIVE |
| Categories | `GET /categories` | Autenticado; listagem paginada |
| Categories | `GET /categories/:id` | Autenticado; detalhe |
| Categories | `POST /categories` | Gestão; criar |
| Categories | `PATCH /categories/:id` | Gestão; editar |
| Contents | `POST /contents` | Gestão; criar DRAFT |
| Contents | `GET /contents` | Leitura de conteúdo; paginação |
| Contents | `GET /contents/:id` | Leitura de conteúdo; detalhe |
| Contents | `PATCH /contents/:id` | Gestão; editar campos gerais |
| Contents | `PATCH /contents/:id/status` | Gestão; transição de estado |
| Contents | `GET /contents/:id/plans` | Leitura de conteúdo; planos vinculados |
| Contents | `POST /contents/:id/plans/:planId` | Gestão; vincular plano |
| Contents | `DELETE /contents/:id/plans/:planId` | Gestão; remover vínculo |
| Contents | `GET /contents/:id/categories` | Leitura de conteúdo; categorias vinculadas |
| Contents | `POST /contents/:id/categories/:categoryId` | Gestão; vincular categoria |
| Contents | `DELETE /contents/:id/categories/:categoryId` | Gestão; remover vínculo |
| Subscriptions | `POST /subscriptions` | ADMIN; criar assinatura |
| Subscriptions | `GET /subscriptions` | ADMIN; listagem paginada |
| Subscriptions | `GET /subscriptions/:id` | ADMIN; detalhe |
| Subscriptions | `PATCH /subscriptions/:id/status` | ADMIN; alterar estado |
| Subscriptions | `GET /subscriptions/me` | SUBSCRIBER; próprias assinaturas, sem paginação |
| WatchHistory | `PUT /watch-history/:contentId` | SUBSCRIBER; salvar próprio progresso |
| WatchHistory | `GET /watch-history/me` | SUBSCRIBER; listagem própria paginada |
| WatchHistory | `GET /watch-history/me/:contentId` | SUBSCRIBER; próprio progresso |
| Ratings | `PUT /ratings/:contentId` | SUBSCRIBER; criar/atualizar avaliação |
| Ratings | `GET /ratings/me` | SUBSCRIBER; listagem própria paginada |
| Ratings | `GET /ratings/me/:contentId` | SUBSCRIBER; própria avaliação |
| Ratings | `GET /ratings/content/:contentId` | SUBSCRIBER com acesso; média e quantidade de avaliações ativas |
| Uploads | `POST /contents/:id/thumbnail` | Gestão; enviar imagem |
| Uploads | `GET /uploads/thumbnails/:filename` | Leitura de conteúdo; obter imagem protegida |
| MediaMetadata | `GET /media-metadata/:externalId` | Gestão; consultar provedor/mock |

Erros principais: **400** entrada inválida; **401** credenciais ausentes/inválidas; **403** permissão/acesso negado; **404** recurso inexistente ou conteúdo oculto; **409** duplicidade, estado incompatível ou conflito de negócio/concorrência. Integrações também tratam falhas específicas descritas adiante.

### Entradas e respostas por operação

Todos os endpoints podem retornar 401 por API Key inválida; rotas privadas também por JWT inválido e 403 quando o papel/acesso não autoriza. GET não necessita body. `?page=1&limit=10` é aceito nas listagens paginadas indicadas. IDs devem ser inteiros entre 1 e 2147483647. As tabelas de permissão e de entrada/resposta se complementam para as 39 operações.

| Método/rota | Body esperado (exemplo/campos) | Sucesso | Outros erros principais |
| --- | --- | --- | --- |
| POST /auth/login | `{"email":"subscriber.demo@streaming.local","password":"DemoStreaming@123"}` | 200: accessToken e user seguro | 400, 401 |
| POST /users | `{"name":"Pessoa Demo","email":"pessoa@example.com","password":"SenhaDemo@123"}` | 201: usuário seguro | 400, 409 |
| GET /users/me | Nenhum | 200: usuário autenticado | 401 |
| GET /users | Nenhum; page/limit | 200: data/meta | 400 |
| GET /plans | Nenhum; page/limit | 200: data/meta | 400 |
| GET /plans/:id | Nenhum | 200: plano | 400, 404 |
| POST /plans | `{"name":"Plano Demo","price":19.90,"description":"Opcional"}`; nome até 100, preço 0–99999999.99, até 2 casas | 201: plano | 400, 409 |
| PATCH /plans/:id | name, price, description opcionais; somente description aceita null | 200: plano | 400, 404, 409 |
| PATCH /plans/:id/status | `{"status":"INACTIVE"}`; ACTIVE/INACTIVE | 200: plano | 400, 404 |
| GET /categories | Nenhum; page/limit | 200: data/meta | 400 |
| GET /categories/:id | Nenhum | 200: categoria | 400, 404 |
| POST /categories | `{"name":"Drama","description":"Opcional"}` | 201: categoria | 400, 409 |
| PATCH /categories/:id | name e description opcionais | 200: categoria | 400, 404, 409 |
| POST /contents | title e type obrigatórios; synopsis, releaseYear, durationMinutes, externalId opcionais | 201: conteúdo DRAFT | 400, 409 |
| GET /contents | Nenhum; page/limit | 200: data/meta | 400, 403 |
| GET /contents/:id | Nenhum | 200: conteúdo | 400, 403, 404 |
| PATCH /contents/:id | Campos da criação, todos opcionais; sem status/thumbnailUrl | 200: conteúdo | 400, 404, 409 |
| PATCH /contents/:id/status | `{"status":"PUBLISHED"}`; DRAFT/PUBLISHED/ARCHIVED | 200: conteúdo | 400, 404, 409 |
| GET /contents/:id/plans | Nenhum | 200: array de planos | 400, 403, 404 |
| POST /contents/:id/plans/:planId | Nenhum | 201: vínculo | 400, 404, 409 |
| DELETE /contents/:id/plans/:planId | Nenhum | 204, sem body | 400, 404, 409 |
| GET /contents/:id/categories | Nenhum | 200: array de categorias | 400, 403, 404 |
| POST /contents/:id/categories/:categoryId | Nenhum | 201: vínculo | 400, 404, 409 |
| DELETE /contents/:id/categories/:categoryId | Nenhum | 204, sem body | 400, 404, 409 |
| POST /subscriptions | `{"userId":1,"planId":1,"expiresAt":null}`; expiração opcional ISO 8601 com fuso | 201: assinatura ACTIVE | 400, 404, 409 |
| GET /subscriptions | Nenhum; page/limit | 200: data/meta | 400 |
| GET /subscriptions/:id | Nenhum | 200: assinatura | 400, 404 |
| PATCH /subscriptions/:id/status | `{"status":"INACTIVE"}`; ACTIVE/INACTIVE/CANCELLED/EXPIRED | 200: assinatura | 400, 404, 409 |
| GET /subscriptions/me | Nenhum, sem query | 200: array pessoal | 400, 404 |
| PUT /watch-history/:contentId | `{"progressSeconds":120,"completed":false}` | 200: registro pessoal | 400, 403, 404, 409 |
| GET /watch-history/me | Nenhum; page/limit | 200: data/meta pessoal | 400 |
| GET /watch-history/me/:contentId | Nenhum, sem query | 200: registro pessoal | 400, 404 |
| PUT /ratings/:contentId | `{"score":4,"comment":"Opcional"}`; score inteiro 1–5 | 200: avaliação pessoal | 400, 403, 404, 409 |
| GET /ratings/me | Nenhum; page/limit | 200: data/meta pessoal | 400 |
| GET /ratings/me/:contentId | Nenhum, sem query | 200: avaliação pessoal | 400, 404 |
| GET /ratings/content/:contentId | Nenhum, sem query | 200: average/count | 400, 403, 404, 409 |
| POST /contents/:id/thumbnail | multipart/form-data com arquivo `file` | 201: id/thumbnailUrl | 400, 404, 500 |
| GET /uploads/thumbnails/:filename | Nenhum, sem query | 200: image/png ou image/jpeg | 400, 403, 404, 500 |
| GET /media-metadata/:externalId | Nenhum, sem query | 200: metadados | 400, 404, 502, 503, 504 |

## 12. Paginação

Aplicada a `GET /users`, `/plans`, `/categories`, `/contents`, `/subscriptions`, `/watch-history/me` e `/ratings/me`.

```http
GET /contents?page=1&limit=10
```

- `page`: inteiro positivo, padrão 1; limitado ao intervalo inteiro seguro do JavaScript.
- `limit`: inteiro de 1 a 100, padrão 10.
- Parâmetros desconhecidos ou inválidos retornam 400.

Essas listagens retornam um objeto, **não um array puro**:

```json
{
  "data": [],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 0,
    "totalPages": 0
  }
}
```

`total` vem de `count()` com o mesmo filtro de identidade/acesso da consulta; `totalPages = ceil(total / limit)`. Coleção vazia tem totalPages 0. Página além do fim retorna data vazio, sem 404. A busca usa `skip = (page - 1) * limit` e `take = limit`; páginas além do total dispensam a busca dos itens.

As ordenações anteriores são mantidas, com ID como desempate. Histórico usa lastWatchedAt; avaliações usam updatedAt; as demais listagens usam createdAt, sempre em ordem decrescente. Count e busca são consultas separadas, sem garantia de snapshot único sob alterações concorrentes.

`/subscriptions/me` mantém array e 404 se não houver assinaturas; rejeita query/body preenchidos. Detalhes, relacionamentos e agregação não são paginados. Histórico e avaliações continuam rejeitando body preenchido e parâmetros de identidade nas consultas pessoais.

## 13. Upload de thumbnail

Envie `POST /contents/:id/thumbnail` como **multipart/form-data**, com um único campo de arquivo chamado **file**:

- JPEG (`.jpg`/`.jpeg`, `image/jpeg`) ou PNG (`.png`, `image/png`).
- Arquivo não vazio, até **5 MiB (5.242.880 bytes)**.
- MIME, extensão e assinatura binária devem ser compatíveis; campos extras são rejeitados.

O retorno contém `id` e `thumbnailUrl`. A escrita desse campo ocorre pelo upload; POST/PATCH gerais de Contents não aceitam thumbnailUrl.

Os arquivos ficam em `uploads/thumbnails`, relativo ao diretório de execução, com nomes UUID gerados pelo servidor. Uploads de runtime estão ignorados pelo Git. A leitura é feita por `GET /uploads/thumbnails/:filename`, com API Key, JWT e autorização sobre o conteúdo. Não é uma URL pública.

Arquivo ausente, vazio, inválido ou grande demais retorna 400. Falhas de armazenamento podem retornar 500. Substituições não removem arquivos antigos; não há limpeza automática de órfãos. Mais detalhes em [integrações obrigatórias](src/docs/required-integrations.md).

## 14. Metadados externos

`GET /media-metadata/:externalId` consulta `<MEDIA_METADATA_BASE_URL>/<externalId>` via HttpService. A base é normalizada com barra final. O identificador aceita de 1 a 120 letras ASCII, números, hífens ou underscores.

Configure um provedor compatível ou o mock local incluído em `test/manual-metadata-mock.cjs`. Resposta esperada, com apenas title obrigatório:

```json
{
  "title": "Conteúdo fictício",
  "synopsis": "Sinopse de demonstração",
  "type": "MOVIE",
  "releaseYear": 2026,
  "durationMinutes": 90
}
```

A API devolve campos normalizados e externalId, sem criar/editar conteúdos automaticamente. Redirecionamentos estão desativados e a resposta externa é limitada a 1 MiB.

| Situação | Resposta |
| --- | --- |
| Base ausente/vazia | 503 |
| Timeout configurado excedido | 504 |
| Recurso não encontrado pelo provedor | 404 |
| Falha de rede/provedor ou resposta inválida/excessiva | 502 |

### Demonstração com o mock local

1. Em outro terminal, na raiz, execute `node test/manual-metadata-mock.cjs`. Ele escuta somente em `127.0.0.1:3100` e atende `GET /filme-001`; outros caminhos retornam 404.
2. No `.env` da API, configure `MEDIA_METADATA_BASE_URL="http://127.0.0.1:3100/"` e `MEDIA_METADATA_TIMEOUT_MS=5000`; reinicie a API.
3. No Swagger, faça login como gestor ou administrador, autorize JWT e API_KEY e execute `GET /media-metadata/filme-001`: retorna o documentário fictício. Um identificador diferente demonstra 404.
4. Encerre o mock com Ctrl+C. Uma nova consulta demonstra falha controlada 502. Os testes automatizados demonstram também timeout 504.

O mock é uma ferramenta de demonstração mantida na entrega, sem dependências extras, escrita no banco ou importação automática de conteúdo.

## 15. Segurança e observabilidade

- Helmet adiciona cabeçalhos de segurança; Compression habilita compressão HTTP.
- API Key global, JWT e guards de papel controlam o acesso às rotas de domínio.
- Senhas são armazenadas com bcrypt; listagem de usuários usa projeção sem password/hash.
- ValidationPipe global usa `transform`, `whitelist` e `forbidNonWhitelisted`.
- Upload valida tamanho, extensão, MIME e assinatura binária. Downloads verificam vínculo, permissão, nome UUID e caminho, com cache `private, no-store`.
- O interceptor registra método, template da rota, status e duração; não registra headers, JWT, API Key, body, query ou valores reais dos parâmetros. Rejeições nos guards ocorrem antes do interceptor.

Na verificação de **25/09/2026**, `npm audit` retornou **0 vulnerabilidades** e exit 0. O package.json contém overrides transitivos para `deepmerge-ts: ^8.0.0` e `mysql2: ^3.23.1`. O resultado se refere à árvore e aos avisos consultados nessa execução. Nenhuma dependência foi atualizada e não foi executado `audit fix`.

## 16. Comandos úteis

| Comando | Finalidade |
| --- | --- |
| `npm install` | Instalar dependências |
| `npm run start:dev` | Iniciar com recompilação automática |
| `npm start` | Iniciar pelo Nest CLI |
| `npm run build` | Compilar o projeto |
| `npm run start:prod` | Executar o build de produção |
| `npm run seed` | Criar/verificar dados demo idempotentes |
| `npx prisma validate` | Validar o schema e a configuração Prisma |
| `npx prisma generate` | Gerar o Prisma Client |
| `npx prisma migrate deploy` | Aplicar migrations existentes |
| `npm audit` | Consultar vulnerabilidades das dependências |
| `npm test` | Executar a suíte isolada do PostgreSQL |

## 17. Estrutura do projeto

```text
src/
  auth/              # Login, JWT e autorização por papéis
  users/             # Cadastro e consultas seguras
  plans/             # Gestão dos planos
  categories/        # Gestão das categorias
  contents/          # Catálogo, estados e vínculos
  subscriptions/     # Assinaturas e autorização de acesso
  watch-history/     # Progresso pessoal de reprodução
  ratings/           # Avaliações pessoais e agregação
  uploads/           # Upload e leitura protegida
  media-metadata/    # Integração com provedor/mock
  common/            # Guards, decorators, pipes, interceptor e paginação
  config/            # Validação do ambiente
  prisma/            # Serviço de acesso ao banco
  generated/prisma/  # Client gerado, não versionado
  docs/              # Documentação complementar
  main.ts            # Bootstrap, middlewares e Swagger
prisma/
  migrations/        # Histórico de alterações do banco
  schema.prisma
  seed.ts
  SEED.md
uploads/thumbnails/  # Arquivos de runtime, criado no primeiro upload
prisma.config.ts
.env.example
```

## 18. Regras importantes do domínio

- Content nasce DRAFT. Transições: DRAFT → PUBLISHED ou ARCHIVED; PUBLISHED → ARCHIVED; ARCHIVED → DRAFT. Repetições/transições incompatíveis retornam 409.
- Publicar exige ao menos um plano vinculado. O último plano de um conteúdo publicado não pode ser removido. Associações duplicadas retornam 409.
- SUBSCRIBER acessa somente PUBLISHED com assinatura ACTIVE, já iniciada, não vencida e ligada a plano ACTIVE compatível; o usuário também precisa estar ACTIVE. Gestores/administradores leem todos os estados sem assinatura.
- Sem assinatura válida, a listagem de conteúdos retorna 403. Conteúdo publicado sem acesso retorna 403 no detalhe; conteúdo inexistente ou não publicado para o assinante retorna 404.
- Criar assinatura exige usuário/plano ativos. Outra assinatura ACTIVE ou INACTIVE não vencida do mesmo usuário/plano bloqueia duplicação. Planos distintos podem coexistir.
- Assinaturas: ACTIVE → INACTIVE, CANCELLED ou EXPIRED; INACTIVE → ACTIVE, CANCELLED ou EXPIRED. CANCELLED/EXPIRED são terminais. EXPIRED exige vencimento; reativação exige vigência, referências ativas e ausência de conflito. O prazo vencido já bloqueia acesso sem atualização automática de status.
- WatchHistory é único por usuário/conteúdo: progressSeconds inteiro não negativo, no máximo a duração em segundos quando conhecida, e completed explícito. lastWatchedAt é definido pelo servidor.
- Rating usa score inteiro de **1 a 5**. Há uma única linha por usuário/conteúdo; o PUT atualiza a existente e preserva isActive. Omissão/null no comentário limpa o campo. A agregação considera somente avaliações ativas e retorna `{ "average": null, "count": 0 }` quando não há nenhuma.
- Gravações pessoais exigem acesso ao conteúdo; consultar o próprio histórico/avaliações continua permitido após a assinatura vencer, sem conceder acesso ao conteúdo. userId vem da identidade autenticada.

Os READMEs dos módulos detalham os contratos atuais. Ratings aceita notas de 1 a 5; as listagens paginadas retornam data/meta. Relatórios datados de tarefas anteriores são evidências históricas, não novas execuções de testes.

## 19. Validações realizadas e limites

Verificações executadas nesta auditoria, em **25/09/2026**:

| Verificação | Evidência disponível |
| --- | --- |
| Build | `npm run build`: exit 0; entrada de produção `dist/src/main.js` existente |
| Prisma | `npx prisma generate` e `npx prisma validate`: exit 0; versão 7.10.0 |
| Testes | `npm test`: 156 aprovados, zero falhas/ignorados/cancelados |
| Frontend | `node --check`: nove JavaScripts aprovados; revisão estática dos contratos |
| Swagger e middlewares | Smoke do build sem conexão Prisma: 39 operações/29 paths, JWT + API key, multipart/imagem, Helmet, gzip e log de resposta 400 |
| Dependências | `npm audit`: exit 0, zero vulnerabilidades |
| Seed e migrations | Revisão estática; não executados no banco atual |
| Git | `git status --short` e `git ls-files` falham: esta cópia não contém `.git` |

Os testes usam o executor nativo do Node e ts-node, sem conexão com PostgreSQL. Cobrem sucesso, entradas inválidas, autenticação, RBAC, recursos pessoais, conflitos, estados, paginação, login com bcrypt e upload multipart. Veja [test/README.md](test/README.md).

Upload tem testes de serviço e multipart por HTTP, com filesystem e Prisma simulados. Metadados incluem HttpService real contra mock HTTP local. Persistência, isolamento/concorrência no PostgreSQL, instalação em máquina limpa, interface no navegador e provedor na internet não foram demonstrados nesta execução. Helmet, Compression e interceptor estão registrados no bootstrap, mas não têm testes próprios nesta suíte. A idempotência do seed foi conferida por leitura; não foi reexecutada no banco atual.

## 20. Observações de desenvolvimento

- `.env` e variantes (exceto `.env.example`), node_modules, dist, client gerado, uploads, logs, caches e backups comuns estão no `.gitignore`. Regras não removem arquivos já rastreados; confira o repositório real antes do commit.
- As contas demo, inclusive ADMIN, destinam-se somente ao desenvolvimento/demonstração.
- `MEDIA_METADATA_BASE_URL` é configurável e opcional; sua ausência não impede as demais funcionalidades.
- O seed não envia imagens nem consulta o provedor externo.
- A auditoria não adiciona Docker nem funcionalidades novas ao backend.

## 21. Executar o frontend estático

1. Prepare PostgreSQL, gere o client, aplique as migrations e execute o seed conforme as seções 6 e 7. Inicie a API na seção 8.
2. Confira `API_URL` e `API_KEY` em `frontend/js/config.js`. Para a demonstração local, copie o valor público de `API_KEY` desse arquivo para `API_KEY` no `.env` da API, ou defina uma nova chave de demonstração igual nos dois locais. Reinicie a API após editar o ambiente. **Essa chave é pública, exclusiva da demo e visível aos visitantes; nunca configure uma credencial de produção nesse JavaScript.** JWT_SECRET e DATABASE_URL ficam exclusivamente no backend; não copie `.env` para o frontend.
3. Abra `frontend/index.html` com Live Server na porta **5500**, usando `http://localhost:5500` ou `http://127.0.0.1:5500`. Também é possível servir somente `frontend/` com um servidor estático já disponível na porta **5173**. Essas quatro origens estão no CORS; não use `file://`.
4. Os botões demo preenchem as credenciais fictícias da seção 7. SUBSCRIBER abre `home.html`; CONTENT_MANAGER/ADMIN abrem `admin.html`. A página `content.html?id=<id>` é pessoal do assinante.
5. SweetAlert2, Font Awesome e fontes são carregados por CDN; a interface precisa de acesso à internet para esses recursos. Não há etapa de build/npm install separada para o frontend.

Pedro, Aline e Chester são somente nomes de apresentação das contas fictícias. O banco conserva os nomes do seed. O prefixo `[DEMO]` é removido visualmente, não dos registros persistidos. As capas em `frontend/assets/images/covers/` são assets estáticos; thumbnails de `uploads/` são runtime privado e não devem ser apagadas ao copiar a demonstração existente. Em instalação limpa, as capas demo locais funcionam sem transportar uploads; novos uploads devem ser enviados pelo Studio.

Não há requisito de player de vídeo. O botão de progresso registra a posição informada pelo usuário. Os filtros do catálogo/Studio atuam na página atual. Metadados externos são consumidos via API/Swagger, sem formulário dedicado no frontend. A configuração do provedor continua necessária para demonstrar essa integração; consultar sem configuração retorna 503.
