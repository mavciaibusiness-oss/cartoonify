import type { Metadata } from 'next'
import { TITLE_SUFFIX } from '@/lib/i18n'

export const metadata: Metadata = {
  title: 'Çerez Politikası' + TITLE_SUFFIX,
  alternates: { canonical: '/tr/cookies', languages: { en: '/cookies', tr: '/tr/cookies', 'x-default': '/cookies' } },
  openGraph: { url: '/tr/cookies' },
}

export default function Page() {
  return (
    <main className="prose mx-auto p-8">
      <h1>Çerez Politikası</h1>
      {/* REVIEW REQUIRED - draft text. A lawyer must review this before launch.
          Only the operator removes this marker, and only after that review: deleting it
          asserts a review that did not happen. It is a warning while you build and a
          blocker before you ship. */}
      <h2>Çerez nedir</h2>
      <p>Çerezler, ziyaret ettiğiniz siteler tarafından cihazınıza kaydedilen
      küçük metin dosyalarıdır.</p>
      <h2>Kullandığımız çerezler</h2>
      <p>Zorunlu çerezler: oturum yönetimi ve güvenlik için gereklidir, devre
      dışı bırakılamaz. Analitik ve pazarlama çerezleri yalnızca açık rızanız
      ile çalıştırılır.</p>
      <h2>Ölçüm ve reklam çerezleri</h2>
      <p>Açık rızanızla Google Analytics (ziyaret istatistikleri), Google Ads (reklamlarımızın işe yarayıp yaramadığının ölçümü) ve Meta (Meta pikseli, Meta reklamlarının ölçümü) kullanırız. Bunlar yalnızca bandda Kabul et düğmesine bastıktan sonra yüklenir. Öncesinde ve Reddet düğmesine bastıktan sonra hiçbiri yüklenmez ve onlara hiçbir şey gönderilmez. Ayarladıkları çerezler şunlardır:</p>
      <ul>
        <li><code>_ga</code> ve <code>_ga_&lt;id&gt;</code> - Google Analytics - ziyaretleri ve ziyaretçileri ayırt eder - 2 yıl.</li>
        <li><code>_gcl_au</code> - Google Ads - bir reklam tıklamasını sonraki kayıt veya satın alma ile eşleştirir - 90 gün.</li>
        <li><code>_fbp</code> - Meta - Meta reklam ölçümü için ziyaretleri ayırt eder - 90 gün.</li>
      </ul>
      <p>Bu araçlara gönderilen olaylar: yeni hesap açıldı, kredi paketi ödemesi başlatıldı ve ödeme tamamlandı (tutar, para birimi ve aynı ödemenin iki kez sayılmaması için bir sipariş kimliğiyle). Ad, e-posta adresi veya telefon numarası gönderilmez.</p>
      <p>Seçiminizin kendi kaydı çerezde değil, tarayıcınızın localStorage alanında tutulur:</p>
      <ul>
        <li><code>pth-consent</code> - seçiminiz (kabul veya ret).</li>
        <li><code>pth-consent-at</code> - seçimi yaptığınız an. Seçim 12 ay geçerlidir; sonrasında bant yeniden sorar ve siz seçene kadar hiçbir şey yüklenmez.</li>
        <li><code>pth-tracked</code> - yalnızca rıza ile yazılır: aynı ödeme iki kez sayılmasın diye sayılmış son ödeme kimlikleri.</li>
      </ul>
      <h2>Tarayıcı deposu</h2>
      <p>İngilizce bir sayfada Türkçe tarayıcı dili algılanırsa, Türkçe sürüme geçiş
      önerisi gösterilir. Öneriyi kapattığınızda bu tercih tarayıcının sessionStorage
      alanına, pth-lang-hint anahtarıyla yalnızca o sekme oturumu için yazılır. Bu bir
      çerez değildir, sunucuya gönderilmez ve sekme kapanınca silinir.</p>
      <h2>Yönetimi</h2>
      <p>Seçiminizi her sayfanın altındaki Çerez ayarları düğmesiyle istediğiniz zaman değiştirebilirsiniz. Orada Reddet derseniz araçlar bir sonraki sayfadan itibaren durur; açık sayfada yüklenmiş olan araçlar geri alınamaz, siz sonraki sayfaya geçince durur.</p>
      <p>Tarayıcı ayarlarınızdan çerezleri silebilir veya engelleyebilirsiniz.
      Zorunlu çerezlerin engellenmesi hizmetin çalışmasını etkileyebilir.</p>
      <h2>Üçüncü taraf çerezleri</h2>
      <p>Reklam veya analitik sağlayıcılar kendi çerezlerini kullanabilir. Bu
      çerezler yalnızca rıza verildikten sonra yüklenir.</p>
    </main>
  )
}
