import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const technicians = ['Ana Torres', 'Carlos Ruiz', 'Laura Méndez']

try {
  for (const name of technicians) {
    await prisma.technician.upsert({
      where: { normalizedName: name.normalize('NFKC').trim().toLocaleLowerCase('es-MX') },
      update: { name, active: true },
      create: {
        name,
        normalizedName: name.normalize('NFKC').trim().toLocaleLowerCase('es-MX'),
      },
    })
  }
} finally {
  await prisma.$disconnect()
}
