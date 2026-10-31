# Second Order V1 — sabah teslimi

**31 Ekim 2026, Europe/Berlin. V1'in gerçek ürün akışı tamamlandı:** runtime LLM → bağımsız validator → tarayıcıda ilk sınırlı yetki → agent fonlaması → iki imzalı kaynakla settlement → agent tahsilatı. Son kabul koşusu **OR / YES**, buyer **2,00 SOU**, counterparty **0 SOU**, reserve **0**. En fazla 150 saniyelik video henüz kaydedilmedi; yarışma başvurusu gönderilmedi.

## Açma

[Uygulamayı açın](http://localhost:3101). **Activity** içinde Ethereum/Solana OR pozisyonunu, **Evidence** içinde sabit policy ve rejection sonuçlarını inceleyin. Çalışan sunucu varsa ikinci süreç başlatmayın. Durmuşsa:

```sh
cd /Users/wargly/Documents/ChatGPT/Heka/projects/second-order
npm run build
npm start
```

Yeni checkout: Node 24+, Foundry; `npm ci`, `cp .env.example .env`, `forge build`, `npm run build`, `npm start`. Mevcut kanıtları/boş arayüzü incelemek için private environment kopyalanmaz. Yeni ekonomik koşu için Ollama `qwen3:4b`, güncel kaynaklar ve yalnız Base Sepolia test fonları gerekir. Ortak Ollama `http://127.0.0.1:11434` hazır; servisi yeniden başlatmayın veya modeli tekrar indirmeyin.

Yeni makinede `npm run wallets:create` çevrimdışı üç izole test rolü oluşturur; dosya `0600`, tekrar çalıştırma mevcut dosyayı ezmez. `.env` içindeki `WALLET_FILE` bu özel dosyaya işaret eder. Anahtarlar UI/model/repo'ya girmez. Mevcut çalışma alanının `.runtime/` journal ve state dosyalarını koruyun; eski kaynak ID'lerini yeni açık pozisyon gibi tekrar kullanmayın. [README](README.md), [sözleşme açıklaması](docs/CONTRACT.md) ve [executor sınırları](docs/EXECUTION_SAFETY.md) bağımsız kurulum/inceleme ayrıntılarını içerir.

## Ana kanıt: nihai yetki şemasıyla tamamlanan OR koşusu

Ağ **Base Sepolia / 84532**. [Market](https://sepolia.basescan.org/address/0x9de37bba7dbc2cb50dffc1c77e6941e68e17356a), intent `a359938e-b769-4a8e-afbe-37556ab50e86`. Teminat [SOU tokenı](https://sepolia.basescan.org/address/0x78f97e3b9b1b367f60355ddcc06fb157d7d33d08): altı decimal, değersiz, public-mint test birimi. Native test ETH gas ve varsa aUSD veri ücreti ayrı kalemlerdir; seçilen ücretsiz Gamma işlemlerine sahte x402 ücreti eklenmedi.

Gerçek `qwen3:4b` çağrısı **9,640 saniye** sürdü. Model, bounded adaylarda XRP bulunmadığını açıkça söyledi ve Ethereum `6406061` + Solana `6406069`, `Up/Up`, `OR` önerdi. **XRP→Solana değişikliği yetkiden önce görünür ve incelenmişti. V1 incelenen alternatife izin verir; bu koşu ilk doğal dil hedefini harfiyen karşıladı diye sunulmuyor.** [LLM kaydı](evidence/llm-d2f44402-9601-4516-b69a-3ec40360c842.json).

İlk ekonomik işlemden önce kaydedilen mandate: aynı asset/market/beneficiary, `1000000` birim tek/toplam stake (**1,00 SOU**), bir funding action, en fazla sekiz agent transaction; funding cutoff **04:19:15**, daha sonraki automation expiry **05:00** Europe/Berlin. Normal işlem gas cap'i `300000000000000` wei, toplam intent/rol cap'i `1500000000000000` wei; API fee cap'i **0**. İlk kayıt ve tarayıcı incelemesi [final-mandate-funding.json](evidence/final-mandate-funding.json), [yetki öncesi ekran](evidence/screenshots/final-mandate-before-authorization.jpg) içinde; bu snapshot fonlama anıdır, nihai sonuç ayrı completed intent'tedir.

| Gerçek geçiş | Explorer / sonuç |
| --- | --- |
| Buyer agent YES fonlaması | [1,00 SOU stake](https://sepolia.basescan.org/tx/0x3bf41978c6469812f555b127e4a231bcc24ca89263249ef1b62615b530af8ef8) |
| Ayrı counterparty NO fonlaması | [1,00 SOU stake](https://sepolia.basescan.org/tx/0xf1287b80e7b095956a21c8a1e5df1569b1e3f2d4da1cea95e6394ed01ef4360e); toplam reserve 2,00 SOU |
| Agent'ın Ethereum final kanıtı | [Kaynak 1](https://sepolia.basescan.org/tx/0x2b6cc219ece273ad874301dc798b885d34aabbdf88a57a0b29966a9cd5609086), seçili Up kazandı |
| Agent'ın Solana final kanıtı | [Kaynak 2](https://sepolia.basescan.org/tx/0x8219fc21db0ade623bdcd3f4b81f8429c06526d3531199921dcb511ea6b284aa), seçili Up kazandı; OR sonucu **YES** |
| Buyer tahsilatı | [2,00 SOU](https://sepolia.basescan.org/tx/0xfa707e07383cd999e92539b563f7c8efd2bbefe7c7c88850b1775ec2b584cf14) |
| Counterparty kaybeden claim'i | [0 SOU](https://sepolia.basescan.org/tx/0x29e6b1ee921f532f3991f9272b41bcbecf3891bd12fee7275aaa0106d0c8a141); **reserve 0**, iki claim confirmed |

Tam mandate/karar/receipt/delivered-result kaydı [completed intent](evidence/intent-a359938e-b769-4a8e-afbe-37556ab50e86.json); ham imzalı final veriler [Ethereum](evidence/settlement-a359938e-b769-4a8e-afbe-37556ab50e86-0.json) ve [Solana](evidence/settlement-a359938e-b769-4a8e-afbe-37556ab50e86-1.json); tüm secretsiz receipt'ler [transactions.json](evidence/transactions.json). Counterparty seed edilmiş ayrı test rolüdür; dış müşteri talebi veya ikinci otonom LLM diye sunulmuyor.

İlk Ethereum/XRP AND koşusu da gerçek ve tamamlanmıştır: `29e88761-5cee-43d0-8a87-4b1ac50b9752`, [eski market](https://sepolia.basescan.org/address/0x80249acd6afd72d4d2826b788b0e972848a073e4), **NO**, buyer 0 / counterparty 2 SOU, reserve 0. Bu ikincil tarihsel kanıt [ilk intent](evidence/intent-29e88761-5cee-43d0-8a87-4b1ac50b9752.json) içinde korunuyor. İlk şemada sonradan eklenen açık automation-expiry/transaction-count alanları başlangıçta kaydedilmemişti; geçmişe bu alanlar eklenerek onay verilmiş gibi gösterilmiyor. [Koşu kayıtları](docs/LIVE_RUNS.md) bu ayrımı açıklar.

## Doğrulama ve yayın

| Kontrol | Gerçek durum / kanıt |
| --- | --- |
| Deployed edited / stale / different-request / wrong-key, duplicate intent ve over-budget reddi | **PASS**, beklenen hatalar ve değişmeyen reserve/source state: [nihai rejection kaydı](evidence/rejections-a359938e-b769-4a8e-afbe-37556ab50e86.json). Salt okunur deployed RPC çağrılarıdır; broadcast revert receipt'i değildir. |
| Sözleşme ve Node kontrolleri | **29 Foundry testi + 256 fuzz koşusu**, **20 Node testi**, typecheck ve production build **PASS**. [Sözleşme çıktısı](evidence/contract-tests.txt), [güvenlik incelemesi](docs/EXECUTION_SAFETY.md). |
| Nihai deployment/policy doğrulaması | **72/72 PASS**; immutable alanlar maskelendikten sonra runtime artifact ile eşleşir; collateral, signer, iki request hash'i, outcome sırası/index, OR ve tüm zamanlar ayrıca doğrulandı: [contract-verification-final.json](evidence/contract-verification-final.json). |
| Bağımlılık bütünlüğü | **535/535 dosya PASS**, sıfır SHA-256 farkı; pinli resmî arşivler ve lisanslar: [vendor-integrity.json](evidence/vendor-integrity.json). Plain vendor Git revision uyarısı dosya sürüm sapması göstermiyor. |
| Restart, fault ve expiry | Nihai OR koşusunda gerçek süreç yeniden başlatma/receipt reconciliation **PASS**: aynı 31 transaction/hash, buyer 2 SOU claim yeniden kuruldu, status claimed ve reserve 0: [son restart kaydı](evidence/restart-reconciliation-final.json). İlk AND koşusunun [önceki restart kaydı](evidence/restart-reconciliation.json) ayrıca korunuyor. Ayrı mock RPC testinde SIGKILL sonrası aynı hash/nonce ile tek execution; expiry sonrası yeni hazırlama/broadcast yok, confirmed receipt okunuyor: [recovery-test.json](evidence/recovery-test.json), `npm run test:recovery`. Mock sonuçlar canlı ödeme diye sunulmuyor. |
| Unmatched pool otomatik refund | Üretim engine'i + gerçek derlenmiş sözleşmelerle özel **Anvil PASS**: funding cutoff sonrası yalnız void/refund, tam 1,00 SOU iade, reserve 0, counterparty retry yok; expiry sonrasında yeni işlem yok. [unmatched-refund-test.json](evidence/unmatched-refund-test.json), `npm run test:refund`. Bu public-chain refund kanıtı değildir. |
| Offline wallet setup | **PASS**: üç ayrı rol, `0600`, key loglanmıyor, mevcut dosyayı ezme reddi, ağ/fon kullanımı yok: [wallet-setup-check.json](evidence/wallet-setup-check.json). |
| Public repo ve bağımsız kurulum | [Public repo](https://github.com/ABerkeBora/heka-second-order), ABerkeBora author/committer doğrulandı. GitHub'dan temiz clone `b7c24c7…` üzerinde install/contract build/production build/start **PASS**, key veya yayınlanmış kanıt canlı state'e kopyalanmadı: [clean-clone.json](evidence/clean-clone.json). |
| Browser QA | Tamamlanan full-mandate OR settlement ekranı 1440/768/390 px gerçek üretim tarayıcı kontrolü **PASS**: fontlar yüklü, gradient/yatay taşma yok, tablet/phone küçük control yok. [browser-qa.json](evidence/browser-qa.json), `evidence/screenshots/`. Yeni evidence/dokümanların son kapanış push'u root tarafından tamamlanıyor; kullanıcıya kalan kurulum/entegrasyon işi değildir. |

## Güven sınırları

Airnode imzası, seçilen kaynağın tam isteğe verdiği cevabın kimliğini/bütünlüğünü doğrular; upstream gerçekliğini, Polymarket oracle/cache tutarlılığını veya kârı kanıtlamaz. Taze envelope eski kaynağı tazelemez. Settlement tek sabit `getMarketById` operasyonundan gelir; missing/stale/invalid/split veri escrow'u serbest bırakmaz. Önceden sabit deadline void/refund yolu kalır.

Executor izole **server-held test keys** kullanır; production non-custodial wallet entegrasyonu değildir. Model anahtar, keyfî adres/calldata görmez. Teminat, recipient/beneficiary, funding bütçesi/expiry/intent sınırları contract'ta; gas, agent işlem sayısı ve automation expiry yerel executor'da enforce edilir. Gas cap'i execution + tahmini rollup ücretlerine dayanır, zincir üstü kesin üst sınır değildir; gerçek execution/L1 ücretleri receipt'lerde ayrıca tutulur. Otomatik top-up yok.

Tek writer/PID lock, yerel journal bütünlüğü, RPC erişimi ve olağan testnet finality işletim varsayımlarıdır; derin reorg kurtarması kanıtlanmadı. BSV koşullu kapısı geçilmedi ve qualification iddiası yok: [BSV_GATE](docs/BSV_GATE.md).

## Build dışında kalan teslim adımları ve V2

- **Video, en fazla 150 saniye — PENDING, yaklaşık 15–25 dk.** [Sunum akışı](docs/PRESENTATION.md) ve [submission taslağı](docs/SUBMISSION.md) hazır; nihai OR settlement, gerçek 2/0 SOU claim'leri ve dört rejection gösterilmeli. Kaydedilmiş video/link yok; bütün yarışma submission maddeleri PASS sayılmıyor.
- **Devfolio'da proje seçimi ve gönderim — kullanıcı, yaklaşık 10–15 dk.** Başvuru gönderilmedi. Genel kural **takım başına tek submission**, en fazla üç partner track; yedi build yedi submission değildir. Son tarih **31 Ekim 2026 15:00 Europe/Berlin**; doğru API3 ve genel submission tabları **04:51–04:53** yeniden kontrol edildi, değişiklik görülmedi: [kural kaydı](evidence/rules-check.json). Güncel şart/evidence durumu [TRACK_REQUIREMENTS](TRACK_REQUIREMENTS.md) içinde.

**V2 QUEUED**, henüz ikinci aktif Goal açılmadı: [NEXT_GOAL_STATUS](NEXT_GOAL_STATUS.md). V1 gerçek Goal tamamlandıktan sonra root `BASELINE_V1.md` ve sabit baseline tag'ini koruyup `codex/next` üzerinde yeni Goal başlatacak. V1 `/` korunacak; V2 `/next` kullanıcının varlık/olay/zaman/AND-OR hedefini katı bounded şemayla doğrulayacak. Karşılanamayan veya belirsiz hedef **unsupported/no-action** üretecek, alternatif varlığa sessiz veya incelenmiş fallback yaparak yeni fonlama başlatmayacak. Bu V2 işi V1 teslimine tamamlanmış özellik olarak eklenmiyor.
