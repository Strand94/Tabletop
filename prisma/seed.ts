import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Default categories seeded on first run. Idempotent: re-running upserts by the
 * unique `name`, so it is safe to run on every deploy. Names are stable codes;
 * the frontend localizes display labels.
 */
const DEFAULT_CATEGORIES = ['Strategi', 'Familie', 'Co-op', 'Kortspill'];

async function main(): Promise<void> {
  for (const name of DEFAULT_CATEGORIES) {
    await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }
  console.log(`Seeded ${DEFAULT_CATEGORIES.length} default categories.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
