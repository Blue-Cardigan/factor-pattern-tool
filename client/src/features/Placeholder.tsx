/* features/Placeholder.tsx — shown until a feature mode is implemented. */
export default function Placeholder({ title, note }: { title: string; note: string }) {
  return (
    <div className="h-full w-full flex flex-col items-center justify-center gap-3 bg-background text-center px-8">
      <div
        className="text-2xl font-bold tracking-tight text-foreground"
        style={{ fontFamily: "'Outfit', sans-serif" }}
      >
        {title}
      </div>
      <p className="text-sm text-muted-foreground font-mono max-w-md">{note}</p>
    </div>
  );
}
