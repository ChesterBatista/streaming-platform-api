import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '../src/generated/prisma/client';

// Credencial exclusivamente fictícia, documentada em SEED.md.
const DEMO_PASSWORD = 'DemoStreaming@123';
const users = [
  { name: '[DEMO] Assinante Aurora', email: 'subscriber.demo@streaming.local', role: 'SUBSCRIBER' },
  { name: '[DEMO] Gestor Horizonte', email: 'manager.demo@streaming.local', role: 'CONTENT_MANAGER' },
  { name: '[DEMO] Administrador Estelar', email: 'admin.demo@streaming.local', role: 'ADMIN' },
] as const;
const plans = [
  { name: '[DEMO] Plano Essencial', price: '19.90' },
  { name: '[DEMO] Plano Premium', price: '39.90' },
];
const categoryNames = ['[DEMO] Ficção Científica', '[DEMO] Ação', '[DEMO] Drama'];
const contents = [
  { externalId: 'demo-orbita-azul', title: '[DEMO] Órbita Azul', type: 'MOVIE', status: 'PUBLISHED', releaseYear: 2024, durationMinutes: 100, synopsis: 'Uma tripulação fictícia explora um planeta azul.', planIndexes: [0, 1], categoryIndexes: [0, 1] },
  { externalId: 'demo-caminhos-do-vale', title: '[DEMO] Caminhos do Vale', type: 'SERIES', status: 'PUBLISHED', releaseYear: 2025, durationMinutes: 45, synopsis: 'Uma comunidade fictícia reconstrói sua estação de pesquisa.', planIndexes: [0, 1], categoryIndexes: [2] },
  { externalId: 'demo-memorias-do-futuro', title: '[DEMO] Memórias do Futuro', type: 'DOCUMENTARY', status: 'PUBLISHED', releaseYear: 2025, durationMinutes: 80, synopsis: 'Documentário demonstrativo sobre invenções de um mundo imaginário.', planIndexes: [1], categoryIndexes: [0, 2] },
  { externalId: 'demo-projeto-aurora', title: '[DEMO] Projeto Aurora', type: 'MOVIE', status: 'DRAFT', releaseYear: 2026, durationMinutes: 95, synopsis: 'Rascunho de uma aventura fictícia em preparação.', planIndexes: [1], categoryIndexes: [1] },
  { externalId: 'demo-ultimo-farol', title: '[DEMO] O Último Farol', type: 'MOVIE', status: 'ARCHIVED', releaseYear: 2023, durationMinutes: 90, synopsis: 'Drama fictício arquivado para demonstrar gestão de estados.', planIndexes: [0], categoryIndexes: [2] },
] as const;

class DemoConflict extends Error {}

function ensure(condition: unknown, message: string): asserts condition {
  if (!condition) throw new DemoConflict(message);
}

// Nunca sobrescreve registros encontrados, nem mesmo credenciais demo alteradas.
function sameFields(actual: object, expected: object, label: string) {
  const record = actual as Record<string, unknown>;
  for (const [key, value] of Object.entries(expected)) {
    ensure(record[key] === value, `${label}: campo ${key} diverge do seed; registro preservado.`);
  }
}

async function counts(tx: Prisma.TransactionClient) {
  const demoUser = { email: { in: users.map((user) => user.email) } };
  const demoContent = { externalId: { in: contents.map((content) => content.externalId) } };
  const demoPlan = { name: { in: plans.map((plan) => plan.name) } };
  const values = await Promise.all([
    tx.user.count({ where: demoUser }),
    tx.plan.count({ where: demoPlan }),
    tx.category.count({ where: { name: { in: categoryNames } } }),
    tx.content.count({ where: demoContent }),
    tx.planContent.count({ where: { content: demoContent, plan: demoPlan } }),
    tx.contentCategory.count({ where: { content: demoContent, category: { name: { in: categoryNames } } } }),
    tx.subscription.count({ where: { user: demoUser, plan: demoPlan } }),
    tx.watchHistory.count({ where: { user: demoUser, content: demoContent } }),
    tx.rating.count({ where: { user: demoUser, content: demoContent } }),
  ]);
  return Object.fromEntries(['users', 'plans', 'categories', 'contents', 'planContents', 'contentCategories', 'subscriptions', 'watchHistory', 'ratings'].map((key, i) => [key, values[i]]));
}

async function seed(tx: Prisma.TransactionClient) {
  const before = await counts(tx);
  const demoUsers = [];
  for (const definition of users) {
    let user = await tx.user.findUnique({ where: { email: definition.email } });
    if (!user) {
      // UsersService utiliza bcrypt com custo 12; não existe helper de hash separado.
      user = await tx.user.create({ data: { ...definition, status: 'ACTIVE', password: await bcrypt.hash(DEMO_PASSWORD, 12) } });
    }
    sameFields(user, { ...definition, status: 'ACTIVE' }, definition.email);
    ensure(bcrypt.getRounds(user.password) === 12 && await bcrypt.compare(DEMO_PASSWORD, user.password), `${definition.email}: senha demo divergente; credencial preservada.`);
    demoUsers.push(user);
  }

  const demoPlans = [];
  for (const definition of plans) {
    const data = { ...definition, description: 'Plano fictício exclusivo para demonstração.', status: 'ACTIVE' as const };
    const plan = await tx.plan.upsert({ where: { name: definition.name }, create: data, update: {} });
    sameFields(plan, { name: data.name, description: data.description, status: data.status }, data.name);
    ensure(plan.price.equals(data.price), `${data.name}: preço divergente; registro preservado.`);
    demoPlans.push(plan);
  }
  const demoCategories = [];
  for (const name of categoryNames) {
    const data = { name, description: 'Categoria fictícia exclusiva para demonstração.' };
    const category = await tx.category.upsert({ where: { name }, create: data, update: {} });
    sameFields(category, data, name);
    demoCategories.push(category);
  }
  const demoContents = [];
  for (const definition of contents) {
    const { planIndexes, categoryIndexes, ...fields } = definition;
    const content = await tx.content.upsert({
      where: { externalId: fields.externalId },
      create: { ...fields, thumbnailUrl: null }, update: {},
    });
    // Uma thumbnail real adicionada manualmente permanece preservada.
    sameFields(content, fields, fields.externalId);
    for (const index of planIndexes) {
      const link = { contentId: content.id, planId: demoPlans[index].id };
      await tx.planContent.upsert({ where: { planId_contentId: link }, create: link, update: {} });
    }
    for (const index of categoryIndexes) {
      const link = { contentId: content.id, categoryId: demoCategories[index].id };
      await tx.contentCategory.upsert({ where: { contentId_categoryId: link }, create: link, update: {} });
    }
    demoContents.push(content);
  }

  const subscriber = demoUsers[0];
  const pair = { userId: subscriber.id, planId: demoPlans[0].id };
  // Subscription não possui chave única composta. Serializable protege leitura + criação.
  const existing = await tx.subscription.findMany({ where: pair });
  ensure(existing.length <= 1, 'Mais de uma assinatura demo existente; nenhuma foi removida.');
  const now = new Date();
  const subscription = existing[0] ?? await tx.subscription.create({ data: { ...pair, status: 'ACTIVE', startsAt: now, expiresAt: null } });
  ensure(subscription.status === 'ACTIVE' && subscription.startsAt <= now && (subscription.expiresAt === null || subscription.expiresAt > now), 'Assinatura demo sem vigência ativa; estado preservado.');

  // Confere o acesso efetivo incluindo quaisquer vínculos/assinaturas preexistentes.
  const accessible = await tx.content.findMany({ where: {
    externalId: { in: contents.map((content) => content.externalId) },
    status: 'PUBLISHED',
    plans: { some: { plan: { status: 'ACTIVE', subscriptions: { some: {
      userId: subscriber.id, user: { status: 'ACTIVE' }, status: 'ACTIVE', startsAt: { lte: now },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    } } } } },
  }, select: { id: true } });
  ensure(accessible.length === 2 && demoContents.slice(0, 2).every((content) => accessible.some((item) => item.id === content.id)), 'Acesso demo divergente: esperados somente os dois conteúdos do Essencial.');

  const personal = { userId: subscriber.id, contentId: demoContents[0].id };
  const history = await tx.watchHistory.upsert({
    where: { userId_contentId: personal }, update: {},
    create: { ...personal, progressSeconds: 1200, completed: false, lastWatchedAt: now },
  });
  ensure(history.progressSeconds >= 0 && history.progressSeconds <= demoContents[0].durationMinutes! * 60 && history.lastWatchedAt <= now, 'Histórico demo inválido; registro preservado.');
  const rating = await tx.rating.upsert({
    where: { userId_contentId: personal }, update: {},
    create: { ...personal, score: 4, comment: 'Ótimo conteúdo para demonstração.', isActive: true },
  });
  ensure(Number.isInteger(rating.score) && rating.score >= 1 && rating.score <= 5 && rating.isActive, 'Avaliação demo inválida ou inativa; registro preservado.');
  const after = await counts(tx);
  sameFields(after, { users: 3, plans: 2, categories: 3, contents: 5, planContents: 7, contentCategories: 7, subscriptions: 1, watchHistory: 1, ratings: 1 }, 'Contagens DEMO');
  return { before, after, created: Object.fromEntries(Object.entries(after).map(([key, value]) => [key, value - before[key]])) };
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  ensure(connectionString, 'DATABASE_URL não configurada.');
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  try {
    const result = await prisma.$transaction(seed, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 10000, timeout: 30000,
    });
    console.log('Seed DEMO concluído. Papéis, bcrypt (12), vínculos, acesso, vigência, histórico e avaliação verificados.');
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  // Erros do driver podem conter URL/credenciais: não imprimir o objeto bruto.
  if (error instanceof DemoConflict) console.error(error.message);
  else if (error instanceof Prisma.PrismaClientKnownRequestError) console.error(`Seed não concluído (Prisma ${error.code}). Verifique conexão/schema ou concorrência e reaplique.`);
  else console.error('Seed não concluído. Verifique a conexão e a configuração local do banco.');
  process.exitCode = 1;
});
