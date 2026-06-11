import { Link } from 'react-router-dom'
import heroImage from '../assets/hero.png'

export default function LandingPage() {
  return (
    <main className="min-h-[calc(100svh-64px)] p-6">
      <section className="relative mx-auto grid min-h-[74svh] max-w-6xl overflow-hidden rounded-lg border border-white/10 bg-black/20 md:grid-cols-[1.1fr_0.9fr]">
        <div className="relative z-10 flex flex-col justify-center p-8 md:p-12">
          <h1 className="font-semibold">FocusFlow AI</h1>
          <p className="mt-4 max-w-xl text-lg opacity-85">
            Plan subjects, track focus, generate quizzes, and get study help from one calm student workspace.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link className="rounded-md bg-blue-600 px-5 py-3 font-medium text-white" to="/register">
              Start planning
            </Link>
            <Link className="rounded-md border border-white/20 px-5 py-3 font-medium" to="/login">
              Login
            </Link>
          </div>
          <div className="mt-8 grid max-w-xl grid-cols-1 gap-3 text-sm md:grid-cols-3">
            {['AI timetable', 'Quiz scoring', 'Burnout check'].map((item) => (
              <div className="rounded-md bg-white/10 p-3" key={item}>{item}</div>
            ))}
          </div>
        </div>
        <div className="relative min-h-72">
          <img alt="FocusFlow AI study dashboard preview" className="h-full w-full object-cover" src={heroImage} />
          <div className="absolute inset-0 bg-gradient-to-l from-transparent to-black/20" />
        </div>
      </section>
    </main>
  )
}
