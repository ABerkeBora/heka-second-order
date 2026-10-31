# Second Order — sabah teslimi

**31 Ekim 2026, Europe/Berlin. Canlı ana akış tamamlandı:** gerçek LLM önerisi → bağımsız doğrulama → sınırlı ilk yetki → iki ayrı rolün gerçek teminat fonlaması → iki API3 kanıtıyla settlement → agent'ın başlattığı tahsilat. Canlı entegrasyon engeli yok. Son public push/temiz clone ve final responsive QA aşağıda **PENDING**; 150 saniyelik video henüz kaydedilmedi. Bu nedenle bütün yarışma teslim şartları tamamlandı iddiası yok.

## Açma ve yeniden çalıştırma

Mevcut sunucu açıksa [Second Order'ı açın](http://localhost:3101). **Activity** bölümünde tamamlanan pozisyonu ve iki tarafın teslim kayıtlarını inceleyin; **Evidence** alanında rejection sonuçlarını ve sabit veri politikasını açın. Aynı portta ikinci sunucu başlatmayın.

Sunucu durmuşsa:

```sh
cd /Users/wargly/Documents/ChatGPT/Heka/projects/second-order
npm run build
npm start
```

Yeni checkout kurulumu: Node 24+, Foundry ve Ollama `qwen3:4b`; `npm ci`, `cp .env.example .env`, `forge build`, `npm run build`, `npm start`. `.env` içindeki `WALLET_FILE` yalnız kendi izole Base Sepolia test rollerini içeren özel dosyaya işaret etmeli. Anahtarları UI'a, modele veya repoya koymayın. Yerel Ollama adresi `http://127.0.0.1:11434`; ortak servisi yeniden başlatmak veya modeli tekrar indirmek gerekmiyor.

Yeni senaryo için güncel açık kayıtları keşfedip bir hedef girin; örneğin **“Combine Ethereum and XRP upside outcomes with AND. Use the shortest upcoming window.”** Süresi dolmuş önceki kaynaklar yeniden fonlanmaz. Agent önerisi, immutable market ve bounded mandate sonrasında fonlama/kanıt/tahsilatı yürütür. `.runtime/` durumunu ve işlem günlüğünü koruyun; ekranı sıfırlamak için zincir geçmişini silmeyin. Kurulum ayrıntıları [README](README.md), ABI ve muhasebe [CONTRACT](docs/CONTRACT.md), executor sınırları [EXECUTION_SAFETY](docs/EXECUTION_SAFETY.md) içinde.

Repo oluşturuldu: [ABerkeBora/heka-second-order](https://github.com/ABerkeBora/heka-second-order). Nihai push ve temiz clone doğrulaması: **PENDING — build sahibi tamamlayacak.**

## Tamamlanan gerçek pozisyon

Ağ **Base Sepolia, chain ID 84532**. Teminat, 6 decimal **SOU / Second Order Units**; değersiz ve public-mint test tokenıdır. API3 veri ücreti aUSD ve native test ETH gas'tan ayrıdır. Kullanılan Gamma işlemleri ücretsiz; x402 ödemesi iddia edilmiyor.

- Intent: `29e88761-5cee-43d0-8a87-4b1ac50b9752`.
- [Fonlanan market](https://sepolia.basescan.org/address/0x80249acd6afd72d4d2826b788b0e972848a073e4); [SOU token](https://sepolia.basescan.org/address/0x78f97e3b9b1b367f60355ddcc06fb157d7d33d08). Dağıtılan market bytecode'u artifact ile eşleşti: [contract-verification.json](evidence/contract-verification.json).
- Gerçek `qwen3:4b` çağrısı **15,574 saniye** sürdü; Ethereum `6405927` ve XRP `6405928`, seçili outcome `Up`, kural `AND`. Validator izinli ve farklı kaynakları/model şemasını bağımsız kabul etti: [LLM kaydı](evidence/llm-4d4e246c-afd0-4847-a324-698891409d16.json).
- Buyer agent **YES 1,00 SOU** [fonladı](https://sepolia.basescan.org/tx/0x9a1e7fdf5e3f064cb12b9cb4f6432ee90087c34793a4c26fc285d837b08e014c). Ayrı seed edilmiş counterparty rolü **NO 1,00 SOU** [fonladı](https://sepolia.basescan.org/tx/0xcb63e6961be15badfd7f8ed6e5061da82824b752d47c3da6abe9962d21ca28d8). Bu rol dış müşteri talebi veya ikinci otonom model diye sunulmuyor.
- Ethereum'un seçili `Up` sonucu kaybetti; XRP'nin `Up` sonucu kazandı. Agent [birinci](https://sepolia.basescan.org/tx/0x4aa93d6ea1bb065b5ea5d90a3b86e6a3879067e71b3b5226d7d74920d10d7b89) ve [ikinci](https://sepolia.basescan.org/tx/0xba469def95fb56a83df2e63d18a84f7f74666f0c333de6cb445491600920ad85) gerçek imzalı final kaydı gönderdi; sabit AND kuralı **NO** ile settled oldu.
- Buyer'ın kaybeden YES pozisyonu [claim edildi: 0 SOU](https://sepolia.basescan.org/tx/0x85e129612f33c11e2195f5c6bf2ba4de3865a4bb851a7ac55ea339f89bf713ee). Counterparty'nin NO pozisyonu [2,00 SOU tahsil etti](https://sepolia.basescan.org/tx/0xef5fcb107d5f291adc4f656873c06f52345c189122efc6d020393bb277c488f9). **Kalan reserve 0**, iki claim confirmed. Sıfır buyer ödemesi başarılı kâr diye gösterilmiyor.

Tam karar/mandate/receipt/delivered-result zinciri [intent kaydı](evidence/intent-29e88761-5cee-43d0-8a87-4b1ac50b9752.json); ham imzalı final verileri [kaynak 0](evidence/settlement-29e88761-5cee-43d0-8a87-4b1ac50b9752-0.json) ve [kaynak 1](evidence/settlement-29e88761-5cee-43d0-8a87-4b1ac50b9752-1.json); secretsiz işlem listesi [transactions.json](evidence/transactions.json). İlk revizyonun fonlanmamış, mandate öncesi değiştirilen deployment'ı provenance içinde açıkça tutuldu; kanıt için yukarıdaki nihai adresi kullanın.

## Doğrulananlar

| Kontrol | Sonuç ve kanıt |
| --- | --- |
| Gerçek deployed verifier'ın edited / stale / different-request / wrong-key reddi | **PASS**; beklenen `NotSignedByAirnode` / `ResponseTooOld` hataları, aynı reserve/source state. [Rejection kaydı](evidence/rejections-29e88761-5cee-43d0-8a87-4b1ac50b9752.json). Bunlar deployed contract'a salt okunur RPC çağrılarıdır; broadcast edilmiş revert transaction'ı değildir. |
| Duplicate intent ve bütçe aşımı | **PASS**, deployed funding yolunda doğru `DuplicateIntent` / `BudgetExceeded` reddi; korunan durum değişmedi. Aynı rejection kaydı. |
| Foundry sözleşme testleri | **29 PASS**, ayrıca **256 fuzz koşusu**. Gerçek Airnode imzalarının tarihsel yerel replay'i, AND/OR, kaynak/zaman, mandate, reserve/dust, çift claim, split reddi ve deadline refund: [çıktı](evidence/contract-tests.txt). Yerel refund testi canlı refund transaction'ı diye sunulmuyor. |
| Node güvenlik testleri / typecheck / production build | **20 test PASS**, `npm run typecheck` ve `npm run build` **PASS**; [inceleme kaydı](docs/EXECUTION_SAFETY.md). |
| Gerçek süreç yeniden başlatma ve receipt reconciliation | **PASS**, transaction sayısı/hash kümesi/reserve değişmedi; buyer 0 payout claim event'ten geri kuruldu: [restart-reconciliation.json](evidence/restart-reconciliation.json). |
| Broadcast hatası + SIGKILL sonrası journal kurtarma | **PASS**, aynı raw transaction/hash ve nonce ile tek ekonomik execution; değişen argüman reddi. Bu ayrı **mock RPC** testi, canlı ödeme değildir: [recovery-test.json](evidence/recovery-test.json), `npm run test:recovery`. |
| Son masaüstü/tablet/telefon QA | **PENDING**, root son üretim ekranını ve screenshot setini tamamlayacak; mevcut ara görüntüler `evidence/screenshots/` altında. |
| Public push + temiz clone smoke | **PENDING**, root tamamlayacak. |

## Güven ve işletim sınırları

Signer ve tam request hash'i, response'un kaynağını/bütünlüğünü doğrular; dış dünya gerçeğini, Polymarket oracle doğruluğunu, cache tutarlılığını veya kârlılığı kanıtlamaz. Listing ve tek-market endpoint'leri farklı eski durumlar döndürebilir. Settlement yalnız sabit `getMarketById` operasyonunu kullanır; envelope yaşı ile kaynak `updatedAt` ayrı kontrol edilir. Eksik/yanlış/eski/split veri escrow'u serbest bırakmaz; önceden sabit deadline refund yolu kalır.

Executor izole test anahtarlarını sunucu tarafında tutuyor; bu bir production non-custodial wallet entegrasyonu değildir. Model anahtar, serbest hedef veya calldata görmüyor. Teminat/recipient/beneficiary/funding expiry/bütçe/intent sınırları sözleşmede; gas, toplam işlem sayısı ve automation expiry uygulamada enforce ediliyor. Gas bütçesi execution + tahmini rollup ücretlerini yerelde hesaplar; zincir üstü garanti değildir. Gerçek receipt execution/L1 ücretleri ayrıca kaydedilir. Otomatik top-up yok.

Tek yerel writer/PID lock ve journal bütünlüğü, RPC erişimi ve normal testnet finality işletim varsayımlarıdır; derin reorg kurtarması kanıtlanmadı. BSV koşullu kapısı geçilmedi; BSV qualification iddiası yok ([gerekçe](docs/BSV_GATE.md)).

## Kalan teslim işleri

1. **Public push, doğru ABerkeBora commit kimliği ve temiz clone/start kontrolü — 10–15 dk, root.** Sonuç geçince ilgili PENDING satırını gerçek commit/kanıtla güncelleyin.
2. **Son production browser QA: 1440 / 768 / 390 px ve screenshot'lar — 10–15 dk, root.** Tamamlanan settlement/claim durumu, hata ve evidence yolunu yeniden görün.
3. **En fazla 150 saniyelik video kaydı ve süre kontrolü — 15–25 dk, kullanıcı. PENDING.** [Sunum akışı](docs/PRESENTATION.md) ve [submission taslağı](docs/SUBMISSION.md) hazır; gerçek NO settlement ve 0/2 SOU tahsilatlarını gösterin. Kaydedilmiş video veya video linki yok.

Başvuru **gönderilmedi**. Resmî genel kural **takım başına tek submission**, en fazla üç partner track; yedi build yedi submission sayılmaz. Doğrulanan deadline **31 Ekim 2026 15:00 Europe/Berlin**. Video, public repo ve seçilen projeyi kullanıcı değerlendirdikten sonra Devfolio gönderimini kendisi yapar; bu chat'e yarışma başvurusunu gönderme yetkisi verilmedi. Son qualification durumunun kaynağı [TRACK_REQUIREMENTS](TRACK_REQUIREMENTS.md); video PENDING iken bütün teslim maddelerini PASS saymayın.
