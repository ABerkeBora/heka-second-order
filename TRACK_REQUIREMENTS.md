# Second Order — track ve kanıt kontrolü

Seçilen partner track **API3**. BSV koşullu kapısı geçmedi ve seçilmiyor; Cardano kapsam dışı. Uygulama ve canlı entegrasyon tamamlandı. **Video ve kullanıcının Devfolio gönderimi PENDING** olduğu için bütün yarışma teslim şartları tamamlandı denmiyor.

## Resmî kaynak ve zaman

- API3: https://hackathon.tum-blockchain.com/prizes#api3
- Genel teslim: https://hackathon.tum-blockchain.com/prizes#how-to-submit
- Starter: https://github.com/api3dao/airnodehub-hackathon-starter ; kullanılan commit `52933ae1fb9371446a927338473466c3d320e19a`.
- Entegrasyonlar: https://api3dao.github.io/airnodehub-hackathon/docs/integrations
- Contract rehberi: https://api3dao.github.io/airnodehub-hackathon/docs/from-api-to-contract
- Projection: https://api3dao.github.io/airnodehub-hackathon/docs/projections
- Başlangıç kontrolü: 31 Ekim 2026, yaklaşık03:39 Europe/Berlin; doğru API3 tabı, Qualification, What to submit, Judging, Examples ve genel submission tabı tarayıcıda seçilip okundu. Starter ve ilgili rehberler uygulamadan önce incelendi.
- **Son kural yeniden kontrolü: 31 Ekim 2026 03:59–04:01 Europe/Berlin; kayıt zamanı 2026-10-31 04:03 CET.** Sayfa yeniden yüklendi, genel tab ve API3 tabı ayrıca seçildi, submission/judging/examples bölümleri açıldı. Başlangıç şartlarıyla fark görülmedi. Varsayılan BSV içeriği API3 yerine alınmadı.
- Genel deadline doğrulandı: **31 Ekim 2026 15:00 Europe/Berlin**. Takım başına **tek submission**, en fazla üç partner track; TUM değerlendirmesi otomatik. Yedi build yedi başvuru anlamına gelmez. Bu chat başvuru göndermedi.

## Zorunlu API3 teknik qualification

| Gereklilik | Uygulama ve gerçek kanıt | Durum |
| --- | --- | --- |
| Oracle çıkarılırsa ana iş bozulmalı | Açılış, her stake ve sonuç kararı yalnız pinli Airnode proof'larıyla mümkün; `contracts/SecondOrderMarket.sol`, canlı fund ve settlement receipt'leri | PASS |
| İmzalı cevap deployed contract'a ulaşmalı | Base Sepolia84532, [nihai contract](https://sepolia.basescan.org/address/0x80249acd6afd72d4d2826b788b0e972848a073e4); `evidence/contract-verification.json` deployed runtime/artifact eşleşmesi | PASS |
| Signer ve tam istek bağı enforce edilmeli | Kaynak başına sabit signer, create/settlement request hash; `evidence/policy-4d4e246c-afd0-4847-a324-698891409d16.json`; exact error ile wrong-key/different-request reddi | PASS |
| İlgili zamanlar denetlenmeli | Envelope300s, source900s, future toleransı30s, immutable pencere/deadline; source updatedAt ile signature ayrı; stale gerçek response reddi, yerel sınır testleri | PASS |
| İmzalı değer anlamlı ekonomik state üretmeli | Ethereum Up kaybetti, XRP Up kazandı; AND sonucuNO. [Settlement](https://sepolia.basescan.org/tx/0xba469def95fb56a83df2e63d18a84f7f74666f0c333de6cb445491600920ad85) ve [counterparty2SOU claim](https://sepolia.basescan.org/tx/0xef5fcb107d5f291adc4f656873c06f52345c189122efc6d020393bb277c488f9); reserve0 | PASS |
| Tekrarlanan execution korunmalı | On-chain consumed intent ve claimed flag; gerçek restart'ta tx/hash kümesi değişmedi; `evidence/restart-reconciliation.json`, kontrat testleri | PASS |

## Zorunlu API3 teslim kanıtları

| Teslim maddesi | Kanıt / kalan iş | Durum |
| --- | --- | --- |
| Contract adresi ve ağ | README, MORNING_HANDOFF, yukarıdaki Base Sepolia adresi | PASS |
| Jürinin kendi response'unu sunabilmesi | UI Inspect evidence; ham signed bytes alanı; `scripts/submit-response.ts` ve README komutları. Backend crypto ön kontrolünü atlayıp contract guard'a ulaşır | PASS |
| Dört adversarial red durumunun teknik kanıtı | `evidence/rejections-29e88761-5cee-43d0-8a87-4b1ac50b9752.json`: edited, stale, different-request, wrong-key için doğru custom error. Deployed RPC guard çağrıları; ayrıca gerçek imzalarla29 Foundry test. RPC çağrısı broadcast edilmiş revert tx değildir | PASS |
| Videoda geçerli eylem + dört red gösterimi | Gerçek işlem/response/UI kanıtları hazır, `docs/PRESENTATION.md`150sn akış hazır; bitmiş video yok | PENDING |
| Veri kullanıcısı, forgery zararı, bulunamayan veri açıklaması | `docs/SUBMISSION.md`: buyer/counterparty, yanlış payout riski; eksik winner/finality alanları ve cache farkları | PASS |

## Genel submission teslimleri

| Madde | Kanıt / kalan iş | Durum |
| --- | --- | --- |
| Public source ve setup/run README | [ABerkeBora/heka-second-order](https://github.com/ABerkeBora/heka-second-order); doğru hesap/noreply kimliğiyle publish; son commit/clone sonucu MORNING_HANDOFF'ta | PENDING |
| En fazla150sn video | Kullanıcının kaydetmesi ve süre/link kontrolü gerekiyor; outline hazır | PENDING |
| Devfolio'da ayrıntılı açıklama ve giriş | `docs/SUBMISSION.md` hazır; hangi projenin tek takım submission'ı olacağını kullanıcı seçip gönderir, bu görev gönderim yetkisi içermiyor | PENDING |
| Deadline ve track seçimi | Son kontrol yukarıda; kullanıcı15:00 öncesinde gönderim yapmalı | PENDING |

## Kullanıcının ayrı ürün kabul şartları

| Şart | Kanıt | Durum |
| --- | --- | --- |
| Gerçek runtime LLM + bağımsız validator | qwen3:4b,15.574sn; gerçek Ethereum/XRP adayları; `evidence/llm-4d4e246c-afd0-4847-a324-698891409d16.json`;20 Node güvenlik testi | PASS |
| İlk bounded yetki sonrası gerçek agent fonlama | Buyer1SOU [fund](https://sepolia.basescan.org/tx/0x9a1e7fdf5e3f064cb12b9cb4f6432ee90087c34793a4c26fc285d837b08e014c), ayrı counterparty1SOU fund; intent/validator/receipt/delivery `evidence/intent-29e88761-5cee-43d0-8a87-4b1ac50b9752.json` | PASS |
| Agent settlement ve claim/refund başlatmalı | İki final proof ve iki gerçek claim; buyer kaybedenYES0, counterpartyNO2; ücret/teminat birbirinden ayrı | PASS |
| Duplicate/cap ve restart güvenliği | Exact on-chain RPC error; gerçek süreç restart'ında yeni tx yok; ayrı `test:recovery` SIGKILL/mock-RPC testi aynı raw/hash ile tek execution | PASS |
| Yerel3101, özgün UI, build/test/browser | Production bundle;29 contract+256fuzz,20 Node, mock recovery, typecheck/build; `evidence/browser-qa.json`,1440/768/390 gerçek screenshot'ları | PASS |
| README/env/lockfile/sunum/sabah teslimi | Repo içindeki kendi dosyaları; parent dosya/anahtar bağımlılığı yok | PASS |

## Jüri tercihleri ve opsiyoneller

Kullanışlılık, özgünlük ve teknik uygulama değerlendirme tercihidir; ayrı zorunlu özellik listesi değildir. Agent'ın veri seçmesi ve tekrarlayan on-chain davranışı gösterilir. Seçilen Gamma çağrıları ücretsizdir; ücretli x402 kullanımı uydurulmaz. BSV/native verifier/bridge veya production wallet entegrasyonu iddia edilmiyor.

## Açık sınırlar

Video/giriş PENDING maddeleri MORNING_HANDOFF'ta taşınır. Source signer doğruluğu, upstream gerçeklik/cache tutarlılığını garanti etmez. Server test key'leri, yerel gas/automation limitleri ve rollup fee tahmini açıkça application trust alanındadır. Deep reorg recovery kanıtlanmadı. Canlı timeout refund gerekmedi; refund yolunun kanıtı yerel contract testidir, canlı tx diye sunulmaz.
