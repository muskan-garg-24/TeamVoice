export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-background text-foreground">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
          Project Setup Successful
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          TeamVoice — Next.js + TypeScript + Tailwind + shadcn/ui + Prisma
        </p>
      </div>
    </main>
  )
}
