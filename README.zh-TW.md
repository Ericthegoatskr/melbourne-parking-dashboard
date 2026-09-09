# 墨爾本街邊停車即時看板

[English](README.md) · **繁體中文**

以 City of Melbourne 官方感測器開放資料呈現街邊停車位狀況的公共看板。

**線上站台：** <https://ericthegoatskr.github.io/melbourne-parking-dashboard/>

它與其他停車地圖的差別只有一點：**它會扣掉已經停止回報的感測器，並在頁面上告訴你扣了多少。** 議會的 feed 帶著 963 個數月至數年沒回報的感測器，直接計數會虛報約 11% 的空位。

產品 mission、研究證據與 roadmap 見 [`PRODUCT.zh-TW.md`](PRODUCT.zh-TW.md)；production 的驗證、新鮮度與 fallback 規則見 [`docs/DATA_TRUST_CONTRACT.zh-TW.md`](docs/DATA_TRUST_CONTRACT.zh-TW.md)。

> 本檔為 [README.md](README.md) 的中文版。本 repo 每份文件都是英文為主體、中文（`*.zh-TW.md`）並列；內容有出入時以英文版為準。

## 為什麼值得存在

City of Melbourne 是 source of truth，而且已經把感測器資料完整開放。既有的停車 app 也早就能畫出地圖上的點。因此本產品的差異化不是「另一張地圖」，而是它拒絕計入什麼。

2026-09-08 對真實 feed 的實測：

| | 宣稱的空位數 |
| --- | --- |
| 照單全收 feed 裡的每一筆 | 4,370 |
| 只採信真正在回報的感測器 | **3,922** |
| 差距 | **448 個幽靈空位——高估 11.4%** |

這不是理論上的瑕疵。它的具體後果是：使用者開去一條被告知有位子的街，發現沒有，然後繞第二圈。

## Features

- 依官方時間戳明確標示 `live`、`delayed`、`stale`、`unavailable` 四種狀態，資料狀態永遠排在數字之前。
- 資料超過 15 分鐘即撤回所有現在式敘述；超過 60 分鐘不顯示任何空位數字。
- 30 分鐘感測器信任窗：未回報的車位計為「不回報」，永不計入空位。
- 頁面上可展開「本看板排除了什麼」，直接對照天真計數會得出的數字。
- 依街道排名（最多空位／機率最佳），機率排名要求至少 5 個回報中的感測器，避免兩個感測器的街道以 100% 登頂。
- 街道層級地圖，未回報的街道畫成空心灰色，絕不上色成「有位子」。
- 標誌牌限制只在整條街無歧義時具名，否則列出實際存在的種類並導向現場標誌。
- 較舊的快照不得覆寫較新的；抓取失敗保留上一份有效讀數並照實老化。
- 開著的分頁自行老化，不依賴網路刷新或未被節流的計時器。
- Desktop 到 375px mobile responsive；無水平溢出。

## Data Sources

| Dataset | 用途 |
| --- | --- |
| [`on-street-parking-bay-sensors`](https://data.melbourne.vic.gov.au/explore/dataset/on-street-parking-bay-sensors/information/) | 車位佔用狀態、感測器時間、座標 |
| [`parking-zones-linked-to-street-segments`](https://data.melbourne.vic.gov.au/explore/dataset/parking-zones-linked-to-street-segments/information/) | zone → 街道名稱 |
| [`sign-plates-located-in-each-parking-zone`](https://data.melbourne.vic.gov.au/explore/dataset/sign-plates-located-in-each-parking-zone/information/) | zone → 標誌牌限制 |

資料提供：City of Melbourne，依 [Creative Commons Attribution 4.0](https://creativecommons.org/licenses/by/4.0/) 使用。本產品不是議會服務，也不代表議會背書。

API 開放 CORS 且不需 API key，瀏覽器直接讀取官方 endpoint，不經任何 proxy。

## Run Locally

需求：Node.js 20、22 或 24 以上。

```bash
npm install
npm run dev
```

Vite 會輸出本機預覽網址。

## Verification

```bash
npm run verify
```

等同於 CI 跑的 `lint` → `typecheck` → `test` → `build`，順序相同。

**用這個指令，不要各自用 `npx` 跑底層工具。** 本機用 `npx tsc -b`、CI 用 `npm run typecheck` 的分岔，正是讓一個壞掉的 script 通過本機檢查卻在 CI 失敗的原因。

會影響使用者看到的變更，還必須從 production build 實際檢查 desktop / 375px mobile、四種資料狀態、互動、overflow 與 browser console。**build success 本身不是完整驗收。**

## Reference data

```bash
npm run build:crosswalk
```

會產生 `public/data/zone-crosswalk.json`——839 個 zone、177 條街道、約 106 KB。

這份對照表只有街道名稱與標誌牌代碼，**不含任何時間戳**，所以參考資料不可能讓過期的即時資料看起來變新。

街道名稱失敗時看板仍可運作：所有車位會落入「未分區」群組，全市數字不受影響。

## Project Structure

```text
melbourne-parking-dashboard/
├── src/
│   ├── App.tsx
│   ├── lib/
│   │   ├── config.ts            # 所有門檻，皆有實測根據
│   │   ├── odsClient.ts         # 抓取與 fail-closed 驗證
│   │   ├── freshness.ts         # 四態狀態機
│   │   ├── parkingModel.ts      # 聚合、排名、標誌牌
│   │   └── useParkingData.ts    # 生命週期、倒退保護、自我老化
│   ├── components/
│   └── __tests__/
├── scripts/
│   ├── build-street-crosswalk.ts
│   └── check-source-freshness.ts
├── docs/
│   ├── DATA_TRUST_CONTRACT.md   # 英文，主要版本
│   └── DATA_TRUST_CONTRACT.zh-TW.md
├── PRODUCT.md
├── PRODUCT.zh-TW.md
├── README.md
└── README.zh-TW.md
```

## Deployment

`.github/workflows/pages.yml` 會在推送到 `main` 與手動觸發時執行 lint、typecheck、測試、重建對照表並部署到 GitHub Pages。

這個看板不需要排程抓取：瀏覽器直接讀官方 feed，所以部署產物只是靜態程式碼加上參考資料。**沒有需要保鮮的資料快照，也就沒有 cron 延遲會讓使用者看到過期資料的風險。**

`scripts/check-source-freshness.ts`（`npm run probe:freshness`）獨立驗證官方來源本身是否健康，並在 CI 排程執行；它檢查的是上游，不是部署產物。

## Basemap dependency

地圖底圖使用 OpenStreetMap 官方圖磚，以 CSS 濾鏡在瀏覽器端調成深色近灰階，讓顏色只屬於資料。

原本使用的 CARTO 深色底圖現在會回傳 **HTTP 200 但內容是「API KEY REQUIRED」浮水印圖磚**——一個有效的回應載著無效的內容，正好是本看板存在理由的縮影。

OSM 的 tile usage policy 不允許高流量使用。正式上線前應改用有金鑰與 SLA 的圖磚供應商，或自架圖磚。目前這是唯一一個對第三方（非官方資料源）的執行期依賴；它失效時只有底圖消失，車位數字與街道排名不受影響。

## Known limitations

- 只涵蓋裝有可用地面感測器的車位。本站沒有的街道仍可能有停車位。
- 感測器讀數是關於最近過去的事實，不保證你抵達時位子還在。
- 街道層級的限制是概要；現場標誌永遠優先。
- 583 個車位（9.2%）無法對應街道名稱，歸入「未分區」；它們計入全市總數，但不會出現在推薦名單。
