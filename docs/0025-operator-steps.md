# Görev 0025 — Yayına hazırlık: operatör adımları

Bu belgede hiçbir gizli değer yoktur. Anahtarları ve şifreleri yalnız siz, ilgili ekrana yazarsınız; hiçbir dosyaya ya da sohbete yazmayın.

## A. Maskot (ücretli, sizin onayınızla)

1. Asistan `scripts/render-mascot.mjs --plan` çıktısını gösterir: dört aday (A, B, C, D), tahmini maliyet yaklaşık 0,48 USD ve "PLAN HASH". Görevin üst sınırı 0,90 USD'dir; betik bu sınırı aşacak bir çağrıdan önce durur.
2. Onay verirseniz dört görsel üretilir: `assets/mascot/0025/A.png` … `D.png`.
3. Birini seçin. Beğenmediğiniz bir adayı tek başına yeniden ürettirebilirsiniz (yaklaşık 0,12 USD).
4. Seçimden sonra web dosyaları ücretsiz yazılır: `public/brand/mascot-480.webp` ve `public/brand/mascot-240.webp`.

## B. Alan adı: cartoon.protoolhub.net

### B1. Vercel

1. vercel.com → takım **homeca-lc** → proje **cartoonify** → Settings → Domains.
2. "Add Domain" → `cartoon.protoolhub.net` yazın → ortam olarak **Production** seçin → Add.
3. Vercel bir DNS kaydı gösterir: tür **CNAME**, ad `cartoon`, değer olarak Vercel'in verdiği hedef (genellikle `cname.vercel-dns.com` ya da projeye özel bir `...vercel-dns...` adresi). Bu değeri bir sonraki adımda olduğu gibi kullanın.

### B2. Cloudflare DNS

1. dash.cloudflare.com → `protoolhub.net` alanı → DNS → Records → "Add record".
2. Type: **CNAME**. Name: `cartoon`. Target: Vercel'in gösterdiği hedef. TTL: Auto.
3. Proxy status: **DNS only** (gri bulut). Neden: Vercel SSL sertifikasını kendisi üretir ve trafiği kendi ağında karşılar; turuncu bulut (proxy) açıkken sertifika doğrulaması ve önbellek çakışabilir, Vercel de proxy kullanılmamasını önerir.
4. Kaydedin. Vercel'deki Domains ekranında alan adının yanında "Valid Configuration" görünene kadar bekleyin (genellikle birkaç dakika). SSL sertifikası kendiliğinden gelir.
5. Mevcut `cartoonify-steel.vercel.app` adresi çalışmaya devam eder; silmeyin.

## C. Canlıya geçiş listesi (bu sırayla)

Her değişken Vercel → cartoonify → Settings → Environment Variables ekranında, **Production** ve **Preview** için ayrı ayrı girilir. Komut satırını tercih ederseniz: `npx vercel env add <AD> production --scope homeca-lc` (değeri komut sorduğunda yazın). Aşağıda yalnız adlar vardır.

### C1. Production değişkenleri

| Ad | Production | Preview |
|---|---|---|
| `SUPABASE_URL` | gerekli | gerekli (aynı proje) |
| `SUPABASE_ANON_KEY` | gerekli | gerekli |
| `SUPABASE_SERVICE_ROLE_KEY` | gerekli (yalnız sunucu; asla `NEXT_PUBLIC_` ile başlamaz) | gerekli |
| `ABUSE_HASH_SECRET` | gerekli, **Preview'dakinden farklı** yeni rastgele bir değer | kendi değeri |
| `OPENAI_API_KEY` | gerekli | gerekli |
| `POLAR_ACCESS_TOKEN` | **canlı** Polar token'ı | sandbox token'ı |
| `POLAR_WEBHOOK_SECRET` | **canlı** webhook'un gizli değeri (C2) | sandbox webhook'unun değeri |
| `POLAR_PRODUCT_10`, `POLAR_PRODUCT_30`, `POLAR_PRODUCT_75` | **canlı** ürün kimlikleri (C2) | sandbox ürün kimlikleri |
| `RESEND_API_KEY` | gerekli (Production'da yoksa ödeme kapanır) | isteğe bağlı |
| `OPERATOR_ALERT_EMAIL` | gerekli (Production'da yoksa ödeme kapanır) | isteğe bağlı |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | gerekli (Production'da yoksa dönüşüm kapanır) | isteğe bağlı (yoksa test anahtarı kullanılır) |
| `UPSTASH_REDIS_REST_URL` ve `UPSTASH_REDIS_REST_TOKEN` **ya da** `KV_REST_API_URL` ve `KV_REST_API_TOKEN` | biri gerekli | biri gerekli |
| `NEXT_PUBLIC_SITE_URL` | `https://cartoon.protoolhub.net` | boş bırakın |

- `ABUSE_HASH_SECRET` için yeni değeri kendi bilgisayarınızda üretin, örneğin `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`, çıktıyı yalnız Vercel'deki kutuya yapıştırın.
- **Upstash/KV kontrolü:** Vercel → Storage ekranında Redis/KV veritabanının Production ortamına bağlı olduğunu görün; Environment Variables listesinde yukarıdaki iki çiftten birinin Production için tanımlı olduğunu doğrulayın.
- **Turnstile:** Cloudflare → Turnstile → bu sitenin widget'ı → Hostname Management'a `cartoon.protoolhub.net` ekleyin.
- Production'a **girmeyin:** `POLAR_API_BASE_URL`, `RESEND_API_BASE_URL`, `TURNSTILE_SITEVERIFY_URL` (yalnız testler içindir).

### C2. Polar canlı hesap

1. polar.sh (sandbox değil) → kuruluşunuz → Products: üç tek seferlik ürün oluşturun: 10 kredi $3.99, 30 kredi $9.99, 75 kredi $19.99. Kimliklerini `POLAR_PRODUCT_10`, `POLAR_PRODUCT_30`, `POLAR_PRODUCT_75` olarak Production'a girin.
2. Settings → Developers → "Organization Access Token" oluşturun (0023'teki izinlerle: en az `checkouts:write`). Değeri `POLAR_ACCESS_TOKEN` olarak Production'a girin.
3. Settings → Webhooks → "Add Endpoint": URL `https://cartoon.protoolhub.net/api/polar/webhook`, Format **Raw**, olaylar `order.paid`, `order.refunded`, `refund.created`, `refund.updated`. Gizli değeri `POLAR_WEBHOOK_SECRET` olarak Production'a girin.
4. İade kuralınız Polar'da da aynı olmalı: 14 gün, paketten hiç ücretli kredi kullanılmadıysa. İadeyi Polar panelinden siz yaparsınız; site krediyi kendiliğinden düşer.

### C3. Google ile giriş

1. Google Cloud Console → APIs & Services → Credentials → mevcut OAuth istemcisi. "Authorized redirect URIs" içinde Supabase'in adresi (`https://ltjwsmiycijxrqxjsphq.supabase.co/auth/v1/callback`) kalsın; site adresi buraya eklenmez.
2. OAuth consent screen → App domain: ana sayfa `https://cartoon.protoolhub.net`, gizlilik `https://cartoon.protoolhub.net/privacy`, koşullar `https://cartoon.protoolhub.net/terms`; Authorized domains: `protoolhub.net`. Uygulama "Testing" durumundaysa "Publish app" ile yayına alın; aksi halde yalnız test kullanıcıları girebilir.
3. Client ID ve Client Secret, Supabase → Authentication → Providers → Google ekranında durur. Yeni bir istemci oluşturduysanız ikisini oraya girin (Vercel'e değil).

### C4. Supabase adresleri

1. Supabase → proje `ltjwsmiycijxrqxjsphq` → Authentication → URL Configuration.
2. **Redirect URLs** listesinde `https://cartoon.protoolhub.net/**` olduğunu görün; yoksa ekleyin. `https://cartoonify-steel.vercel.app/**` ve önizleme adresleri kalsın.
3. **Site URL'ye dokunmayın.**

### C5. Site adresi

- Kodda `DEFAULT_SITE_URL` bu görevle `https://cartoon.protoolhub.net` oldu. C1'deki `NEXT_PUBLIC_SITE_URL` aynı değeri Production için açıkça verir; ikisi aynı olmalıdır.

### C6. Yayına alma

1. A–C bitince bana **"yayına al"** deyin. Production'a ancak o zaman gönderilir: `npx vercel --prod --scope homeca-lc`. Asistan `vercel --prod` komutunu kendiliğinden çalıştırmaz.
2. Yayından sonra kontrol: `https://cartoon.protoolhub.net/` İngilizce, `/tr` Türkçe; `/en/workshop` adresi `/workshop`'a, `/kvkk` adresi `/tr/kvkk`'ya yönlenir; Google ile giriş yapın; en küçük paketi gerçek kartla alın, krediyi görün, sonra Polar panelinden iade edin ve kredinin düştüğünü görün; uyarı e-postasının geldiğini doğrulayın.
3. Yasal sayfalar hâlâ "REVIEW REQUIRED" taslağıdır; bir avukat incelemeden işaret kaldırılmaz.
