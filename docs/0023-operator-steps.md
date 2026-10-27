# Görev 0023 — Polar ile kredi satışı: operatör adımları

Bu belge, Polar'ı önce SANDBOX (test) ortamında, sonra CANLI ortamda kurmanız için adım adım yazıldı. Hiçbir gizli değer (anahtar, token, sır) bu belgeye, bir sohbete ya da bir commit'e yazılmaz; değerleri yalnız siz, ilgili ekrana yazarsınız.

Polar, satıcı kaydıdır (Merchant of Record): kartı Polar alır, vergiyi ve faturayı Polar düzenler. Biz yalnız kredileri yönetiriz.

## A. Önce: veritabanı (doğrulamadan sonra)

1. **Yedek alın.** Projede otomatik yedek yok. Depo klasörünün dışına bir şema yedeği ve bir veri yedeği alın (0022'deki gibi): `npx supabase link --project-ref ltjwsmiycijxrqxjsphq`, sonra `npx supabase db dump --linked -f <depo-dışı>/pre-0023-schema.sql` ve `npx supabase db dump --linked --data-only -f <depo-dışı>/pre-0023-data.sql`. Her Supabase komutunda `--project-ref ltjwsmiycijxrqxjsphq` olsun; başka projeye dokunmayın.
2. **Migration'ı uygulayın:** `supabase/migrations/20261028000000_protoolhub_polar.sql` dosyasını baştan sona okuyun, sonra Supabase MCP `apply_migration` ile (proje `ltjwsmiycijxrqxjsphq`) ya da o projenin SQL Editor'üne yapıştırarak çalıştırın. **Asla `supabase db push` ve asla `db reset` kullanmayın**: uzak geçmişte bu depoda olmayan başka ürünlerin migration'ları var.
3. **Kontrol:** `supabase/checks/0023_live_catalog.sql` dosyasını SQL Editor'de çalıştırın. **Sıfır satır** dönmeli. (0022'nin eski kontrol dosyası artık yeni tabloları "unexpected" diye gösterir; bu beklenen bir durumdur, 0023'ün kontrolü onun yerini alır.)

## B. Polar SANDBOX (önizleme için)

1. `https://sandbox.polar.sh/start` adresinde ayrı bir sandbox hesabı ve bir organizasyon açın. Sandbox, canlıdan tamamen ayrıdır: ürünleri, token'ları ve webhook'u ayrı ayrı oluşturulur.
2. **Fiyat ayarı (Q5):** organizasyon ayarlarında fiyatların vergi dahil (tax-inclusive) olmasını seçin; müşteri tam $3.99 / $9.99 / $19.99 öder.
3. **Üç ürün** (Products → New Product). Her biri tek seferlik ödeme (one-time, abonelik değil), sabit fiyat, para birimi USD, ek fayda (benefit) gerekmez:
   - "Cartoonify 10 kredi" — $3.99
   - "Cartoonify 30 kredi" — $9.99
   - "Cartoonify 75 kredi" — $19.99
   Her ürünün sayfasından ürün kimliğini (Product ID) kopyalayıp bir kenara not edin; bunlar gizli değildir ama karıştırmayın.
4. **Erişim token'ı:** Settings → Developers (Organization Access Tokens) → yeni bir **Organization Access Token** oluşturun. Yetki (scope) olarak yalnız `checkouts:write` seçin. Token'ı yalnız Vercel'e yazacaksınız (C bölümü).
5. **Webhook:** Settings → Webhooks → Add Endpoint:
   - URL: `https://cartoonify-polar-sandbox.vercel.app/api/polar/webhook?x-vercel-protection-bypass=<BYPASS_SECRET>` (`<BYPASS_SECRET>` yerine C.2'deki değeri yazın; bu adresi hiçbir yere kaydetmeyin)
   - Format: **Raw**
   - API version: **2026-10** (ekranda seçenek varsa)
   - Secret: "Generate" ile rastgele oluşturun (8 Eylül 2026 sonrası oluşturulan sırlar Standard Webhooks biçimindedir; kodumuz eski biçimi de kabul eder)
   - Olaylar (events): `order.paid`, `order.refunded`, `refund.created`, `refund.updated`. Başka olay seçmeyin.

## C. Vercel — Preview (sandbox) ayarları

Önce CLI'ın doğru ekipte olduğundan emin olun: her komutta `--scope homeca-lc`.

1. **Değişkenler** — her biri için `vercel env add <AD> preview --scope homeca-lc` ve değeri siz yazın:
   - `POLAR_ACCESS_TOKEN` — B.4'teki sandbox token'ı
   - `POLAR_WEBHOOK_SECRET` — B.5'teki sandbox webhook sırrı
   - `POLAR_PRODUCT_10`, `POLAR_PRODUCT_30`, `POLAR_PRODUCT_75` — B.3'teki sandbox ürün kimlikleri
   - `RESEND_API_KEY` — Resend'de bu iş için yeni bir API anahtarı (yalnız gönderme izni)
   - `OPERATOR_ALERT_EMAIL` — iade sonrası kredi açığı bildirimlerinin gideceği adres. Adres yalnız burada durur; koda, belgeye, commit'e yazılmaz.
   `POLAR_API_BASE_URL` ve `RESEND_API_BASE_URL` yalnız testler içindir; Vercel'e **eklemeyin**.
2. **Protection Bypass for Automation:** Vercel → proje `cartoonify` → Settings → Deployment Protection → "Protection Bypass for Automation" → bir sır oluşturun. Önizlemeler Vercel Authentication arkasında kalır; Polar'ın webhook'u bu sır sayesinde (`x-vercel-protection-bypass` sorgu parametresi) geçer.
3. **Önizleme dağıtımı:** `vercel --scope homeca-lc` (asla `vercel --prod`). Çıkan önizleme adresini sabit adrese bağlayın: `vercel alias set <önizleme-adresi> cartoonify-polar-sandbox.vercel.app --scope homeca-lc`. Bu adres alınmışsa başka bir ad seçin ve B.5'teki URL'yi ona göre değiştirin. **Her yeni önizlemeden sonra** bu `vercel alias set` komutunu tekrar çalıştırın; yoksa Polar eski önizlemeye gönderir.

## D. Sandbox test hesabı (Q2)

Önizleme ve canlı site aynı veritabanını kullanır. Sandbox'ta yapılan sahte ödeme gerçek ücretli kredi eklerdi; bu yüzden sandbox satın alımları yalnız `protoolhub.sandbox_testers` listesindeki hesaplara kredi ekler.

1. Önizlemede kendi hesabınızla bir kez giriş yapın (atölye sayfası açılsın).
2. Supabase SQL Editor'de (proje `ltjwsmiycijxrqxjsphq`), adresi tırnak içine kendiniz yazarak:
   `insert into protoolhub.sandbox_testers (user_id, note) select p.user_id, 'operator' from protoolhub.profiles p join auth.users u on u.id = p.user_id where lower(u.email) = lower('<adresiniz>');`
   "1 row" görmelisiniz. Listede olmayan biri önizlemede satın almaya çalışırsa "yalnızca test hesapları" uyarısını görür ve ödeme sayfası açılmaz.

## E. Önizlemede uçtan uca deneme

1. Atölyede "Kredi al" → 10 kredilik paket → Polar sandbox ödeme sayfası. Test kartı: `4242 4242 4242 4242`, ileri bir tarih, rastgele CVC.
2. Geri dönüşte "Ödemeniz alındı, krediler ekleniyor…", birkaç saniye içinde "10 kredi eklendi." görünmeli; rozet 10 ücretli kredi göstermeli.
3. Bir dönüşüm yapın: sonuçta ProToolHub işareti olmamalı (önce ücretli kredi harcanır).
4. Polar sandbox panelinde bu siparişe kısmi iade yapın (ör. $1.00): krediler orantılı ve yukarı yuvarlanarak düşmeli (10 × 100 / 399 → 3 kredi).
5. Yeni bir 10'luk paket alın, birkaç kredisini harcayın, sonra tam iade yapın: bakiye 0'a iner, eksi olmaz, ve `OPERATOR_ALERT_EMAIL` adresine "Cartoonify: iade sonrası kredi açığı" e-postası gelir.
6. Polar → Webhooks → Deliveries sayfasında tüm teslimatlar 2xx olmalı. 10 başarısız teslimattan sonra Polar uç noktayı kapatır; öyle olursa sorunu giderip elle yeniden açın.

## F. Polar CANLI (yalnız "yayına al" demeden önce)

1. `https://polar.sh` üzerinde canlı organizasyonu açın; Polar'ın hesap incelemesini ve ödeme (payout) hesabını tamamlayın. Canlıda gerçek kartla deneme alımı yapmayın (Polar bunu "card testing" sayar).
2. B.2–B.5'i canlıda tekrarlayın: vergi dahil fiyat, aynı üç ürün ($3.99, $9.99, $19.99), yalnız `checkouts:write` yetkili Organization Access Token, webhook: `https://cartoonify-steel.vercel.app/api/polar/webhook` (canlı alan Vercel Authentication arkasında değildir; bypass sırrı gerekmez), Raw, 2026-10, aynı dört olay.
3. Aynı yedi değişkeni bu kez **Production** için ekleyin: `vercel env add <AD> production --scope homeca-lc` — canlı token, canlı webhook sırrı, canlı ürün kimlikleri, `RESEND_API_KEY`, `OPERATOR_ALERT_EMAIL`. Production'da bu ikisi zorunludur; eksikse satış ve webhook kapalı kalır (503).
4. `cartoon.protoolhub.net` alan adı geldiğinde (0025) canlı webhook adresini ona göre güncelleyin.

## G. Bilmeniz gerekenler

- **Chargeback (ters ibraz):** Polar ayrı bir "dispute" olayı göndermez. Polar ters ibraz sinyali alınca çoğu zaman siparişi kendisi iade eder; bu iade bize normal iade olayı olarak gelir ve krediler düşülür. Polar'ın iade kaydı oluşturmadan kaybettiği bir itiraz bize ulaşmaz: Polar'ın e-postalarını izleyin, gerekirse krediyi elle düzeltin.
- **API sürümü:** kod Polar API'sinin `2026-10` sürümüne sabitlenmiştir. Bu sürüm yaklaşık Nisan 2027'nin başında kaldırılır; Mart 2027'den önce sürüm yükseltme görevi açılmalı.
- Webhook en geç birkaç saniyede yanıt verir; Polar başarısız teslimatı 10 kez yeniden dener. Aynı sipariş iki kez kredilenmez, aynı iade iki kez düşülmez.
