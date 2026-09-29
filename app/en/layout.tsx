// The one root layout sets <html lang> to Turkish. Everything under /en is
// marked English here, at the element level.
export default function EnglishLayout({ children }: { children: React.ReactNode }) {
  return <div lang="en">{children}</div>
}
