/** Общее превью «это музыка»: градиент + псевдо-эквалайзер + бейдж. */
export default function MusicCardCover({ className = 'absolute inset-0' }: { className?: string }) {
  return (
    <div className={`${className} overflow-hidden bg-gradient-to-br from-violet-950 via-fuchsia-900/90 to-sky-950`} aria-hidden>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_90%_60%_at_50%_-10%,rgba(255,180,255,0.35),transparent_55%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_100%_100%,rgba(99,102,241,0.4),transparent_50%)]" />
      <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-black/50 to-transparent" />
      <div className="absolute inset-0 flex items-center justify-center gap-0.5 px-8 opacity-90">
        {[8, 14, 10, 18, 12, 20, 9, 16, 11].map((h, i) => (
          <span
            key={i}
            className="w-1 rounded-full bg-gradient-to-t from-fuchsia-300/90 to-cyan-200/80"
            style={{ height: `${h}px`, minHeight: '6px' }}
          />
        ))}
      </div>
      <div className="absolute top-3 left-3 right-3 flex items-center justify-center">
        <span className="rounded-full border border-white/20 bg-black/30 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-white/90 backdrop-blur-sm shadow-lg">
          Музыка
        </span>
      </div>
    </div>
  )
}
