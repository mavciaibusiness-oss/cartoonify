# Görev 0026 — Stripe ile kredi satışı: operatör adımları

Bu belgede hiçbir gizli değer yoktur. Anahtarları ve gizli değerleri yalnız siz, ilgili ekrana yazarsınız; hiçbir dosyaya, sohbete ya da commit'e yazmayın.

Stripe hesabı AVC TRADE LLC hesabıdır ve Webtochat ile ortaktır. Cartoonify için ayrı webhook uçları ve ayrı gizli değerler kullanılır. Webtochat'ın ayarlarına dokunmayın.

## A. Vercel değişkenleri (yalnız adlar)

Vercel → takım homeca-lc → proje cartoonify → Settings → Environment Variables. Komut satırı isterseniz: `npx vercel env add <AD> preview --scope homeca-lc` (değeri komut sorduğunda yazın).

| Ad | Preview (Stripe TEST) | Production (Stripe CANLI) |
|---|---|---|
| `STRIPE_SECRET_KEY` | test anahtarı: `sk_test_` ile başlar (ya da kısıtlı `rk_test_`) | canlı anahtar: `sk_live_` ile başlar (ya da kısıtlı `rk_live_`) |
| `STRIPE_WEBHOOK_SECRET` | B1'deki test webhook'unun gizli değeri | B2'deki canlı webhook'un gizli değeri |
| `PAYMENT_PROVIDER` | boş bırakın ya da `stripe` | boş bırakın ya da `stripe` |
| `RESEND_API_KEY` | isteğe bağlı | gerekli |
| `OPERATOR_ALERT_EMAIL` | isteğe bağlı | gerekli |

- Kod yanlış ortamdaki anahtarı reddeder: Preview'da canlı anahtar, Production'da test anahtarı varsa ödeme kapanır (503). Bu bilinçli bir korumadır.
- Kısıtlı anahtar (`rk_`) kullanırsanız Checkout Sessions için yazma izni verin; başka izin gerekmez.
- `STRIPE_API_BASE_URL` yalnız testler içindir; Vercel'e **girmeyin**.
- Eski Polar değişkenleri kalabilir; bu sürümde Polar kapalıdır.

## B. Stripe webhook kurulumu

Her iki modda da olay listesi aynıdır, yalnız bunları seçin:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `charge.refunded`
- `charge.dispute.created`
- `charge.dispute.closed`

### B1. Test modu / Sandbox (Preview için)

1. Stripe panelinde Preview'a koyduğunuz test anahtarının ait olduğu test ortamına geçin. Webtochat'ın "dynamic-wonder" Sandbox'ındaki webhook'a dokunmayın; Cartoonify için yeni ve ayrı bir uç ekliyorsunuz.
2. Developers → Webhooks → "Add destination" (ya da "Add endpoint").
3. Adres: `https://cartoonify-polar-sandbox.vercel.app/api/stripe/webhook?x-vercel-protection-bypass=<bypass gizli değeri>`
4. Bypass gizli değeri Vercel'den gelir: proje cartoonify → Settings → Deployment Protection → "Protection Bypass for Automation". Orada bir değer yoksa oluşturun; değeri yalnız bu adres kutusuna yapıştırın. Önizlemeler korumalı olduğu için Stripe bu değer olmadan uca ulaşamaz.
5. Sabit önizleme adresi her yeni önizlemede yeniden bağlanır: `npx vercel alias set <önizleme adresi> cartoonify-polar-sandbox.vercel.app --scope homeca-lc`.
6. Olayları yukarıdaki listeden seçip kaydedin. "Signing secret" değerini açın ve yalnız Vercel'de Preview için `STRIPE_WEBHOOK_SECRET` olarak girin.

### B2. Canlı mod (Production için)

1. Stripe panelinde canlı moda geçin. Developers → Webhooks → yeni uç ekleyin.
2. Adres: `https://cartoon.protoolhub.net/api/stripe/webhook`
3. Aynı beş olayı seçip kaydedin. "Signing secret" değerini yalnız Vercel'de Production için `STRIPE_WEBHOOK_SECRET` olarak girin.
4. Webtochat'ın canlı webhook'u yerinde kalır. Bizim ödemelerimiz ona da gider, ama o yalnız kendi aboneliklerini işler ve bizimkileri yok sayar.

## C. Stripe Tax (test ve canlı modda ayrı ayrı)

1. Stripe → Tax → "Get started" (ya da Settings → Tax).
2. Origin address (çıkış adresi): AVC TRADE LLC'nin kayıtlı adresi.
3. Registrations: vergi kaydınız olan yerleri ekleyin. Kayıt eklemediğiniz yerde Stripe vergi almaz; hangi ülke ve eyaletlerde kayıt gerektiğine muhasebeciniz karar verir.
4. Default tax behavior: **Inclusive** (fiyatlar vergi dahil; alıcı tam olarak $3.99 / $9.99 / $19.99 öder). Kod zaten her satırda inclusive gönderir; bu ayar yedek olarak aynı olsun.
5. Ürün vergi kodu: kod her pakete `txcd_10000000` (General - Electronically Supplied Services) gönderir. Tax ayarlarında varsayılan kodun da bu olduğunu kontrol edin.
6. Vergi beyanı ve ödemesi satıcının (AVC TRADE LLC) sorumluluğudur; Stripe Tax yalnız hesaplar.

## D. Kart ekstresi açıklaması

1. Stripe → Settings → Business → Public details: "Shortened descriptor" alanı dolu olmalı (örneğin AVC TRADE).
2. Kod her ödemeye `PROTOOLHUB` ekini gönderir; ekstrede kısa açıklama ile birlikte görünür. Toplam uzunluk sınırını aşarsa Stripe kısaltır.
3. Yasal sayfalarda satıcı adresi hâlâ "REVIEW REQUIRED" olarak duruyor; adresi siz yazdırana kadar böyle kalır.

## E. Test hesabı (sandbox_testers)

Önizleme ve canlı site aynı veritabanını kullanır. Test kartıyla yapılan ödemeler yalnız `protoolhub.sandbox_testers` listesindeki hesaplara kredi ekler (0023 kuralı; bu görevde de veritabanı fonksiyonu uygular). Kendi hesabınız listede yoksa Supabase SQL Editor'de (proje `ltjwsmiycijxrqxjsphq`) kendi kullanıcı kimliğinizle bir satır ekleyin; 0023 belgesindeki komutun aynısıdır.

## F. Veritabanı

1. Önce yedek: Supabase → Database → Backups'ta güncel yedeğin olduğunu görün.
2. `supabase/migrations/20261030000000_protoolhub_stripe.sql` dosyasını okuyun, sonra Claude sohbetinden Supabase MCP `apply_migration` ile proje `ltjwsmiycijxrqxjsphq` üzerinde uygulayın. **Asla `supabase db push`, asla `db reset`.** Migration yalnız `protoolhub` şemasını değiştirir.
3. Sonra `supabase/checks/0026_live_catalog.sql` dosyasını salt okunur çalıştırın: **sıfır satır** dönmeli. Her satır bir sorunu adlandırır. MCP yorum satırlarını silse de bu kontrol doğru çalışır.
4. Eski `0024_live_catalog.sql` artık yeni tabloları "beklenmeyen" diye gösterir; onu çalıştırmayın.

## G. Önizlemede deneme ve yayına alma

1. Önizleme açıldığında sabit adresi bağlayın (B1 adım 5).
2. `/tr/workshop` ve `/workshop` sayfalarından en küçük paketi test kartıyla alın: `4242 4242 4242 4242`, ileri bir tarih, herhangi bir CVC. Dönüşte "10 kredi eklendi" görünmeli.
3. Stripe test panelinden bu ödemeyi kısmen iade edin: kredi orantılı ve yukarı yuvarlanarak düşmeli. Krediler harcanmışsa uyarı e-postası gelir (Preview'da Resend ayarı varsa).
4. Profil sayfasında satın alma geçmişinde hem eski Polar hem yeni Stripe kayıtları görünmeli.
5. Webtochat'ın test ortamında bir şey değişmediğini kontrol edin.
6. Hepsi tamamsa bana **"yayına al"** deyin. Production'a ancak o zaman gönderilir: `npx vercel --prod --scope homeca-lc`. Asistan `vercel --prod` komutunu kendiliğinden çalıştırmaz.
7. Yayından sonra en küçük paketi gerçek kartla alın, krediyi görün, Stripe canlı panelinden iade edin ve kredinin düştüğünü görün.
8. Yasal sayfalar hâlâ "REVIEW REQUIRED" taslağıdır; bir avukat incelemeden işaret kaldırılmaz.
