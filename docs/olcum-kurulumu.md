# Ölçüm kurulumu: GA4, Google Ads ve Meta piksel

Bu belge, sitedeki üç ölçüm aracını nasıl açacağınızı adım adım anlatır:

- GA4 (Google Analytics 4): ziyaretleri ölçer.
- Google Ads: reklamların kayıt ve satın alma sonuçlarını ölçer.
- Meta piksel: Facebook ve Instagram reklamlarının sonuçlarını ölçer.

Teknik bilgi gerekmez. Her adımı sırayla yapın.

## Önce bilmeniz gerekenler

1. Bu araçlar yalnızca ziyaretçi "Kabul et" derse yüklenir.
2. Ziyaretçi "Reddet" derse hiçbir ölçüm kodu yüklenmez.
3. Ziyaretçinin seçimi 12 ay geçerlidir. 12 ay sonra çerez bandı yeniden çıkar.
4. Bir değeri boş bırakırsanız o araç hiç yüklenmez. Site hata vermez.
5. Girdiğiniz kimlikler sitenin kaynağında herkese açık olarak görünür. Gizli anahtar değildir. Yine de bu belgeye, bir yazışmaya ya da koda gerçek değer yazmayın. Değerleri yalnızca Vercel'e girin.

## Adım 1: GA4 mülkü ve web veri akışı

1. Google Analytics'i açın (analytics.google.com). Google hesabınızla girin.
2. Sol alttaki "Yönetici" (Admin) bölümüne gidin.
3. "Mülk oluştur" (Create property) butonuna basın.
4. Mülke bir ad verin. Ad serbesttir, örneğin "Cartoon".
5. Mülk oluşunca "Veri akışları" bölümünden "Web" seçin.
6. Sitenin açık adresini yazın. Adres https:// ile başlamalıdır.
7. Veri akışını kaydedin.
8. Ekranda "Ölçüm Kimliği" (Measurement ID) görünür. Bu, G- ile başlayan kimliktir.
9. Bu kimliği kopyalayın. Bir sonraki adıma geçin.

Bu kimlik, Vercel'de NEXT_PUBLIC_GA4_ID adıyla girilecektir.

## Adım 2: Google Ads dönüşüm eylemleri (kayıt ve satın alma)

Bu adımda iki ayrı dönüşüm eylemi oluşturacaksınız. Her birinin kendi etiketi olur. Etiketleri birbirine karıştırmayın.

1. Google Ads'i açın (ads.google.com). Hesabınızı seçin.
2. Sağ üstteki "Araçlar ve Ayarlar" (Tools and settings) simgesine basın.
3. "Ölçüm" (Measurement) altında "Dönüşümler" (Conversions) bölümünü açın.
4. "Yeni dönüşüm eylemi" butonuna basın ve "Web sitesi" seçin.
5. Sitenin adresini girin ve etiket kurulumu ekranına geçin.
6. Etiket ekranında "AW-" ile başlayan kimliği bulun. Bu, Google Ads kimliğidir.
7. Bu kimliği kopyalayın. Vercel'de NEXT_PUBLIC_GOOGLE_ADS_ID adıyla girilecektir.

Şimdi ilk dönüşüm eylemi: kayıt.

8. Eylemin adı: "kayıt". Kategori olarak "Kayıt" (Sign-up) seçin.
9. Sayım ayarını kendiniz seçin. Site, her yeni kayıtta bir kez bilgi gönderir.
10. Kaydedin. Etiket ekranında, "AW-" kimliğinden sonra "/" işaretinin devamındaki etiketi kopyalayın.
11. Bu etiket, Vercel'de NEXT_PUBLIC_GADS_LABEL_SIGNUP adıyla girilecektir.

Şimdi ikinci dönüşüm eylemi: satın alma.

12. Eylemin adı: "satın alma". Kategori olarak "Satın alma" (Purchase) seçin.
13. Kaydedin. Etiketi kopyalayın. Bu, satın alma etiketidir.
14. Bu etiket, Vercel'de NEXT_PUBLIC_GADS_LABEL_PURCHASE adıyla girilecektir.

## Adım 3: Meta piksel

1. Meta Events Manager'ı açın (Etkinlik Yöneticisi). Meta işletme hesabınızla girin.
2. "Bağla" (Connect data sources) bölümünden "Web" seçin.
3. "Piksel" seçin ve pikselinize bir ad verin.
4. Piksel oluşunca ekranda bir sayı görünür. Bu piksel kimliğidir. Yalnızca rakamlardan oluşur.
5. Bu sayıyı kopyalayın. Vercel'de NEXT_PUBLIC_META_PIXEL_ID adıyla girilecektir.

Kurulum ekranında çıkan kod parçasını sitenize yapıştırmayın. Site kodu hazırdır. Yalnızca kimliği kopyalamanız yeterlidir.

## Adım 4: Vercel'e beş değişkeni girin

Vercel'de cartoonify projesini açın. Sol menüden "Settings" (Ayarlar), sonra "Environment Variables" (Ortam değişkenleri) bölümüne gidin.

Beş değişkenin adı şu yazımla girilmelidir:

1. NEXT_PUBLIC_GA4_ID: G- ile başlayan GA4 kimliği.
2. NEXT_PUBLIC_GOOGLE_ADS_ID: AW- ile başlayan Google Ads kimliği.
3. NEXT_PUBLIC_GADS_LABEL_SIGNUP: kayıt dönüşümünün etiketi.
4. NEXT_PUBLIC_GADS_LABEL_PURCHASE: satın alma dönüşümünün etiketi.
5. NEXT_PUBLIC_META_PIXEL_ID: Meta piksel kimliği, yalnızca rakamlar.

Beşinin de türü "Config" (yapılandırma) değeridir. Bunlar gizli değer değildir. Girerken "Sensitive" (hassas, gizli) kutusunu işaretlemeyin.

Önce Preview (Önizleme) ortamına girin:

1. Ortam olarak "Preview" seçin.
2. Beş değişkeni tek tek ekleyin.
3. Her birini kaydedin.
4. Adların yazımını bir kez daha kontrol edin. Harf büyüklüğü önemlidir.

Canlı (Production) değerleri, önizlemede test ettikten sonra ve sizin onayınızla girilir. Canlı değerleri şimdi girmeyin.

Sonraki adım: Adım 5.

## Adım 5: Yeniden deploy (zorunlu)

Değişkenleri eklemek tek başına yetmez. Bu değerler sitenin derlenmesi sırasında sayfaya yazılır. Değişkenleri değiştirdikten sonra siteyi yeniden deploy etmeniz gerekir.

1. Vercel'de "Deployments" (Dağıtımlar) sekmesini açın.
2. Önizleme için en son dağıtımı bulun.
3. Yanındaki üç noktaya (⋯) basın ve "Redeploy" (Yeniden dağıt) seçin.
4. Dağıtımın bitmesini bekleyin. Bitmeden test yapmayın.

Yeniden deploy yapmazsanız değişiklik sitede görünmez. Canlı için aynı işlem yalnızca canlı onayınızdan sonra yapılır.

Sonraki adım: Adım 6.

## Adım 6: Önizlemede test

Testten önce tarayıcıda sitenin kayıtlı verilerini temizleyin ya da gizli pencere açın. Böylece çerez bandı yeniden çıkar.

Test A: "Reddet"

1. Önizleme adresini açın.
2. Klavyede F12 tuşuna basın. Açılan pencerede "Network" (Ağ) sekmesini seçin.
3. Sayfayı yenileyin.
4. Çerez bandında "Reddet" butonuna basın.
5. Ağ listesinde googletagmanager.com ve facebook.net adreslerine giden hiçbir istek olmamalıdır.
6. Sayfayı yenileyin. Bant bir daha çıkmamalıdır. İstek yine olmamalıdır.

Test B: "Kabul et"

1. Testi yeni bir gizli pencerede yapın.
2. Önizleme adresini açın. Çerez bandında "Kabul et" butonuna basın.
3. Ağ listesinde googletagmanager.com (gtag/js) ve facebook.net (fbevents.js) isteklerini görmelisiniz.
4. Google etiketlerini kontrol etmek için Google Tag Assistant (tagassistant.google.com) kullanın. Önizleme adresini girin ve GA4 ile Google Ads etiketlerinin göründüğünü doğrulayın.
5. Meta pikselini kontrol etmek için Meta Pixel Helper tarayıcı eklentisini kullanın. Pikselin sayfada bulunduğunu doğrulayın.

Test C: Satın alma

1. Satın alma testini yalnızca Stripe test kartıyla yapın.
2. Gerçek kartla test yapmayın.
3. Ödeme tamamlandıktan sonra site bilgiyi yalnızca ödeme onaylandığında gönderir. Ödeme onaylanmadan satın alma bilgisi gönderilmez.

Test D: Çerez seçiminizi değiştirme

1. Sayfanın altındaki "Çerez ayarları" düğmesine basın. Bant yeniden açılır.
2. "Reddet" seçin ve sonraki sayfaya geçin. Ağ listesinde etiket isteği olmamalıdır.

## Sık görülen durumlar

1. Etiket yüklenmiyor: önce beş değişkenin adını kontrol edin. Adın bir harfi bile yanlışsa değer yok sayılır.
2. Değişkenler girildi ama sitede görünmüyor: yeniden deploy yapmadınız. Adım 5'e dönün.
3. Reddet dediniz ama bir etiket hâlâ çalışıyor: Kabul ettiğiniz bir sayfa açıksa, o sayfadaki etiketler sayfa kapanana kadar çalışmaya devam eder. Sonraki sayfa yüklemesinde hiçbir şey yüklenmez.
4. Bir değer boşluklarla girildi: site başındaki ve sonundaki boşlukları otomatik temizler. Yine de kontrol edin.

## Sitenin gönderdiği bilgiler

- Kayıt tamamlandığında: GA4 "sign_up", Google Ads kayıt dönüşümü, Meta "CompleteRegistration".
- Ödeme başlatıldığında: GA4 "begin_checkout", Meta "InitiateCheckout".
- Ödeme onaylandığında: GA4 "purchase", Google Ads satın alma dönüşümü, Meta "Purchase". Her ödeme Stripe ödeme oturumu kimliğiyle gönderilir. Google Analytics ve Google Ads bu kimliği işlem kimliği, Meta ise olay kimliği olarak kullanır; bu kimlik, araçların aynı ödemeyi iki kez saymasını önlemek için kullanılır. Ayrıca aynı tarayıcı aynı ödemeyi iki kez göndermez; son 20 ödemeyi hatırlar.
- Hiçbir olayda ad, e-posta adresi, telefon numarası ya da kullanıcı kimliği gönderilmez.

## Kaynaklar

- Adımlar: .mavci/tasks/0032-measurement-consent.md (bölüm 3.6, bölüm 5 kriter 6, bölüm 7).
- Değişken okuma: lib/env.ts (measurementIds).
- Etiket ve olay kodu: lib/analytics.ts.
- Çerez bandı ve düğmeler: components/consent.tsx, lib/i18n/tr.ts (consent).
- Alt bilgideki "Çerez ayarları" düğmesi: components/site-footer.tsx.
