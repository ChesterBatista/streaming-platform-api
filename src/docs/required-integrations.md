# Upload, metadados, observabilidade e middlewares

Implementação dos cinco requisitos obrigatórios de AV-10-STREAMING.md.
O documento exige upload de capa, consumo de metadados ou mock, interceptor útil,
Helmet e Compression. Não especifica formatos, limite de arquivo, provedor externo
ou contrato JSON. As escolhas abaixo são explícitas e não mudam as regras dos
módulos de domínio existentes.

## Endpoints e permissões

Todos exigem `x-api-key` e `Authorization: Bearer <JWT>`.

| Método | URL | Permissão | Entrada | Sucesso |
| --- | --- | --- | --- | --- |
| POST | `/contents/:id/thumbnail` | CONTENT_MANAGER, ADMIN | multipart/form-data, somente campo file | 201: `{ id, thumbnailUrl }` |
| GET | `/uploads/thumbnails/:filename` | Três perfis, respeitando acesso a Content | Nome gerado retornado na URL | 200: imagem |
| GET | `/media-metadata/:externalId` | CONTENT_MANAGER, ADMIN | Identificador externo | 200: metadados normalizados |

SUBSCRIBER não envia thumbnails nem consulta o provedor editorial de metadados.
Para ler a imagem, precisa de acesso ao conteúdo publicado via assinatura válida,
plano ativo e relação PlanContent, conforme SubscriptionAccessService. Gestores e
administradores podem ler thumbnails de todos os estados. Não há rota pública de
arquivos nem middleware estático que contorne os guards.

## Upload de thumbnail

Decisões de formato: JPEG (`image/jpeg`, .jpg/.jpeg) e PNG (`image/png`, .png),
de 1 byte a 5 MiB (5.242.880 bytes), incluindo o limite superior. Outros formatos
(inclusive SVG, GIF e WebP) não foram habilitados. O documento não fixa uma lista.

FileInterceptor/Multer recebe um arquivo em memória com limite aplicado durante
o recebimento. Campos extras, múltiplos arquivos e query preenchida são rejeitados.
O service verifica presença, tamanho, extensão, MIME declarado e tipo detectado
pelo FileTypeValidator nativo do Nest (assinatura binária, sem fallback para MIME).
Essa inspeção de tipo não é uma decodificação completa da imagem nem antivírus.

Exemplo manual, substituindo credenciais e IDs:

```sh
curl -X POST http://localhost:3000/contents/1/thumbnail \
  -H 'x-api-key: <API_KEY>' \
  -H 'Authorization: Bearer <JWT_CONTENT_MANAGER_OU_ADMIN>' \
  -F 'file=@capa.png;type=image/png'
```

Armazenamento em `<diretório de execução>/uploads/thumbnails`, criado na primeira
gravação. Execute a aplicação a partir da raiz do projeto. O nome é UUID v4 gerado
pelo servidor com extensão normalizada; o nome original não determina o caminho.
A escrita usa `wx`, impedindo sobrescrita de arquivo existente. O diretório de
runtime `/uploads/` está no .gitignore.

O banco recebe apenas `/uploads/thumbnails/<uuid>.png` ou `.jpg` no campo
Content.thumbnailUrl. POST/PATCH gerais de Contents continuam rejeitando esse
campo. Nenhuma imagem binária, coluna ou migration foi adicionada.

Download valida o formato exato do nome, exige vínculo atual com um conteúdo
autorizado, restringe a leitura ao diretório de thumbnails e rejeita links
simbólicos de arquivo. Não há listagem de diretório nem exposição da raiz.
Retorna MIME correto, Content-Disposition inline e Cache-Control private, no-store.
A URL requer os headers de autenticação; não funciona como imagem pública sem eles.

Erros: 400 para arquivo ausente/vazio, formato/MIME/extensão inválidos, tamanho
excedido ou entrada inválida; 401 credenciais; 403 perfil/acesso; 404 conteúdo,
thumbnail ou vínculo inexistente (inclui ocultação de conteúdo não publicado);
500 com mensagem genérica para falhas de armazenamento/persistência.
O filtro local converte o 413 de tamanho do Multer em 400, conforme solicitado.

### Consistência do armazenamento

Arquivo é gravado antes da referência no banco, para evitar referência a arquivo
que ainda não foi escrito. Disco e PostgreSQL não compartilham uma transação.
Substituir uma thumbnail não apaga a anterior; falhas após gravar podem deixar
arquivos órfãos. Esses arquivos não são servidos porque não têm vínculo atual.
Não há limpeza destrutiva nesta tarefa. Uploads simultâneos usam arquivos distintos;
a última atualização do banco define a referência corrente. Planeje limpeza
controlada e volume persistente antes de operar múltiplas instâncias.

## HttpService / metadados

Não foi escolhido um provedor externo arbitrário. O módulo aceita um provedor ou
mock configurado pelo operador com este contrato mínimo:

```dotenv
MEDIA_METADATA_BASE_URL="http://localhost:4000/media/"
MEDIA_METADATA_TIMEOUT_MS=5000
```

Esse endereço é apenas um exemplo; não há provedor persistente iniciado pela aplicação.
Os testes iniciam seu próprio mock HTTP temporário em porta efêmera, isolado da configuração de demonstração.
Base vazia/ausente mantém o restante da aplicação funcionando e retorna 503 somente
na consulta de metadados. A URL deve ser HTTP(S), sem credenciais, query ou fragmento.
O timeout aceita de 1 a 30000 ms. Configuração inválida falha com mensagem sem
reproduzir valores sensíveis. .env.example foi atualizado; .env não foi alterado.

GET `/media-metadata/filme-001` faz, sob demanda, GET
`<MEDIA_METADATA_BASE_URL>/filme-001` usando HttpService de @nestjs/axios.
externalId permite de 1 a 120 letras ASCII, números, hífens e underscores.
O cliente não fornece URL, hostname, headers de autenticação ou caminho de destino.
Redirecionamentos são desativados; resposta externa limitada a 1 MiB.
Não há chamada externa no construtor, startup ou build.

JSON esperado do provedor/mock:

```json
{
  "title": "Exemplo",
  "synopsis": "Descrição opcional",
  "type": "MOVIE",
  "releaseYear": 2026,
  "durationMinutes": 90
}
```

title é obrigatório, não vazio após trim e até 180 caracteres. Os demais campos
são opcionais/anuláveis; type usa ContentType, ano/duração seguem os limites dos
DTOs de Contents. A resposta local inclui externalId e somente esses campos
permitidos. Campos extras externos não são repassados. A integração não cria nem
altera Content automaticamente; gestores podem aproveitar os valores validados.

Erros: 400 para identificador inválido; 401/403 para autenticação/perfil; 404 para
404 do provedor; 502 para falha de rede, outros status externos, JSON/formato
inválido ou resposta excessiva; 503 sem configuração; 504 por timeout.
Nenhuma resposta bruta externa, stack, URL configurada ou objeto Axios é devolvido
ou registrado nos logs desta integração.

## Interceptor global

HttpLoggingInterceptor registrado com APP_INTERCEPTOR em AppModule. Registra um
evento JSON com method, route (template, por exemplo `/contents/:id`), status e
durationMs. Usa finish para obter o status final, inclusive erros tratados; close
antes da conclusão registra 499 como marcador de desconexão, sem alterar a resposta.
Não registra headers, JWT, API Key, query, parâmetros reais, body ou exceções.
Não cria envelope de resposta e não implementa regra de negócio.

Como guards executam antes de interceptors, requisições negadas nos guards não
chegam a este interceptor. Não se trata de um log completo de auditoria de segurança.

## Helmet e Compression

main.ts aplica `helmet()` e `compression()` após NestFactory.create e antes de
registrar as rotas no listen. São usados os padrões dos middlewares; não há
proteções desativadas ou envelope. main.ts também permite as origens locais localhost/127.0.0.1 nas portas 5500 e 5173 via CORS. O ValidationPipe,
porta e configuração existente da API Key foram preservados.

Dependências diretas adicionadas:

- @nestjs/axios e axios: HttpModule/HttpService para o requisito de integração.
- helmet: headers de segurança obrigatórios.
- compression: compressão HTTP obrigatória.
- @types/compression e @types/multer (desenvolvimento): tipagem TypeScript dos
  middlewares/arquivos. Multer e FileTypeValidator já são fornecidos pela pilha Nest.

Referências oficiais consultadas:
[HttpModule](https://docs.nestjs.com/techniques/http-module),
[Helmet](https://docs.nestjs.com/security/helmet) e
[Compression](https://docs.nestjs.com/techniques/compression).

## Validação e pendências

Os testes em test/integrations.test.cjs cobrem upload válido/inválido no service e metadados com sucesso/falhas controladas. Quatro casos usam HttpService/Axios reais contra mock HTTP local: sucesso, 404, 500 e timeout. test/backend.test.cjs também exercita upload multipart por HTTP: PNG válido, ausência, assinatura falsa, excesso de tamanho, campo incorreto e perfil sem permissão. Filesystem e Prisma são simulados; não se afirma persistência real nem consumo de provedor na internet. O mock manual test/manual-metadata-mock.cjs permanece na entrega; inicialização, URL e consulta estão na seção 14 do README. Consulte [AUDITORIA-FINAL.md](../../AUDITORIA-FINAL.md) para os resultados atuais.
