# Görev 0022: Hesaplar ve kredi cüzdanı - sizin yapacağınız adımlar

Bu belge teknik bilgisi olmayan biri için yazıldı. Her adım sırayla verilmiştir. Hiçbir adımda
bir şifre ya da anahtar bu belgeye veya bir sohbete yazılmaz; değerleri yalnızca siz, ilgili
sitenin kendi ekranına yazarsınız.

## Önce bilmeniz gerekenler

- Bu iş için kullanılan Supabase projesinin kodu (project ref): `ltjwsmiycijxrqxjsphq`
- **Asla dokunmayın:** `bptiwxuzscfhuyzpuwip` kodlu proje başka bir ürüne aittir. Hiçbir komutta,
  hiçbir ekranda bu projeyi seçmeyin.
- Supabase komut satırı aracını (CLI) kullandığınız her komutta şu ifade bulunmalıdır:
  `--project-ref ltjwsmiycijxrqxjsphq`
- Bu proje Firma Bulucu ve webtochat ile ortaktır. Bu görev yalnızca yeni bir şema olan
  `protoolhub` şemasını ekler. `public`, `leadgen` ve `auth` içindeki hiçbir şey değiştirilmez.

## G2. Başlamadan önce: manifest

Bu adım build'den önce yapıldı. Doğrulamak için proje klasöründe `state.mjs --validate` çalıştırılır.
Manifestte veritabanı Supabase, kimlik doğrulama Supabase Auth ve e-posta Resend olarak görünmelidir.

## G3. Doğrulamadan (verify) önce

- `.env.local` dosyasında şu dört isim **bulunmamalıdır**: `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`, `ABUSE_HASH_SECRET`. Bu değerler yalnızca Vercel'de durur.
- Bu projenin `next dev` veya `next start` süreci çalışmıyor olmalıdır.

## G4. Yedek (yedek almadan devam etmeyin)

Bu projede otomatik veritabanı yedeği yoktur. Migration'ı uygulamadan önce **yedek** alın.
Yedekleri depo klasörünün **dışına** kaydedin.

```
npx supabase link --project-ref ltjwsmiycijxrqxjsphq
npx supabase db dump --linked --project-ref ltjwsmiycijxrqxjsphq -f <depo-disi-klasor>/pre-0022-schema.sql
npx supabase db dump --linked --data-only --project-ref ltjwsmiycijxrqxjsphq -f <depo-disi-klasor>/pre-0022-data.sql
```

## G5. Migration'ı uygulama

Dosya: `supabase/migrations/20261027000000_protoolhub_wallet.sql`

1. Dosyayı baştan sona bir kez daha okuyun.
2. Supabase paneli, proje `ltjwsmiycijxrqxjsphq`, **SQL Editor** bölümüne dosyanın tamamını yapıştırıp
   çalıştırın (tek işlem olarak). Ya da Supabase MCP aracının `apply_migration` işlevini aynı proje için kullanın.
3. **Asla `supabase db push` veya `db reset` çalıştırmayın.** Uzak veritabanının migration geçmişinde
   webtochat ve Firma Bulucu'nun migration'ları vardır, bu depoda yoktur; `db push` bu yüzden hasar verebilir.
4. Sonra `supabase/checks/0022_live_catalog.sql` dosyasının içeriğini SQL Editor'de çalıştırın.
   **Sıfır satır** dönmelidir. Bir satır dönerse bir kontrol başarısızdır; satır hangisi olduğunu söyler.
   Bu kontrol yalnızca okur, hiçbir şey yazmaz. Başka deneme yazma sorgusu çalıştırmayın.

Geri alma gerekirse (siz çalıştırırsınız, hiçbir yazılım çalıştırmaz): `drop schema protoolhub cascade`.
Bu, yalnızca cüzdanları ve kayıtları siler.

## G6. Exposed schemas (Açığa çıkan şemalar)

Supabase paneli → Project Settings → Data API → **Exposed schemas**:
`protoolhub` adını **ekleyin**. `public`, `graphql_public` ve `leadgen` olduğu gibi kalsın.

## G7. Supabase Auth ayarları (Firma Bulucu ile ortaktır; önce listeyi okuyun)

1. **Site URL:** değiştirmeyin.
2. **Redirect URLs:** şunları ekleyin, hiçbirini silmeyin:
   - `https://cartoon.protoolhub.net/**`
   - `https://cartoonify-steel.vercel.app/**`
   - `https://cartoonify-*-homeca-lc.vercel.app/**` (önizleme adresleri)
   - İsteğe bağlı, yalnızca yerel çalışma için: `http://localhost:3000/**`
3. **Allow new users to sign up:** açık olmalıdır. Firma Bulucu, `ALLOWED_EMAILS` ve kurum üyeliği
   (`leadgen.org_members`) kapısıyla korunmaya devam eder.
4. **Google sağlayıcısı:** etkinleştirin; Client ID ve Client Secret değerlerini G9'dan alıp
   Supabase'in kendi alanına yapıştırın.
5. **Custom SMTP (Resend):** host `smtp.resend.com`, port 465, kullanıcı `resend`, parola olarak
   Resend'de oluşturduğunuz bir API anahtarı, gönderen adresi `no-reply@protoolhub.net`, gönderen adı `ProToolHub`.
   Ardından Auth → Rate Limits bölümünde e-posta sınırını rahat edeceğiniz bir değere ayarlayın (örneğin saatte 30).
6. **E-posta şablonları, "Magic Link" ve "Confirm signup":** bağlantı `{{ .ConfirmationURL }}` olarak kalsın;
   yalnızca metni iki ürün için de nötr olacak şekilde değiştirin. Önerilen metin:
   - Türkçe: "Merhaba, ProToolHub hesabınıza girmek için aşağıdaki bağlantıyı bu tarayıcıda açın: {{ .ConfirmationURL }}"
   - English: "Hello, open the link below in this browser to sign in to your ProToolHub account: {{ .ConfirmationURL }}"
7. İsteğe bağlı ve tüm projeyi etkiler: **Leaked password** protection (sızdırılmış parola koruması).
   Firma Bulucu'nun parola ile girişlerine yardımcı olur.
8. Bilgi için: `public.kb_sync_*` ve `public.rls_auto_enable` ile ilgili mevcut güvenlik uyarıları webtochat'a aittir;
   bu görevin kapsamı dışındadır.

## G8. Resend alan adı (protoolhub.net)

DNS Cloudflare'dadır (isim sunucuları `khloe.ns.cloudflare.com` ve `rory.ns.cloudflare.com`).

1. Resend'de `protoolhub.net` alan adını ekleyin.
2. Resend'in gösterdiği her kaydı Cloudflare DNS'e kopyalayın: `send` üzerinde bir MX ve bir TXT,
   `resend._domainkey` üzerinde bir TXT, isteğe bağlı olarak `_dmarc`.
3. Her kaydı **DNS only** (gri bulut) yapın; turuncu bulut kullanmayın.
4. Resend'de durum "Verified" olana kadar bekleyin.

## G9. Google Cloud

1. OAuth onay ekranı: uygulama adı ProToolHub, destek e-postası, kapsamlar email / profile / openid,
   yayın durumu "In production".
2. Tür "Web" olan bir OAuth istemcisi oluşturun. Yetkili yönlendirme adresi (redirect URI):
   `https://ltjwsmiycijxrqxjsphq.supabase.co/auth/v1/callback`
3. Client ID ve Client Secret'ı yalnızca G7'nin 4. adımındaki Supabase alanına yazın.

## G10. Vercel ortam değişkenleri

Önce komut satırı aracının doğru hesapta ve projede olduğunu kontrol edin: kapsam `homeca-lc`, proje `cartoonify`.
Değerleri komut sorduğunda siz yazarsınız; hiçbir yere kopyalamayın.

Gerekli dört isim: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ABUSE_HASH_SECRET`
(`ABUSE_HASH_SECRET` yeni, rastgele bir metindir ve her ortam için farklı olmalıdır).

**Preview:**

```
vercel env add SUPABASE_URL preview --scope homeca-lc
vercel env add SUPABASE_ANON_KEY preview --scope homeca-lc
vercel env add SUPABASE_SERVICE_ROLE_KEY preview --scope homeca-lc
vercel env add ABUSE_HASH_SECRET preview --scope homeca-lc
```

**Production:**

```
vercel env add SUPABASE_URL production --scope homeca-lc
vercel env add SUPABASE_ANON_KEY production --scope homeca-lc
vercel env add SUPABASE_SERVICE_ROLE_KEY production --scope homeca-lc
vercel env add ABUSE_HASH_SECRET production --scope homeca-lc
```

## G11. Önizleme ve gerçek bir deneme

Doğrulamadan sonra yalnızca önizleme (preview) yayınlanır, canlıya (`--prod`) çıkılmaz.
Önizlemede bir kez deneyin: giriş yapın, 2 ücretsiz kredi görün, bir dönüşüm yapın (yaklaşık 0,02 USD),
köşede ProToolHub işaretini görün. Siz "yayına al" diyene kadar canlıya çıkış yapılmaz.

## Kısa kontrol listesi

- [ ] Yedek alındı (yedek dosyaları depo dışında)
- [ ] Migration uygulandı, canlı kontrol sıfır satır döndürdü
- [ ] Exposed schemas: `protoolhub` eklendi, `leadgen` kaldı
- [ ] Auth: Site URL aynı, üç Redirect URL eklendi, yeni kullanıcı kaydı açık
- [ ] Google, SMTP ve e-posta şablonları ayarlandı
- [ ] Resend alan adı Verified
- [ ] Preview ve Production için dört ortam değişkeni eklendi
