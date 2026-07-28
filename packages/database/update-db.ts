import { prisma } from './client';

async function main() {
  try {
    await prisma.$executeRawUnsafe('ALTER TABLE "Message" ADD COLUMN "reasoning" TEXT;');
    console.log("Column reasoning added successfully.");
  } catch(e) {
    console.error("Error or column already exists:", e);
  }
}
main();
