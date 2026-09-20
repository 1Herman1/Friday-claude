export function Brandmark() {
  return (
    <div className="flex flex-col items-start gap-1 md:gap-2">
      <img
        src="/logo/logo-wordmark.png"
        alt="Perfect Skin"
        width={331}
        height={56}
        className="w-full max-w-[331px] h-auto"
      />
      <p
        className="text-body-sm font-sans font-normal leading-body text-foreground"
        style={{
          letterSpacing: '0.49em',
          maxWidth: '331px',
        }}
      >
        Назначают врачи. Любит ваша кожа.
      </p>
    </div>
  )
}
