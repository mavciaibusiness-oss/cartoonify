# Görev 0024 — Profil sayfası, hesap silme ve iki yeni kategori: operatör adımları

Bu belgede hiçbir gizli değer yoktur; anahtarları yalnız siz, ilgili ekrana yazarsınız.

## A. Önizleme görselleri (ücretli, sizin onayınızla)

1. Asistan size iki plan gösterir: 1. parti Evcil Hayvan Portresi (10 görsel), 2. parti Avatar (10 görsel). Her birinin tahmini maliyeti yaklaşık 0,22 USD'dir; toplam yaklaşık 0,44 USD. Görevin üst sınırı 0,80 USD, parti başına 0,40 USD'dir; betik bu sınırı aşacak bir çağrıdan önce durur.
2. Her parti için planı ve "PLAN HASH" değerini okuyun, onay verin. Onaysız hiçbir görsel üretilmez.
3. Üretilen görsellere `assets/trials/0024/` klasöründen bakın. Beğenmediğinizi tek tek yeniden ürettirebilirsiniz (her biri yaklaşık 0,02 USD). Beğendiğinizde partiyi kabul edin.
4. Mevcut 100 stilin önizlemeleri değişmez; yalnız 20 yeni görsel eklenir.

## B. Veritabanı (doğrulamadan sonra)

1. **Yedek alın** (0023'teki gibi, depo klasörünün dışına; her komutta `--project-ref ltjwsmiycijxrqxjsphq`).
2. **Ön kontrol:** spec'teki `precheck-0024` sorgusunu SQL Editor'de çalıştırın. Dört satır görmelisiniz: `polar_checkouts_user_id_fkey | c`, `polar_orders_user_id_fkey | c`, `org_members user_id | uuid`, `owner_can_read | true`. Farklıysa durun ve asistana söyleyin.
3. **Migration:** `supabase/migrations/20261029000000_protoolhub_account.sql` dosyasını okuyun, sonra Supabase MCP `apply_migration` ile (proje `ltjwsmiycijxrqxjsphq`) ya da SQL Editor'e yapıştırarak çalıştırın. **Asla `supabase db push`, asla `db reset`.** Migration yalnız `protoolhub` şemasını değiştirir; `leadgen.org_members` tablosunu yalnız okur.
4. **Kontrol:** `supabase/checks/0024_live_catalog.sql` dosyasını çalıştırın: **sıfır satır** dönmeli. (0023'ün kontrolü artık iki yeni işlevi "unexpected" diye gösterir; bu beklenir.)

## C. Hesap silme nasıl çalışır

- Kullanıcı Profil sayfasında "Hesabımı sil" der, ne silineceğini okur ve "Evet, hesabımı kalıcı olarak sil" ile onaylar.
- Silinenler: profil, krediler (ücretli dahil), kredi ve dönüşüm geçmişi, hoş geldin kaydı; ardından giriş hesabı ve e-posta adresi.
- Kalanlar: e-posta adresinin geri çevrilemez özeti (aynı adrese ikinci kez ücretsiz kredi verilmez) ve kişiye bağlı olmayan Polar sipariş/iade kayıtları (sipariş no, tutar, tarih). Silmeden sonra gelen bir iade yalnız kaydedilir; kredi düşülecek hesap yoktur.
- Kişi Firma Bulucu üyesiyse yalnız Cartoonify kayıtları silinir; giriş hesabı kalır.
- Giriş hesabı silinemezse (Firma Bulucu'da kişinin adına başka kayıtlar varsa) Cartoonify kayıtları yine silinir, kişi çıkış yapar ve "iletişim sayfasından bize yazın" mesajını görür. Vercel günlüklerinde `account-delete: auth delete failed` satırını arayın; giriş hesabını Supabase panelinden elle silin ya da kişiye durumu açıklayın. Bu satırda e-posta yoktur, yalnız hesap kimliği vardır.
- Silme sırasında süren bir dönüşüm varsa kişiden bir dakika sonra tekrar denemesi istenir.

## D. Önizlemede deneme

1. Atma bir hesapla giriş yapın, bir dönüşüm yapın.
2. Üst menüde "Profil" görünmeli. Profilde kredileri, satın alma ve dönüşüm geçmişini (görsel yok) görün; "Türkçe / English" bağlantılarını deneyin.
3. Atölyede kategori sekmeleri tek satırda olmalı; telefonda yana kaydırılmalı, sayfa yana taşmamalı. "Evcil Hayvan Portresi" ve "Avatar" sekmelerinde 10'ar stil görünmeli.
4. Hesabı silin: "Hesabınız silindi." görünmeli ve oturum kapanmalı. Aynı adresle tekrar giriş yapınca ücretsiz kredi verilmemeli.
5. Kendi Firma Bulucu hesabınızla silme denemesi yapmayın (Cartoonify kredileriniz silinir).
