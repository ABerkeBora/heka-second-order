# Second Order V2 — sabah teslimi

**Durum: gerçek hedef doğrulama ve agent fonlaması çalışıyor; son settlement/claim henüz PENDING.** V2, kullanıcının istediği varlık/olay/yön/zaman/AND-OR hedefini doğrular; bulunamayan hedef yerine başka varlığa pozisyon açmaz. Pilot, müşteri veya gelir iddiası yok. Bu dosya fonlama snapshot'ını anlatır; dört tamper ve responsive kontroller geçti; finality ve son yayın kanıtı sonradan gerçek sonuçla güncellenmeli.

## Açma ve korunmuş V1

- [V1](http://localhost:3101/) — eski çalışan akış ve geçmiş gerçek receipt'ler.
- [V2](http://localhost:3101/next) — katı hedef kontrolü ve yeni izole pozisyonlar.

İkisi aynı sunucuda, aynı **3101** portunda. Çalışan süreç varsa ikinci sunucu açmayın. Durmuşsa proje dizininde `npm run build` ve `npm start`; temiz kurulum `npm ci`, `forge build`, `.env.example` üzerinden özel `.env`, ardından build/start. Ayrıntılar [README](README.md) içinde. Paylaşılan Ollama `qwen3:4b` ve yalnız izole Base Sepolia test rolleri kullanılır; anahtarlar UI/model/repo'ya girmez.

V1, [`v1-baseline`](https://github.com/ABerkeBora/heka-second-order/tree/v1-baseline) / `8bfd72c…` ile sabit; [BASELINE_V1](BASELINE_V1.md) korunuyor. V2 branch'i **codex/next**; API `/api/next`, private runtime `.runtime/next`, evidence `evidence/v2/`. V1'in tamamlanmış 31 receipt'i ve eski state'i korunuyor. Aynı test rollerinin nonce'ları için tek global sıra/PID lock var; ayrı uygulama süreçleri başlatılmamalı. V2 farklı market ve teminat tokenı kullanıyor. Son branch push/temiz clone ve finish gate root tarafından devam ediyor; yayımlanmış tamamlanma sonucu henüz iddia edilmiyor.

## Kullanıcı değeri ve kapsam

Desteklenen örnek: **`Ethereum Up OR Solana Up in the same next 5-minute window.`** İki ayrı varlığın yönü açık, tek AND/OR ve 5/15 dakika gerekli. **Next**, bounded keşif havuzunda iki varlığın ortak, henüz başlamamış en erken uygun penceresidir; Polymarket genelinde eksiksiz arama değildir. Desteklenen alias ve dar dil [INTENT_GRAMMAR](docs/INTENT_GRAMMAR.md) içinde.

Ham hedef deterministic parse edilir; katalogda tam çift bulunur; gerçek model ayrıca normalize/öneri üretir; bağımsız matcher varlık, exact event title, outcome sırası/index, condition ID, slug/title süreleri, absolute endDate, ortak pencere ve operatörü yeniden kontrol eder. Kaynak proof'ları setup öncesinde tekrar alınır. Modelin ret veya yanlış normalize etmesi **no-action** üretir; mümkün bir hedefte model false negative olabilir. Genel doğal dil/NLP veya her prediction event'i destekleniyor denmiyor.

Hedef metni değişirse eski review/proposal ile yetki verilemez. Yetki verilmeden önce asset, recipient, beneficiary, tek/toplam integer stake, funding expiry, daha sonraki automation expiry, işlem sayısı, gas ve API fee cap'leri görünür. İlk yetkiden sonra agent gerçek funding'i başlatır; model keyfî destination/asset/calldata seçmez.

## Gerçek V2 fonlaması

Ağ **Base Sepolia / 84532**. [Market](https://sepolia.basescan.org/address/0x7d34c8ac853eaceba1306f626420bc7fe36b3442); [V2 SOU tokenı](https://sepolia.basescan.org/address/0xac32bd83e88540c4509845ad7add0c3969d5df51). SOU altı decimal ve değersiz test teminatıdır; ücretsiz Gamma verisine x402 ücreti uydurulmadı.

- Intent `30e23be6-245b-42ee-ba34-3dd314aafe57`; proposal `9f16f2f2-3f6d-4bd1-a13f-022199fad70c`.
- Gerçek **qwen3:4b / 17,259 saniye**: ham hedefle aynı ETH Up OR SOL Up, beş dakika. Kaynaklar Ethereum **6406433** ve Solana **6406432**; pencere **31 Ekim 04:05–04:10 UTC / 05:05–05:10 Europe/Berlin**.
- İlk tarayıcı yetkisi sonrası buyer agent [YES 1,00 SOU fonladı](https://sepolia.basescan.org/tx/0x20b50e2c70cb32247320c17f66984c3c12e30d6946dc75314bad85d569163abc); ayrı seed edilmiş test karşı tarafı [NO 1,00 SOU fonladı](https://sepolia.basescan.org/tx/0xb29698970677045a0676f2a18e817ef28a0e29eeb802aeab22d93dfd47fa075e).
- Fonlama snapshot'ında **11 confirmed V2 transaction, 2,00 SOU reserve**. Mandate tek/toplam `1000000` birim, tek funding action, sekiz agent transaction; gas/API cap ve iki expiry ilk yetkide kayıtlı. [funding-live.json](evidence/v2/funding-live.json), [model kaydı](evidence/v2/llm-intent-0698af68-c000-4c8f-8535-8c6ad65e6d2c.json), [receipt listesi](evidence/v2/transactions.json).
- **Finality, settlement ve claim PENDING.** Bu reserve tahsilat veya kâr değildir. V1'in eski başarılı payout'u yeni V2 payout kanıtı diye kullanılmıyor.

## Doğrulananlar ve kalan teknik kapılar

| Kontrol | Durum / kanıt |
| --- | --- |
| Whole-week hedefi, ayrı yok-event hedefi | **PASS**, gerçek HTTP çağrıları: `UNSUPPORTED_WINDOW` ve Cardano/ETH için `NO_CATALOG_MATCH`; deploy/mint/approval/fund yok, V1/V2 receipt/pozisyon/teminat ve native bakiyeler değişmedi. [no-action-live.json](evidence/v2/no-action-live.json) |
| Değişmiş hedefle eski onayı kullanma | **PASS**, gerçek HTTP **400**, journal/pozisyon değişmedi: [dirty-authorization-live.json](evidence/v2/dirty-authorization-live.json) |
| Contract/teminat/policy | **56/56 PASS**, runtime/artifact, doğru V2 tokenı, signer/hash/iki kaynak/operatör/index/pencere ve bağımsız normalization: [contract-verification.json](evidence/v2/contract-verification.json) |
| Birim ve backend guard testleri | **46 unit PASS**, ayrıca üretim next/engine/store modüllerinin izole fixture testinde **20/20 PASS**, source drift setup öncesinde reddediliyor. [unit-tests.txt](evidence/v2/unit-tests.txt), [backend-gates.json](evidence/v2/backend-gates.json). Fixture'lar gerçek LLM veya zincir ödemesi değil |
| Namespace ve V1 uyumluluğu | **PASS**, context, farklı receipt/journal, tek sıra/lock; V1 safety/recovery/yerel Anvil refund regresyonları: [namespace-test](evidence/v2/namespace-test.json), [compatibility](evidence/v2/namespace-compatibility.json) |
| Gerçek fonlanmış süreç restart'ı | **PASS**, aynı 11 hash, yeni stake yok, reserve 2 SOU: [restart-funded-live.json](evidence/v2/restart-funded-live.json) |
| V2 dört deployed tamper + duplicate/budget/state | **7/7 PASS**: edited, gerçek stale, wrong request, wrong key; ayrıca duplicate intent, bütçe ve değişmeyen korunan state. [V2 rejection kaydı](evidence/v2/rejections-30e23be6-245b-42ee-ba34-3dd314aafe57.json). Salt okunur deployed RPC; broadcast/revert gas iddiası yok. Hatalı envelope UI içinde işlem/ücret olmadan reddedildi |
| Final kaynaklar → settlement → collection/refund | **PENDING**, sabit request/deadline içinde agent takip ediyor |
| Canlı V1/V2 izolasyonu | **44/44 PASS**, block **52487936**: V1 aynı 31 hash, buyer/counterparty eski SOU bakiyesi 5/5, eski reserve 0. [isolation-live.json](evidence/v2/isolation-live.json) |
| Responsive üretim QA | **PASS**, 1440/768/390 px, font ≥11 px, gradient/yatay taşma yok, tablet/phone küçük control yok. Tablet paneller 367,99/340 px, phone 354/354 px. [browser-qa.json](evidence/v2/browser-qa.json), `evidence/v2/screenshots/`; V1 gerçek 2 SOU claim ekranı da yeniden görüldü |
| Son source push/temiz clone + finish rule check | **PENDING**, root kapanış kontrolünde; kural tablosu [TRACK_REQUIREMENTS_V2](TRACK_REQUIREMENTS_V2.md). Settlement/claim bekleyişi ayrıca yukarıda açık |

## Karşılaştırma ve öneri

| | V1 | V2 |
| --- | --- | --- |
| Kullanıcı hedefi | Gösterilen alternatif sepet ilk yetkiden önce incelenebilir | Tam iki varlık/yön/olay/pencere/AND-OR eşleşir; alternatif pozisyon açılmaz |
| Kanıt | Tamamlanmış 2/0 SOU OR payout, sabit baseline | Gerçek exact-target fonlama, no-action ve gate/isolation/rejection kanıtları PASS; son payout henüz PENDING |
| Sunum seçimi | Korunan çalışan geri dönüş noktası | Son kaynak/tahsilat ve yayın kapıları da geçerse **V2 önerilir**; müşteri faydası hedef dışı fonlamayı engellemesidir |

**Demo riski: orta.** Canlı kaynak finality/cache/API erişimi ve yerel modelin kabul/ret davranışı zamanlamayı etkiler; model yanlış ret verebilir ve uygulama no-action kalır. Bu mühendislik riski, müşteri doğrulamasıyla karıştırılmamalı: pilot, ödeme yapan müşteri, gerçek gelir veya talep kanıtı yok. V1'i riskli bir yeniden koşu için bozmayın.

## Güven ve kullanım sınırları

İmza exact request'in kaynağını/bütünlüğünü kanıtlar; upstream gerçekliği, cache tutarlılığı veya kâr garantisi değildir. Envelope zamanı ile kaynak güncellemesi ayrı kontrol edilir. Yanlış/eksik/stale/split veri escrow'u serbest bırakmaz; yalnız sabit deadline void/refund yolu kalır. Yeni keyfî API listing'i, BSV/bridge veya production non-custodial wallet iddiası yok.

Server yalnız izole test anahtarları tutar. Stake, recipient/beneficiary ve funding cap/expiry/intent contract'ta; gas, agent transaction sayısı ve automation expiry yerel executor'da enforce edilir. Rollup ücretleri tahmindir, zincir üstü mutlak gas cap değildir. Otomatik top-up yok. Yerel journal/RPC/normal finality güven varsayımları sürer; derin reorg kurtarması kanıtlanmadı.

## Sunum ve teslim

[150 saniyelik V2 sunum taslağı](docs/PRESENTATION_V2.md), [V2 submission copy](docs/SUBMISSION_V2.md) hazır. **Video PENDING; yarışma girişi gönderilmedi.** Kullanıcı tek takım submission'ında hangi projeyi göndereceğini seçer; en fazla üç partner track. Son tarih **31 Ekim 2026 15:00 Europe/Berlin**; root final kural kontrolünü kaydedecek. Fonlama ile settlement'ı karıştırmayın; kalan zorunlu maddeler PASS diye sunulmamalı.
