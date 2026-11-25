export default function AuthCard({ children, className = '' }) {
  return (
    <section
      className={`relative rounded-[26px] border border-white/80 bg-white p-5 shadow-[0_28px_70px_-32px_rgba(6,78,59,0.35),0_2px_10px_rgba(15,23,42,0.04)] sm:p-8 ${className}`}
    >
      {children}
    </section>
  )
}
