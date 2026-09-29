import LanguageSwitch from './language-switch'
import SiteFooter from './site-footer'
import { UploadProvider } from './upload-state'

/**
 * The header, the upload provider and the footer, rendered by both root
 * layouts (task 0010 section 3.4) so the Turkish and English shells cannot
 * drift apart.
 */
export default function SiteShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="site-header">
        <LanguageSwitch />
      </header>
      <UploadProvider>{children}</UploadProvider>
      <SiteFooter />
    </>
  )
}
