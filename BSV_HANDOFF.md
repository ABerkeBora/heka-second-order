# Second Order /bsv — gerçek testnet akışı ve açık sınırlar

31 Ekim 2026 sabahı kullanıcının yalnız Second Order için verdiği BSV yetkisiyle hazırlanmıştır. **BSV qualification tamamlandı denmez: mevcut test backend'i hem attestor hem seeded counterparty anahtarını tutar. Bir platform tarafı gerekli imza çiftini kontrol edebilir. Non-custodial şartı bu topolojide BLOCKED.** Ayrı bir native kriptografi deneyi bu canlı havuzun kuralını geriye dönük değiştirmez.

## Açılış ve korunmuş sürümler

- BSV: http://localhost:3101/bsv — `/api/bsv`, `.runtime/bsv`, `evidence/bsv`.
- V1: http://localhost:3101/ — mevcut `v1-baseline`.
- V2: http://localhost:3101/next — BSV öncesi commit `a87f78b`; public `codex/next` korunur.
- Yeni çalışma dalı: `codex/bsv`, aynı `ABerkeBora/heka-second-order` public repo.
- Node24+, `npm ci`, `forge build`, `npm run build`, `npm start`. Tek3101 sunucusu; paralel ikinci executor başlatılmaz. Kullanıcı anahtarları standart BSV Desktop/Browser cüzdanından çıkmaz. `.env` yalnız bu projenin mevcut EVM test-gas erişimi ve yerel Ollama ayarlarını kullanır. BSV server test rolleri ayrı ignored0600 dosyadadır.

## Gerçek yapılanlar

Standart Desktop testnet bağlantısı ve gerçek runtime `qwen3:4b` çağrısı doğrulandı. **30,4 saniyelik model çağrısı**, exact ETH Up OR SOL Up /31Ekim09:35–09:40UTC penceresini seçti: marketler **6414738 /6414741**. IDs, condition/outcome sırası, AND/OR ve kaynak zamanları model dışında kontrol edildi. Ücretsiz Polymarket çağrısına x402 ücreti uydurulmadı.

İlk bounded mandate: buyerYES, **5.000 test satoshisi**, tek funding, transaction başına en fazla1.000sat fee; sabit derived keys/beneficiaries ve deadline. EVM sidecar token/escrow tutmaz; aynı basket'in orijinal API3 creation/finality imzalarını kontrol eder. Mevcut EVM havuzlarının tokenları kullanılmaz.

| Gerçek kanıt | Referans |
|---|---|
| EVM original-envelope consumer | Base Sepolia `0x4bac6d4f18af12aac185835641bce936f7066451` |
| İmzalı açık kaynaklarla state onayı | `0xdf2216246e19c6e32d10c28391da89db9dc74d554e2893d30bb50d9dec5e6c02` |
| Ayrı seeded test rolü hazırlığı | [10.000sat /57sat fee](https://test.whatsonchain.com/tx/cc5d30da2d0ee7bffdffd23f3e912d65367e1e986cc582c14499e6fe1108ca1a); collateral veya müşteri talebi sayılmaz |
| Buyer collateral | [5.000sat](https://test.whatsonchain.com/tx/8bcbad918a7521cd3b5e0aa4a970f6610f41299f37b3322c51b1409f88af40fe) |
| Test counterparty collateral | [5.000sat](https://test.whatsonchain.com/tx/325b63b5a0d9cd002e6b44e6f43cf2425b7f2a2e4f9487365e999608bc60ea6c) |

İki collateral ve payout **testnet block1766129'da MINED** olarak yeniden doğrulandı (`settlement-accounting.json`). İlk HTTP202/`RECEIVED`, block confirmation sayılmaz. Her funding, `noSend:true` ile önce imzalanır; tam fixed-output refund imzası Script interpreter'da doğrulanıp kaydedildikten sonra funding yayınlanır. Refund deadline **10:00UTC /11:00Berlin**; her biri4.000sat sahibine ve1.000sat miner fee'ye bağlıydı. Payout iki collateral input'unu tükettiğinden bu refund'lar artık yalnız arşivdir ve ayrıca çalışamaz. Bu, CLTV/CSV script garantisi değildir; nLockTime/sequence dahil tam transaction önceden imzalanmıştır.

**Canlı final settlement/payout PASS:** İki kaynak da Down oldu, OR sonucu **NO**. Orijinal final proof'lar [A](https://sepolia.basescan.org/tx/0xed1e2cb41fcffbb778892a9b58ef71194fb6d76f80000c5732014aac141dd4a2) ve [B](https://sepolia.basescan.org/tx/0xc687899e21bec0845b3fe7aa61a27744f6421a2ae0e827fad22ecc4016e6b344) EVM consumer'ı settled yaptı. [Gerçek BSV payout](https://test.whatsonchain.com/tx/ca564e8e0f9d20081a589a09755157768e657d5acb1ff20ab0d668807938ed70) **9.000sat counterparty,0sat buyer**,1.000sat miner fee. Buyer funding fee86sat; counterparty funding fee35sat. Ayrı10.000sat setup allocation fee57sat bu pozisyonun collateral/payout'u sayılmaz. Alıcı wallet'ın `secondorderbsv…` basket kaydı, derived payout key, gerçek output ve tüm iki input Script'i ayrıca doğrulandı. Bu kullanıcı kârı veya gerçek müşteri talebi değildir.

## Enforce edilen ve güvenilen kısımlar

BSV Script mandatory attestor + iki participant'tan birinin imzasını ister. Tek private key harcayamaz; fakat bu testte backend iki gerekli key'i tutar. Manifest hash script'te commitment olarak taşınır; Script manifest'i veya API3/EVM state'ini yorumlamaz. `SIGHASH_ALL|FORKID`, verilmiş bir imzanın tam input/output/amount/fee/lockTime bağını korur; imzacıların yeniden kötü bir transaction imzalamasını engelleyen covenant değildir. Bu ayrım UI'de de açıkça gösterilir.

Attestor, pinned orijinal API3 imzasını **deployed EVM consumer** üzerinden doğrular ve approval state'e göre BSV çıktısını seçer. Backend-only veri kontrolü native on-chain doğrulama sayılmaz. EVM sidecar BSV'ye EVM consensus light-client'ı eklemez. Attestor sansürleyebilir; backend/participant collusion riski vardır. Airnode imzası upstream Polymarket gerçeğini veya cache tutarlılığını garanti etmez. Bağımsız signer veya kanıtlanmış native covenant olmadan dual qualification iddia edilmez.

## Doğrulama ve teslim durumu

- **13 BSV Script testi PASS:** derived BRC100 signature, mandatory keys, wrong key, output/recipient/fee/outpoint değişimi, refund lockTime binding. Yerel sentetik testtir, canlı BSV işlemi yerine sayılmaz.
- **16 yeni EVM approval testi PASS:** original-envelope state, AND/OR, dört ret, upstream age, explicit closed/resolved, exact one-hot, duplicate ve deadline.
- `tamper-live.json`: gerçek yeni deployed consumer'da timely valid proof +edited/stale/wrong-request/wrong-signer doğru custom error ile **read-only eth_call PASS**. Broadcast revert diye sunulmaz. `npm run verify:bsv` yeniden üretir.
- `restart-and-replay.json`: gerçek fonlanmış server restart'ı, aynı iki funding hash'i; duplicate mandate HTTP400; ikinci funding yok.
- `v1-v2-regression.json`: eski runtime/journal hash'leri aynı, V1/V2 **31/15** receipt ve tüm eski claimed durumları korunuyor.
- Gerçek browser1440/768/390: taşma yok, minimum11px, phone controls>=44px. Ekran görüntüleri CUA tool kaydında; yerel screenshot dosyası üretildiği iddia edilmez.
- Pinned SDK3.2.1 ve Wallet Toolbox2.14.9. SDK `ARC` `/v1/tx` kullanır; Arcade `/tx`+EF ister. Canlı ilk404 aynı imzalı allocation'ı yeniden ücretlendirmeden resmî Toolbox Arcade provider ile uzlaştırıldı.

BSV non-custody **BLOCKED**; buna karşılık orijinal API3 approval, gerçek BSV collateral/payout, restart ve duplicate yolu kanıtlıdır. Video ve Devfolio **PENDING**, dış pilot/müşteri yok. BSV/API3/genel final rule recheck ve public push final kanıtla kaydedilir. Hosting, mainnet ve yarışma gönderimi yapılmadı.

150 saniyelik sunum:0–20sn exact two-source goal ve gerçek model →20–45sn wallet/mandate ve orijinal proof approval →45–75sn gerçek BSV collateral/payout veya dürüst Waiting →75–115sn dört veri reddi →115–135sn duplicate/restart/refund →135–150sn current key-control ve upstream risk sınırları. Non-custodial gate açıkken BSV'ye uygunmuş gibi pitch edilmez.

## Native `/bsv/native` —11:15Berlin ek durumu

Ayrı native route/state/evidence ve self-contained `native/` bundle eklendi. Gerçek `qwen3:4b` çağrısı ETH6415479 +SOL6415473 için11:20–11:25Berlin, Up OR Up hedefini seçti. Taze orijinal açık-market imzalarıyla identity/outcome-order/endTime sabitlendi; derived wallet alıcıları için **12.075.794bayt** Script üretildi. Bu bir **fonlanmamış policy preview**: yeni buyer wallet action, signed mandate, sponsor signature veya native pool yok. Model ödeme yetkisi veya sonuç hakemi değildir.

Native helper iki orijinal API3 imzasını, exact requestHash ve tüm yedi source alanını Script içinde kontrol eder; backend digest/attestor onayı almaz. Request operation/projection/marketID bağları ve AND/OR, full10k pool recipient'i sabittir. Raw source JSON<=207byte; şekil/whitespace değişimi fail-closed. İmza upstream doğruluğunu garanti etmez. Kaynak ve signed timestamp için sabit gözlem aralığı,30s ileri/900s gecikme koşulu vardır. Güvenilir current chain time kontrolü yoktur; observation window içinde geçerli imza daha sonra da kullanılabilir. Refund maturity sonrası settlement/refund yarışır. Eski EVM expiry parity iddia edilmez.

**Neden fonlanmadı:** İlgili gerçek5MB native guard'ın payout'u kamu düğümlerinde `Operation limit exceeded` / `too-long-validation-time` aldı. Büyük funding transaction'ı P2P ile taşımak çözülmüş olsa da çıkışı gerçekten harcamak çözülmüş değildir. Bu daha büyük12MBguard için public-node execution **BLOCKED**. Native funding API ve buton bu gate'ten önce kapanır. Optimize edilmiş gerçek native claim receipt'i olmadan açılmamalı.

`native/pm-followon/consumer-results.json`12compiled case, `sdk-results.json` kendi proje runtime'ında11:14Berlin tekrar PASS. Bunlar genuine historical oracle fixture'lı yerel VM testleridir; test dummy adresleri/txid'leri yayınlanmaz. `evidence/bsv-native/gates.json` actual HTTP400'lerde eski/yeni journal hash'lerinin değişmediğini gösterir. `native/artifacts/*.gz`, kaynaklar, compiler provenance ve lisanslar public clone içinde bulunur; parent absolute path bağımlılığı yoktur. Root viem2.57.3 ve native helper viem2.38.5 ayrı, SDK3.2.1 korunur.

Native sonraki en küçük iş: R&D optimized consumer'ı gerçek public node claim ile doğrula → yalnız yeni gelecekteki iki kaynağı seç → immutable guard + buyer5k/CP5k +separate13k sponsorfee planını fonlamadan önce incele → accepted native funding ve sonraki final proof payout receipt'lerini kaydet. Standalone CP source/fee sponsor hazırlığı ve tam native refund uygulama walkthrough'u **PENDING**; eski kazanılmış9k CP cash yalnız mevcut pilot için adaydır, EVM collateral'dan çekilmez. Basit bir status toggle veya eski sonuca sonradan funding uygun değildir.

Final BSV/API3/genel sekmeler11:15Berlin tekrar okundu. `/bsv` mined payout kanıtı tamam; non-custody gate açık olduğundan BSV qualification tamam denmez. Video/Devfolio hâlâ PENDING.
