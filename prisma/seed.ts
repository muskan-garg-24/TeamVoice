import { PrismaClient, Role } from '@prisma/client'
import { hashPassword } from '../lib/password'

const prisma = new PrismaClient()

async function main() {
  const name = process.env.SEED_OWNER_NAME
  const email = process.env.SEED_OWNER_EMAIL
  const password = process.env.SEED_OWNER_PASSWORD

  if (!name || !email || !password) {
    console.error(
      'Error: Required environment variables (SEED_OWNER_NAME, SEED_OWNER_EMAIL, SEED_OWNER_PASSWORD) are missing.'
    )
    process.exit(1)
  }

  const normalizedEmail = email.trim().toLowerCase()

  // Check if any user with role OWNER already exists
  const existingOwner = await prisma.user.findFirst({
    where: {
      role: Role.OWNER,
    },
  })

  if (existingOwner) {
    console.log('Owner already exists, skipping')
    return
  }

  // Hash password using the helper
  const passwordHash = await hashPassword(password)

  // Create owner
  await prisma.user.create({
    data: {
      name,
      email: normalizedEmail,
      passwordHash,
      role: Role.OWNER,
    },
  })

  console.log('Database seeded successfully: OWNER user created.')
}

main()
  .catch((error) => {
    console.error('Database seeding failed:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
