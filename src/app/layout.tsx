import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { LayoutDashboard, PlusCircle, Settings } from 'lucide-react'
import Link from 'next/link'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Edição Criativos ASAVIA',
  description: 'Fábrica de Criativos Automatizada',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-br" className="dark">
      <body className={`${inter.className} bg-slate-900 text-slate-100 min-h-screen font-sans antialiased selection:bg-blue-600 selection:text-white`}>
        {/* App Layout */}
        <div className="flex h-screen overflow-hidden">

          {/* Sidebar */}
          <aside className="absolute inset-y-0 left-0 z-40 w-64 bg-slate-800 border-r border-slate-700 transition-transform duration-300 md:relative md:translate-x-0 hidden md:block shrink-0">
            <div className="flex items-center justify-between p-4 h-16 border-b border-slate-700">
              <span className="text-xl font-bold tracking-wider text-blue-500">
                NEO<span className="text-white">BRIEF</span>
              </span>
            </div>

            <nav className="p-4 space-y-2">
              <Link href="/" className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-slate-700 text-slate-300 hover:text-white transition-colors bg-slate-700 text-white">
                <LayoutDashboard className="w-5 h-5" />
                <span>Dashboard</span>
              </Link>

              <Link href="/novo" className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-slate-700 text-slate-300 hover:text-white transition-colors">
                <PlusCircle className="w-5 h-5" />
                <span>Novo Briefing</span>
              </Link>

              <div className="pt-4 mt-4 border-t border-slate-700">
                <p className="px-4 text-xs font-semibold text-slate-500 uppercase">Sistema</p>
                <button className="flex items-center gap-3 px-4 py-3 mt-2 rounded-lg hover:bg-slate-700 text-slate-300 hover:text-white transition-colors w-full">
                  <Settings className="w-5 h-5" />
                  <span>Configurações</span>
                </button>
              </div>
            </nav>
          </aside>

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col min-w-0 bg-slate-900 border-l border-slate-800 shadow-2xl overflow-y-auto overflow-x-hidden">
            <main className="flex-1 pb-10">
              {children}
            </main>
          </div>

        </div>
      </body>
    </html>
  )
}
