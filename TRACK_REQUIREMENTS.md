# Second Order — track ve kanıt kontrolü

Seçilen partner track **API3**. BSV koşullu kapısı geçmedi ve seçilmiyor; Cardano kapsam dışı. Uygulama ve canlı entegrasyon tamamlandı. **Video ve kullanıcının Devfolio gönderimi PENDING** olduğu için bütün yarışma teslim şartları tamamlandı denmiyor.

## Resmî kaynak ve zaman

- API3: https://hackathon.tum-blockchain.com/prizes#api3
- Genel teslim: https://hackathon.tum-blockchain.com/prizes#how-to-submit
- Starter: https://github.com/api3dao/airnodehub-hackathon-starter ; kullanılan commit `52933ae1fb9371446a927338473466c3d320e19a`.
- Entegrasyonlar: https://api3dao.github.io/airnodehub-hackathon/docs/integrations
- Contract rehberi: https://api3dao.github.io/airnodehub-hackathon/docs/from-api-to-contract
- Projection: https://api3dao.github.io/airnodehub-hackathon/docs/projections
- Başlangıç kontrolü: 31 Ekim 2026, yaklaşık 03:39 Europe/Berlin; doğru API3 tabı, Qualification, What to submit, Judging, Examples ve genel submission tabı tarayıcıda seçilip okundu. Starter ve ilgili rehberler uygulamadan önce incelendi.
- **Son kural yeniden kontrolü: 31 Ekim 2026 04:51–04:53 Europe/Berlin.** Gerçek tarayıcıda API3 tabı `aria-selected=true` ile doğrulandı, submission/judging bölümleri açıldı; genel How to submit tabı ayrıca okundu. Başlangıç şartlarıyla fark görülmedi. Önceki 03:59–04:01 kontrolü de kayıtta korunuyor: `evidence/rules-check.json`. Varsayılan BSV içeriği API3 yerine alınmadı.
- Genel deadline doğrulandı: **31 Ekim 2026 15:00 Europe/Berlin**. Takım başına **tek submission**, en fazla üç partner track; TUM değerlendirmesi otomatik. Yedi build yedi başvuru anlamına gelmez. Bu chat başvuru göndermedi.

## Zorunlu API3 teknik qualification

| Gereklilik | Uygulama ve gerçek kanıt | Durum |
| --- | --- | --- |
| Oracle çıkarılırsa ana iş bozulmalı | Açılış, her stake ve sonuç kararı yalnız pinli Airnode proof'larıyla mümkün; `contracts/SecondOrderMarket.sol`, canlı fund ve settlement receipt'leri | PASS |
| İmzalı cevap deployed contract'a ulaşmalı | Base Sepolia 84532, [nihai OR contract](https://sepolia.basescan.org/address/0x9de37bba7dbc2cb50dffc1c77e6941e68e17356a); `evidence/contract-verification-final.json`: runtime/artifact ve tüm policy alanları için 72/72 PASS | PASS |
| Signer ve tam istek bağı enforce edilmeli | Kaynak başına sabit signer, create/settlement request hash; `evidence/policy-d2f44402-9601-4516-b69a-3ec40360c842.json`; bağımsız request-hash türetimi ve exact error ile wrong-key/different-request reddi | PASS |
| İlgili zamanlar denetlenmeli | Envelope 300 s, source 900 s, future toleransı 30 s, immutable pencere/deadline; source updatedAt ile signature ayrı; stale gerçek response reddi, yerel sınır testleri | PASS |
| İmzalı değer anlamlı ekonomik state üretmeli | Ethereum 6406061 ve Solana 6406069 Up kazandı; OR sonucu YES. [Settlement](https://sepolia.basescan.org/tx/0x8219fc21db0ade623bdcd3f4b81f8429c06526d3531199921dcb511ea6b284aa) ve [buyer 2 SOU claim](https://sepolia.basescan.org/tx/0xfa707e07383cd999e92539b563f7c8efd2bbefe7c7c88850b1775ec2b584cf14); counterparty 0, reserve 0 | PASS |
| Tekrarlanan execution korunmalı | On-chain consumed intent ve claimed flag; gerçek restart'ta tx/hash kümesi değişmedi; `evidence/restart-reconciliation-final.json`: nihai OR koşusu claimed, reserve 0, transaction sayısı/hash kümesi değişmedi; kontrat testleri | PASS |

## Zorunlu API3 teslim kanıtları

| Teslim maddesi | Kanıt / kalan iş | Durum |
| --- | --- | --- |
| Contract adresi ve ağ | README, MORNING_HANDOFF, yukarıdaki Base Sepolia adresi | PASS |
| Jürinin kendi response'unu sunabilmesi | UI Inspect evidence; ham signed bytes alanı; `scripts/submit-response.ts` ve README komutları. Backend crypto ön kontrolünü atlayıp contract guard'a ulaşır | PASS |
| Dört adversarial red durumunun teknik kanıtı | `evidence/rejections-a359938e-b769-4a8e-afbe-37556ab50e86.json`: edited, stale, different-request, wrong-key için doğru custom error. Deployed RPC guard çağrıları; ayrıca gerçek imzalarla 29 Foundry test. RPC çağrısı broadcast edilmiş revert tx değildir | PASS |
| Videoda geçerli eylem + dört red gösterimi | Gerçek işlem/response/UI kanıtları hazır, `docs/PRESENTATION.md` 150 sn akış hazır; bitmiş video yok | PENDING |
| Veri kullanıcısı, forgery zararı, bulunamayan veri açıklaması | `docs/SUBMISSION.md`: buyer/counterparty, yanlış payout riski; eksik winner/finality alanları ve cache farkları | PASS |

## Genel submission teslimleri

| Madde | Kanıt / kalan iş | Durum |
| --- | --- | --- |
| Public source ve setup/run README | [ABerkeBora/heka-second-order](https://github.com/ABerkeBora/heka-second-order), PUBLIC ve ABerkeBora author/committer doğrulandı; `evidence/publication.json`. Temiz GitHub clone b7c24c7… install/contract build/production build/start PASS: `evidence/clean-clone.json`. Son evidence/doküman kapanış push'u root tarafından tamamlanıyor | PASS |
| En fazla 150 sn video | Kullanıcının kaydetmesi ve süre/link kontrolü gerekiyor; outline hazır | PENDING |
| Devfolio'da ayrıntılı açıklama ve giriş | `docs/SUBMISSION.md` hazır; hangi projenin tek takım submission'ı olacağını kullanıcı seçip gönderir, bu görev gönderim yetkisi içermiyor | PENDING |
| Deadline ve track seçimi | Son kontrol yukarıda; kullanıcı 15:00 öncesinde gönderim yapmalı | PENDING |

## Kullanıcının ayrı ürün kabul şartları

| Şart | Kanıt | Durum |
| --- | --- | --- |
| Gerçek runtime LLM + bağımsız validator | qwen3:4b, 9.640 sn; nihai Ethereum/Solana OR önerisi ve bağımsız allowed-source/schema kontrolü; `evidence/llm-d2f44402-9601-4516-b69a-3ec40360c842.json`; 20 Node güvenlik testi. XRP yokluğunda Solana alternatifi yetkiden önce açıkça incelendi; katı doğal-dil hedef eşleştirmesi V2 kuyruğunda | PASS |
| İlk bounded yetki sonrası gerçek agent fonlama | Buyer 1 SOU [fund](https://sepolia.basescan.org/tx/0x3bf41978c6469812f555b127e4a231bcc24ca89263249ef1b62615b530af8ef8), ayrı counterparty 1 SOU fund; tüm funding/automation expiry, max 8 transaction, asset/recipient/beneficiary/cap alanları ilk işlemden önce kaydedildi. `evidence/final-mandate-funding.json`, `evidence/intent-a359938e-b769-4a8e-afbe-37556ab50e86.json` | PASS |
| Agent settlement ve claim/refund başlatmalı | İki gerçek final proof ve iki claim; nihai OR koşusunda buyer YES 2 SOU, counterparty NO 0, reserve 0. Gerçek Anvil engine testinde unmatched pool otomatik void/refund PASS: `evidence/unmatched-refund-test.json` (yerel, public-chain refund değil) | PASS |
| Duplicate/cap ve restart güvenliği | Exact deployed RPC error; `evidence/restart-reconciliation-final.json` gerçek yeniden başlatmada aynı 31 tx/hash ve reserve 0. Ayrı `test:recovery` SIGKILL/mock-RPC testi aynı raw/hash ile tek execution; expiry sonrası yeni hazırlama/broadcast reddi | PASS |
| Yerel 3101, özgün UI, build/test/browser | Production bundle; 29 contract + 256 fuzz, 20 Node, mock recovery, typecheck/build. Nihai full-mandate OR settlement ekranı 1440/768/390 px gerçek tarayıcı kontrolü PASS; yatay taşma yok, tablet/phone küçük control yok: `evidence/browser-qa.json`, `evidence/screenshots/` | PASS |
| README/env/lockfile/sunum/sabah teslimi | Repo içindeki kendi dosyaları; parent dosya/anahtar bağımlılığı yok | PASS |

## Jüri tercihleri ve opsiyoneller

Kullanışlılık, özgünlük ve teknik uygulama değerlendirme tercihidir; ayrı zorunlu özellik listesi değildir. Agent'ın veri seçmesi ve tekrarlayan on-chain davranışı gösterilir. Seçilen Gamma çağrıları ücretsizdir; ücretli x402 kullanımı uydurulmaz. BSV/native verifier/bridge veya production wallet entegrasyonu iddia edilmiyor.

## Açık sınırlar

Video/giriş PENDING maddeleri MORNING_HANDOFF'ta taşınır. Source signer doğruluğu, upstream gerçeklik/cache tutarlılığını garanti etmez. Server test key'leri, yerel gas/automation limitleri ve rollup fee tahmini açıkça application trust alanındadır. Deep reorg recovery kanıtlanmadı. Canlı timeout refund gerekmedi; refund yolu 29 Foundry testi ve üretim engine'iyle çalışan gerçek özel Anvil unmatched-refund testiyle kanıtlandı, public-chain refund tx diye sunulmaz.

## Birincil ve tarihsel koşu ayrımı

Birincil son kabul kanıtı nihai yetki şemasıyla `a359938e-b769-4a8e-afbe-37556ab50e86` OR koşusudur: Ethereum/Solana, buyer 2 SOU, counterparty 0, reserve 0. İlk Ethereum/XRP AND koşusu `29e88761-5cee-43d0-8a87-4b1ac50b9752` gerçek ve tamamlanmış ikincil entegrasyon kanıtıdır (NO, buyer 0/counterparty 2). İlk şemada başlangıçta bulunmayan açık automation expiry/transaction-count alanları geçmişe eklenmez. `docs/LIVE_RUNS.md` ve MORNING_HANDOFF ayrımı kaydeder. Nihai policy 72/72 ve pinli vendor kaynak/lisansları 535/535 SHA-256 karşılaştırması PASS; `evidence/contract-verification-final.json`, `evidence/vendor-integrity.json`.
