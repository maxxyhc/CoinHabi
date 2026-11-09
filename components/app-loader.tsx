export function AppLoader({ label }: { label: string }) {
  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center gap-5" role="status" aria-live="polite">
      <div className="coin-loader" aria-hidden="true">
        <div className="coin-loader__coin">$</div>
        <div className="coin-loader__shadow" />
      </div>
      <p className="text-sm text-titanium">
        {label}
        <span className="coin-loader__dots" aria-hidden="true"><span>.</span><span>.</span><span>.</span></span>
      </p>
    </main>
  );
}
