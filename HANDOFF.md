> Historical reviewed implementation brief (03:28 preparation). The implementation is now built and verified; use README.md, TRACK_REQUIREMENTS.md and MORNING_HANDOFF.md for current status and evidence.

# Second Order — proje handoff'u

## Durum ve karar sınırı

**Bu dosya uygulama için somut bir öneridir; uygulama henüz başlatılmadı.** Kullanıcı tüm handoffları birlikte inceleyip hangi uygulama chatlerini açacağını seçecek. Uygulama kodu, Git deposu ve ürün işlemleri oluşturulmadı; ortak test erişimi/fonlama hazırlığı aşağıda ayrı kaydedildi. Qualification uygulama maddelerinin tamamı PENDING.

- Ana track: API3, “Any API in your contract”.
- Koşullu ek aday: BSV; aşağıdaki bir saatlik kapı dışında vaat edilmez.
- Yerel klasör: `/Users/wargly/Documents/ChatGPT/Heka/projects/second-order`.
- Port: `3101`.
- Önerilen repo: `ABerkeBora/heka-second-order`; henüz oluşturulmadı. GitHub connector ve CLI girişi ABerkeBora için doğrulandı; bu projenin repo creation/push işlemi henüz yapılmadı.
- İnceleme hedefi: 31 Ekim 2026, 08.00–09.00 Europe/Berlin; uygulama seçildiğinde kalan süreye göre yeniden planlanır.
- Model tercihi: GPT-6.1 Sol / ultra. UI İngilizce; çalışma ve sabah handoff'u Türkçe.
- Teslim: yerel çalışan uygulama + ayrı public repo. Hosted yayın kapsamda değil.

## Müşteri, ürün ve değer

İlk müşteri hipotezi, birden fazla olayın birlikte gerçekleşmesine pozisyon almak isteyen prediction-market kullanıcısı ve onun adına piyasa araştıran agent geliştiricisidir. Bu hipotez henüz müşteri görüşmesiyle doğrulanmadı.

**Ürün cümlesi:** “Agent'a sınırlı test bütçesi ve birleşik olay hedefi ver; iki Polymarket sonucuna bağlı pozisyonu senin adına fonlasın, sonucu sabit kanıtla tahsil etsin.”

Örnek: A ve B ayrı Polymarket piyasalarıdır. Yeni ürün, “A ve B'nin seçili outcome'ları birlikte kazanacak mı?” veya “En az biri kazanacak mı?” sorusuna YES/NO pozisyonu açar. Dayanak, Polymarket'in kendi kesinleşmiş sonuçlarıdır. Ürün, bu sonuçların dış dünyadaki doğruluğunu bağımsız kanıtladığını iddia etmez.

API3, platformun veya karşı tarafın kendi lehine değiştirebileceği ham API cevabı yerine önceden seçilmiş Airnode'un tam belirlenmiş isteğe verdiği cevabı sözleşmeye taşır. Sözleşme veriyi doğrulayıp kendi AND/OR kuralını uygular. İmza kaynak/bütünlük kanıtıdır; Polymarket'in oracle, cache veya yanlış sonuç riskini ortadan kaldırmaz.

## Sabit MVP

- Yalnız iki binary Polymarket piyasası; yalnız AND ve OR. Üçüncü piyasa ve serbest formüller yok.
- Agent gerçek LLM çağrısıyla aday havuzundan iki piyasa ve AND/OR önerir. Kullanıcının ilk bütçe/yetki onayından sonra bağımsız validator'dan geçen pozisyonu gerçekten fonlar; öneri ekranı tek başına tamamlandı sayılmaz.
- Piyasa kimliği, condition ID, outcome sırası ve seçilen outcome indeksleri onaylanır. Modelin uydurduğu ID veya alan kabul edilmez.
- Değersiz test tokenıyla YES/NO stake havuzu. AMM, order book veya piyasa yapıcı gerekmiyor.
- Kanıtı herkes gönderebilir. Doğrulanan iki nihai kayıt, kilitli doğruluk tablosuyla tek seferlik sonucu belirler.
- Kazanan test pozisyonları claim edilir. Eksik, tartışmalı veya desteklenmeyen sonuç için önceden belirlenmiş void/refund uygulanır.
- Fixture senaryoları geliştirme/test içindir; ayrı işaretlenir ve gerçek qualification kanıtı yerine geçmez.

Kapsam dışı: Polymarket'e gerçek emir vermek, Polymarket kullanıcı hesabı bağlamak, kaldıraç, borçlanma, cross-chain teminat, yeni bir bridge, keyfî API endpoint'i, modelin keyfî Solidity/predicate yazması, BSV entegrasyonunun hazırmış gibi sunulması.

## Kullanıcı akışı ve ekranlar

1. **Markets:** agent önerisi almak veya desteklenen açık kaynak piyasaları seçmek. Gösterilen fiyatlar kaynak veridir; birleşik piyasa için sahte “AI probability” hesaplanmaz. Bağımsızlık varsayılarak olasılıklar çarpılmaz.
2. **Compose basket:** iki kaynak kartı, seçilen outcome ve dört satırlık AND/OR doğruluk tablosu. Her kartta kaynak operasyonu, kapanış/gözlem zamanı ve eksik veride ne olacağı görünür. Ana işlem “Authorize agent budget”; side, azami stake ve bitiş zamanı aynı policy'de okunur.
3. **Market detail:** agent'ın doğrulanmış pozisyon fonlaması, kalan bütçe, kaynakların ayrı finality durumları ve claim/refund kaydı. “Submit evidence” / “Claim payout” manuel kurtarma yolu olarak kalır; ana gösterimde agent bu işlemleri başlatır. “Settled” yalnız doğrulanmış zincir olayıyla gösterilir.

Tek uygulama, koyu nötr brokerage görünümü ve amber veri vurgusu. İlk ekranın ayırt edici nesnesi kaynak sepeti ve doğruluk tablosudur; sıradan dört KPI kartlı dashboard değildir. TasteSkill app-screen yolu uygulanır. Mobilde sepet kartları üst üste gelir; tablo kendi alanında okunabilir kalır. Test ağı bir kez açıkça belirtilir; her yerde “demo” yazmaz.

## Gerçek LLM zorunluluğu

Planlanan çalışma anı erişimi:

```text
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen3:4b
```

Root Ollama ve modeli hazırladı; **31 Ekim 03:06:57 Europe/Berlin'de gerçek structured-output çağrısı 6,71 saniyede geçti**. Kanıt `docs/evidence/llm-preflight.json` içinde: girdiler fixture market ID'leri, şema/allowed IDs/AND predicate kontrol edildi. Bu, runtime hazırlığını doğrular; gerçek Polymarket kayıtlarıyla ürün entegrasyonunu, contract veya ödemeyi doğrulamaz. İlk uygulama smoke'unda gerçek adaylarla model cevabı yeniden alınmalı.

LLM girdisi, gerçek discovery sonucundan seçilmiş sınırlı adaylar ve izin verilen AND/OR şemasıdır. Çıktı; `marketIds`, `selectedOutcomeIndexes`, `operator`, kısa gerekçe ve kaynak referansları içeren yapılandırılmış öneridir. Ağ/varlık adresi, kontrat fonksiyonu, signer veya arbitrary URL model tarafından belirlenmez. Bağımsız validator kimlikleri ve tipleri, iki ayrı piyasa olmasını, açık/gelecek olayları, kural ve zaman sınırlarını kontrol eder. Hatalı öneri reddedilir; en fazla sınırlı format düzeltme denemesi yapılır. Sabit örnek veya regex önerisi, LLM çalışmış gibi sayılmaz. Prompt/cevap provenance'ı secretsiz kaydedilir.

Agent öneri ve kanıt toplama kararı verir; ödeme anahtarları model belleğine/prompt'una verilmez. Aday verideki talimatlar prompt injection sayılır, yetki değildir.

## Agentic payment: yetki, ödeme ve teslim

Bu bölüm kullanıcının ürün şartıdır; API3'ün resmî qualification maddesiyle ayrı izlenir. **Payer**, sınırlı test teminatı verilmiş kullanıcı/agent rolü; **ilk recipient**, yalnız izinli market contract'ı; **son beneficiary**, policy'de sabit pozisyon sahibidir. Satın alınan şey birleşik sonuca bağlı test pozisyonudur. Ücretsiz Polymarket operation'ı için sahte x402 faturası üretilmez.

Kullanıcı bir kez chain/token/izinli factory, AND/OR şablonu, side, azami tek stake/toplam stake, gas limiti, en fazla bir pozisyon ve expiry içeren mandate verir. Model yalnız izinli aday/şablonu seçer; executor adres ve calldata'yı registry'den üretir. Test cüzdanı sınırlı fonlanır, token allowance'ı sınırlıdır; uygulama içi limit ile contract'ın enforce ettiği limiti ayrı belirt. Yeni session-key/bridge altyapısı yazılmaz. İlk mandate sonrası gerçek `create/fund position` transaction'ını agent gönderir; her adımı kullanıcının tıklamasıyla ilerleyen ekran tamamlanmış agent payment değildir.

Tek intent ID; restart/timeout'ta önce chain receipt ve mevcut stake uzlaştırılır. Aynı intent tekrar stake oluşturamaz. Agent finality'yi izler, geçerli kanıtı gönderir ve sabit beneficiary için claim/refund başlatır; kaynak/predicate/alıcıyı değiştiremez. Bütçe biterse durur, otomatik top-up yok. Geçersiz öneri veya kanıtla korunan stake/rezerv hareket etmez.

Ek ürün kanıtı: gerçek model çağrısı → validator kararı → agent'ın test stake transaction'ı → gerçek receipt; ardından over-budget veya duplicate intent reddi ve bakiye/pozisyonun değişmemesi. Kullanıcıya görünür ödeme günlüğü bu dört adımı aynı intent altında gösterir.

## API işlemleri ve gözlenmiş smoke

Resmî endpoint: `https://airnode-polymarket.fly.dev/`. Ücretsiz discovery isteği:

```json
{"operation":"listMarkets","parameters":{"limit":1,"closed":true,"order":"closedTime","ascending":false}}
```

Bu POST isteğinden HTTP 200 ve `airnode`, `requestHash`, `timestamp`, `data`, `signature` içeren envelope gözlendi. **Bağımsız ECDSA/request-hash doğrulaması çalıştırılmadı.** Bu gözlem yalnız endpoint erişimi ve cevap biçimi kanıtıdır.

HTTP 200 alınmış tek kayıt projection örneği:

```json
{
  "operation":"getMarketById",
  "parameters":{"id":"6420703"},
  "responseProjection":{
    "marketId":"/id",
    "conditionId":"/conditionId",
    "closed":"/closed",
    "status":"/umaResolutionStatus",
    "outcomes":"/outcomes",
    "outcomePrices":"/outcomePrices",
    "updatedAt":"/updatedAt"
  }
}
```

Bu exact isteğin gözlenen hash'i `0x9ceb5fc9dabf483cda1d6c5e50ed8c94a9900cb403571814f064a152969f1892`. Metadata'daki signer `0xbb451127f6d8B2bAEfB9ddFb7c724DAc38Eb9D2E`; uygulama başında resmî metadata üzerinden yeniden kontrol edilip güven kökü olarak sabitlenir. Envelope içindeki adres tek başına güven kökü değildir.

**Somut tuzaklar:**

- Aynı ID, `listMarkets` içinde `closed=true/status=resolved/[1,0]`, `getMarketById` içinde daha eski `updatedAt` ile `closed=false/status=proposed/[0.9995,0.0005]` döndü. İki cevabın da envelope'u imzalı görünüyordu. Fresh envelope timestamp, kaynak cache'inin güncel olduğunu kanıtlamaz.
- Açık üç market örneğinde `umaResolutionStatus` alanı yoktu; `umaResolutionStatuses` string `"[]"` idi. Eksik alan ile explicit JSON null farklıdır.
- `outcomes`, `outcomePrices`, `umaResolutionStatuses` JSON içeren string; array değildir. `/outcomePrices/0` projection'ı kullanılamaz. String içindeki diziyi ikinci adımda güvenli okumak gerekir.
- `winner` / `winnerId` gözlenen cevaplarda yoktu. Bir alan adını varsayarak payout yapma.
- `/closedTime`, listede vardı fakat tek kayıt cevabında yoktu; projection isteği 400 ve imzasız hata verdi. Missing pointer, imzalı yokluk kanıtı değildir.
- Bu tarihsel ID canlı market açmak için uygunluk kanıtı değildir. Ürün, geçmiş veya sonucu bilinen bir dayanağı yeni tahmin gibi sunmamalı.

## Başlangıç ve settlement policy

Her kaynak için iki ayrı request hash saklanır:

- **Create proof:** `getMarketById`, sabit ID ve `id`, `conditionId`, `closed`, `endDate`, `outcomes`, `updatedAt` projection'ı. Optional finality alanını burada zorunlu tutma. `closed=false`, gelecekte bitiş, taze imza ve kabul edilebilir kaynak güncellemesi gerektir. İki outcome tam olarak iki adet ve onaylanan sırada olmalı.
- **Settlement proof:** yukarıdaki finality projection'ı ve aynı kimlik/condition/outcome sırası. `status=resolved`, `closed=true` ve açık terminal payout dizisi gerektir. `closed` veya 0.9995 tek başına sonuç değildir. Split/ambiguous değerler MVP'de void olur.

Policy, ilk teminattan önce değiştirilemez biçimde kaydedilir: ID'ler, selected outcome indeksleri, AND/OR, signer'lar, her iki request hash, `tradeClosesAt`, çözüm gözlem penceresi, maksimum imza/kaynak yaşı, geleceğe timestamp toleransı, deadline ve void kuralı. Yönetici signer/request/predicate değiştiremez. Platformun veritabanı sonucu belirlemez.

İşlem kapanışı dayanakların beklenen en erken bitişinden önce olmalı. Erken finality görüldüğünde permissionless kanıtla işlem durdurulur. Her yeni pozisyon için kısa ömürlü açık-durum kanıtı değerlendirilir; kaynak cache'inin erken sonuç riskini tamamen kaldırdığı iddia edilmez. Kaynak alanları/timestamp yorumları smoke ile doğrulanmadan “manipülasyonsuz” pazarlama yapılmaz.

Settlement imza zamanı çözüm penceresinde, kaynak `updatedAt` kabul edilen aralıkta ve en az piyasanın başlangıcından sonraki geçerli durum için olmalı. Geçmiş cevabı yeniden imzalatmak yeterli değildir. Verinin güncellenme ritmi uygun değilse kaynak uygun aday sayılmaz. No-data, timeout, bir bileşenin desteklenmeyen/cancelled sonucu veya deadline'a kadar kesinleşmeme bütün sepeti void eder. Platform daha sonra keyfî YES/NO seçemez.

## Rezerv ve payout muhasebesi

Öneri: sıfır platform ücretli, test tokenıyla tam teminatlı pari-mutuel havuz. Sabit birim ve integer muhasebe kullan; float ile para hesaplama.

- Her piyasanın stake rezervi ayrı izlenir. Sözleşmenin toplam bakiyesi tek piyasanın rezervi sanılmaz.
- Piyasa aktifleşmeden iki tarafta da minimum stake gerekir; eksik taraf varsa kapanışta void/refund. Kazanan tarafta sıfır stake durumu tanımlı olmalı.
- Uçtan uca testte buyer agent'ın karşı tarafı, bu projeye ayrılmış ayrı `counterparty` test rolüdür. Seed/başlatma script'i ona değersiz collateral sağlar; bu rol kendi gerçek approval/stake transaction'ıyla karşı side'ı fonlar. Bu, gerçek müşteri talebi veya ikinci otonom agent diye sunulmaz. Buyer mandate'i karşı tarafın parasını harcayamaz; iki funding receipt'i ayrı gösterilir.
- Kazanan ödemesi toplam havuzun kazanan stake payına göre hesaplanır. Yuvarlama, remaining reserve ve son claim dust kuralı açıkça test edilir; toplam claim rezervi aşamaz.
- Void'da herkes kendi stake'ini bir kez geri alır. Market ücretleri ve gerçek ekonomik gelir kapsam dışıdır.
- Her kullanıcı/pozisyon için claim flag, her piyasa için tek settlement, checks-effects-interactions/reentrancy koruması. Yönetici fonu çekemez; unsolicited transfer muhasebeyi değiştirmez.

## Teknik başlangıç ve ilk 60 dakika

Başlangıç: resmî EVM starter commit `52933ae1fb9371446a927338473466c3d320e19a` araştırma sırasında görüldü. Uygulama başlayınca commit/dependency dosyalarını kontrol et, seçilen sürümü pinle. Hazır `AirnodeV2Attestation`, `ProjectedJson`, `IsoTimestamp` ve TypeScript hash/verify helper'larını kendi repoya denetlenmiş sürümden taşı. Framework seçimi bundan sonra, minimal full-stack TypeScript uygulaması olacak şekilde yapılabilir. Hiçbir paket henüz kurulmadı.

İlk 60 dakika uygulama başladıktan sonra sayılır:

1. 0–15: resmî kuralları yeniden oku; gerçek Ollama çağrısı ve structured proposal smoke'u.
2. 15–30: gerçek ücretsiz kayıt/projection; bağımsız `deriveRequestHash` + `verifySignedResponse`. Açık durum/finality alanlarının eksik ve string durumlarını gerçek cevaplarla kontrol et.
3. 30–50: en küçük EVM consumer ile gerçek imzalı cevabın on-chain kabulü; editleme, stale, wrong-request ve wrong-signer reddi. Testnet fonu ve RPC yolunu doğrula.
4. 50–60: ayrı counterparty test rolüyle iki taraflı fonlamayı kur; ilk mandate sonrası buyer agent'ın gerçek stake transaction'ını ve duplicate/over-budget reddini göster. İki record ve integer payout/void yolunun uygulanabilirliğine karar ver; request binding yoksa kapsamı daralt, riskli cross-chain işe geçme.

Yerel anvil testleri geliştirme kanıtıdır; API3 için gereken deployed testnet sözleşmesinin yerine geçmez. Bu projenin Base Sepolia hazırlığında deployer'a 0,01 test ETH, buyer ve counterparty'ye ayrı ayrı 0,001 test ETH, deployer/payer'a 1 aUSD sağlandı; receipt/balance kaydı `../../docs/evidence/testnet-preparation.json` içinde. Ollama runtime preflight'ı geçti, bu ürünün gerçek verili LLM yolu hâlâ PENDING. Bunlar setup kanıtıdır; deploy, ücretli veri çağrısı veya market settlement kanıtı değildir. User secrets istemeden ignored environment dosyaları hazırlanır; gerçek değerler handoff'a yazılmaz.

## BSV için en fazla bir saatlik koşullu kapı

BSV yalnız şu dört koşul aynı süre içinde gösterilirse ana plana eklenir: gerçek non-custodial DeFi akışı, standart BSV cüzdanıyla çalışan kullanıcı yolu, gerçek test işlem/agent ödemesi ve API3 kanıtının BSV settlement'ına nasıl bağlandığını açıkça belirleyen test edilmiş güven modeli. Resmî developer pack/pinli ts-stack kullanılmalı.

Backend'in API3 imzasını kontrol edip BSV işlemi imzalaması doğrudan BSV on-chain doğrulaması değildir. EVM sonucunu BSV'ye taşıyan relayer yeni güven varsayımıdır; sessizce eşdeğer gösterilemez. Geçen sürede verifier, cüzdan ve fon erişimi kanıtlanamazsa BSV etiketi/qualification iddiası eklenmez, API3 çekirdeği tamamlanır. Sıfırdan bridge yazılmaz. Kullanıcı BSV anahtarını modele vermez.

## Doğrulama ve tamamlanma kanıtları

- Geçerli response doğru kaynağın kilitli predicate'ini çalıştırır ve anlamlı testnet state/payout değişikliği oluşturur.
- Düzenlenmiş data, gerçek ama eski response, başka ID/operation/projection cevabı ve yanlış key imzası sözleşmede reddedilir. Her redde protected state ve reserve değişmez.
- Replay, aynı proof'un iki kere tüketilmesi, çift claim, yanlış outcome sırası, snapshot cache uyumsuzluğu, phase request-hash karışması, future timestamp, expired market, boş rezerv, unsupported split ve timeout refund test edilir.
- Judge kendi envelope'unu UI veya dokümante script ile doğrudan gönderebilir. Sadece backend'in ön kontrolüne güvenilmez.
- Production build, browser ana akış, 1440/768/390 görüntüler, README/start komutu, `.env.example`, lockfile ve gerçek contract/network/transaction linkleri sağlanır.
- Agent'ın gerçek LLM model adı, çağrı zamanı ve validator kararı görünür; model reasoning zinciri veya secrets yayımlanmaz.

## 2,5 dakikalık sunum

0:00–0:25 müşteri, ilk bounded mandate ve iki dayanak; 0:25–0:50 gerçek LLM'in sınırlı sepet önerisi ve immutable resolution card; 0:50–1:15 agent'ın gönderdiği gerçek stake, receipt ve ayrı counterparty fonlaması; 1:15–1:50 signed settlement ve agent claim/refund; 1:50–2:20 dört tamper reddi ve duplicate intent engeli; 2:20–2:30 kalan bütçe, explorer ve kaynak/trust sınırı. Canlı olayın bitmesini beklemek gerekiyorsa geçmiş gerçek imzalar test fixture'ı diye açıkça ayrılır; ekonomik olarak canlıymış gibi sunulmaz.

## Sabah handoff'u ve açık kararlar

`MORNING_HANDOFF.md` uygulama seçilip çalışıldıktan sonra oluşacak: açma komutu/port, repo, çalışanlar, requirement durumları, testnet kanıtları, LLM smoke sonucu, kalan erişimler, bilinen güven varsayımları ve en küçük sabah eylemleri. Şu anda implementation readiness PENDING'dir.

Kullanıcı incelemesinde onaylanacaklar: AND/OR sınırı; iki dayanak; integer havuz/payout kuralı; kullanılan kaynak freshness aralıkları; BSV kapısına ayrılacak en fazla bir saat; resmî doğrulayıcı ve funding yolunun önceliği. İsim ve görsel ince ayarları rutin kararla verilebilir.

Ortak modüller iki ürün arasında yalnız pinli paket veya sabit commit kopyasıyla paylaşılır. Bu chat kardeş proje dizinini değiştirmez. Bir bağımlılık bloklanırsa UI, source adapter ve testler gibi bağımsız yetkili işler tamamlanır; fixture ile “track complete” denmez.

## Kaynaklar ve okuma kaydı

- Resmî API3 ve genel submission maddeleri 31 Ekim 2026 **03:01 Europe/Berlin** tarihinde prize sayfasının ilgili API3 track verisi ayıklanarak kontrol edildi; varsayılan BSV metni API3 diye alınmadı: https://hackathon.tum-blockchain.com/prizes#api3 .
- https://api3dao.github.io/airnodehub-hackathon/docs/integrations#recommended-for-the-hackathon
- https://api3dao.github.io/airnodehub-hackathon/docs/projections
- https://airnodehub.api3.org/explore/polymarket ve `GET https://airnode-polymarket.fly.dev/` metadata.
- https://github.com/api3dao/airnodehub-hackathon-starter ve `src/airnode-v2.ts`.
- https://help.polymarket.com/en/articles/13364518-how-are-prediction-markets-resolved

Bu kaynaklar uygulama başlamadan ve bitmeden tekrar okunur. Ön araştırmadaki Polymarket HTTP gözlemleri kriptografik veya on-chain başarı kanıtı değildir. Root ayrıca Nodary `USDC/USD,USDT/USD` isteğinin hash ve signer'ını zincir dışında bağımsız doğruladı; bu farklı kaynağın setup kanıtıdır, Polymarket imza testinin veya testnet uygulamasının yerine geçmez.

Yerel test rol erişimi yalnız `/Users/wargly/Documents/ChatGPT/Heka/.local/projects/second-order/test-wallets.json` dosyasından alınır; ignored ve `0600`. `testOnly`/`chainId=84532` ile `roles.deployer/buyer/counterparty` şeması kontrol edilir. Secret değerler dokümana veya public repoya kopyalanmaz.

**Trust kartı:** upstream Polymarket Gamma/CLOB/Data API; pinlenecek Airnode signer `0xbb451127f6d8B2bAEfB9ddFb7c724DAc38Eb9D2E`. İmza, tam request'in cevabının bu Airnode'dan gelip değişmediğini doğrular; upstream finality, cache tutarlılığı, manipülasyonsuz piyasa veya dış dünyanın doğruluğu garantisi değildir. Uygulama başında metadata'yı yeniden okuyup signer'ı mevcut policy'ye kilitle.

**İki ayrı para kanıtı:** priced Airnode çağrısı varsa x402 veri ücreti **Base Sepolia aUSD** ile ödenir; ücretsiz Gamma operation'ları bu ödemeyi gerektirmez. Veri satın alma receipt'i ile market teminatı, settlement ve claim transaction'ları ayrı kaydedilir; birinin başarısı diğerini kanıtlamaz.

[Ortak erişim ve son hazırlık durumu](../../docs/ACCESS_STATUS.md) · [Sponsor materyalleri](../../docs/SPONSOR_MATERIALS.md) · [Gerçek LLM preflight kanıtı](../../docs/evidence/llm-preflight.json) · [Nodary zincir dışı preflight](../../docs/evidence/api3-preflight.json) · [Testnet setup kanıtı](../../docs/evidence/testnet-preparation.json). Secretsiz ilgili durum özeti public repo hazırlanırken proje dokümanına taşınır; root secret dosyaları yayımlanmaz.
