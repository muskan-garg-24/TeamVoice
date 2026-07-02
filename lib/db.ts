import { PrismaClient } from '@prisma/client'

const prismaClientSingleton = () => {
  return new PrismaClient()
}

/* eslint-disable no-var */
declare global {
  var prismaGlobal: ReturnType<typeof prismaClientSingleton> | undefined

}

export const db = globalThis.prismaGlobal ?? prismaClientSingleton()

if (process.env.NODE_ENV !== 'production') globalThis.prismaGlobal = db

export default db
