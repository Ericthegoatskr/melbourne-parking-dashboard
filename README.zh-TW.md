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
- **依目的地找附近停車：** 輸入地址或地點名稱、按 Search，再選取正確結果；也可直接選八個內建地標，不需查詢目錄。範圍限 City of Melbourne 市政轄區，不涵蓋整個大墨爾本。
- **使用目前位置：** 只有按下 **Use my current location** 並允許瀏覽器定位後，才取得一次位置，套用相同的附近排序與地圖。畫面會保留定位時間及估計精度；移動後需再次按下按鈕。拒絕授權或定位失敗時，仍可輸入地址或選地標。
- 可選 250 公尺、500 公尺或 1 公里半徑，並以 **Nearest first**（距離優先）或 **Most reported free**（可信空位數優先）排列。先篩選半徑內的個別感測器車位，再計算街道數字；上方摘要卡仍呈現全市資料。有回報空位的街道排最前，其次為只有已佔用車位的街道，未回報者排最後。距離與地圖標記優先採最近的可信空位，沒有空位時採最近的回報車位，再其次為最近的未回報感測器。
- 鄰近結果沿用 30 分鐘感測器信任窗與所有資料新鮮度規則：過期讀數使用過去式，無法確認資料時不顯示空位數字。按 **Clear destination** 可恢復原本的全市街道搜尋、排序與地圖視圖。
- 街道層級地圖，未回報的街道畫成空心灰色，絕不上色成「有位子」。
- 標誌牌限制只在整條街無歧義時具名，否則列出實際存在的種類並導向現場標誌。
- 較舊的快照不得覆寫較新的；抓取失敗保留上一份有效讀數並照實老化。
- 開著的分頁自行老化，不依賴網路刷新或未被節流的計時器。
- 與 [Melbourne Daily](https://ericthegoatskr.github.io/melbourne-daily/) 共用海軍藍 `#14213D`、奶油白 `#F4EDE0` 與珊瑚橘 `#FF6B5B` 配色。側欄／手機選單的 **Colour theme** 可切回原本的淺色版，同一瀏覽器會記住五個看板共用的選擇；停車狀態色保留原本意義。
- 卡片進場與數值變更採用播放後即停止的動畫；系統開啟「減少動態效果」時停用動畫。
- Desktop 到 375px mobile responsive，手機提供抽屜式導覽；無水平溢出。
- 地圖程式、隨包附帶的 Leaflet 樣式與圖磚會在接近地圖時才載入，讓停車摘要先顯示；地圖連結、選取街道與手動載入按鈕也能啟動。載入失敗時保留街道資料並提供重試。手機主要控制項使用至少 44px 點擊範圍，街道清單滑到底後可繼續捲動整頁。
- 與其他看板統一五個入口：首頁、停車、天氣／UV、空品、交通。桌機使用側欄，手機使用保留安全邊界的底部導覽；目前看板會標示選取狀態，地圖、街道與資料來源的頁內連結則保留在「On this page」。

## Data Sources

| Dataset | 用途 |
| --- | --- |
| [`on-street-parking-bay-sensors`](https://data.melbourne.vic.gov.au/explore/dataset/on-street-parking-bay-sensors/information/) | 車位佔用狀態、感測器時間、座標 |
| [`parking-zones-linked-to-street-segments`](https://data.melbourne.vic.gov.au/explore/dataset/parking-zones-linked-to-street-segments/information/) | zone → 街道名稱 |
| [`sign-plates-located-in-each-parking-zone`](https://data.melbourne.vic.gov.au/explore/dataset/sign-plates-located-in-each-parking-zone/information/) | zone → 標誌牌限制 |
| [`street-addresses`](https://data.melbourne.vic.gov.au/explore/dataset/street-addresses/) | 送出地址搜尋後取得參考座標 |
| [`landmarks-and-places-of-interest-including-schools-theatres-health-services-spor`](https://data.melbourne.vic.gov.au/explore/dataset/landmarks-and-places-of-interest-including-schools-theatres-health-services-spor/) | 地點名稱搜尋，以及八個內建地標的座標 |

資料提供：City of Melbourne，依 [Creative Commons Attribution 4.0](https://creativecommons.org/licenses/by/4.0/) 使用。本產品不是議會服務，也不代表議會背書。

API 開放 CORS 且不需 API key，瀏覽器直接讀取官方 endpoint，不經任何 proxy。

目的地搜尋只在按下 Search 後查詢這兩份官方目錄。請求在 10 秒後逾時；部分結果失敗時會提供重試提示，目錄無法連線時仍可使用內建地標。地址／地點查詢不會改變停車資料的新鮮度。這些目錄屬於有限的參考資料：metadata 的修改時間為 2021 年，未宣告更新頻率，因此可能缺少新地址或更名地點。

## Current location

定位需要 HTTPS（或受信任的本機開發來源）、瀏覽器支援及使用者授權。頁面不會自動要求定位，也不會持續追蹤移動。拒絕授權時會提示到瀏覽器／網站設定開啟位置權限；不支援、無法取得位置或逾時時，可重試或改用目的地搜尋。按 **Cancel location**、修改地址、選地標或清除選取，都會捨棄等待中的結果，避免稍後回傳的位置覆蓋新的選擇。發生錯誤時保留原本目的地。

本產品只接受 120 秒內、估計精度在 1 公里以內的定位，與最大搜尋半徑一致。過舊、無效或精度不足時，需重新定位或輸入地址。定位日期／時間以墨爾本時區顯示，與停車資料新鮮度分開；若定位不確定範圍大於搜尋半徑，畫面會建議擴大半徑或輸入明確地址。涵蓋範圍仍限 City of Melbourne 感測器車位；在網路涵蓋範圍外查無結果，不代表附近沒有停車位。

座標僅保留於頁面記憶體，用來計算距離，不做反向地址查詢、不放入網址、不寫入持久瀏覽器儲存空間，也不上傳後端。既有的 OpenStreetMap 圖磚請求會讓圖磚供應商得知正在檢視的地圖區域，因此不宣稱第三方完全無法得知所查看的位置。

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

系列導覽需檢查五個入口皆在同一分頁開啟、停車頁的選取標示、手機抽屜的焦點／Escape 與底部導覽顯示，以及地圖和頁尾不被底部導覽遮住。停車資料無法顯示時，導覽仍須可用。共用導覽元件與樣式在 `melbourne-daily` 中有對應副本；入口順序、名稱與路徑需保持一致。

目的地搜尋需送出 `200 Collins Street` 並明確選取地址，再試內建地標。切換三種半徑與兩種排序，確認地圖目的地／範圍圈、範圍內街道數字，以及維持全市範圍的摘要卡。清除目的地後應恢復原本控制項。桌機與手機也要操作無結果、目錄中斷／部分失敗、請求中改字或選地標、鍵盤焦點、停車資料過期／不可用與減少動態效果。附近結果為空只表示半徑內沒有可對應街道的感測器車位，不代表附近沒有停車位。

目前位置功能需使用可控制的測試座標，涵蓋允許、拒絕、不支援／無法定位、逾時、精度不足、舊定位，以及感測器範圍外的位置。先確認載入頁面不會發出定位請求，再驗證成功後的兩種排序、三種半徑、定位時間／精度與地圖重設。等待定位時應測試取消、輸入地址、選地標、清除及離開頁面；晚到的回傳不得恢復已放棄的位置。代理驗證應使用模擬座標，不要求使用者的真實位置。每種失敗後，地址搜尋與原本地圖都應仍可操作。

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
│   ├── styles.css              # 系列共用的響應式版面與動畫規則
│   ├── styles/
│   │   └── tokens.css          # Melbourne Daily 色彩、字體與動畫設計變數
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

地圖底圖使用 OpenStreetMap 官方圖磚，以 CSS 濾鏡稍微降低飽和度並維持淺色背景，讓街道空位標記清楚可辨，且與圖例一致。

原本使用的 CARTO 深色底圖現在會回傳 **HTTP 200 但內容是「API KEY REQUIRED」浮水印圖磚**——一個有效的回應載著無效的內容，正好是本看板存在理由的縮影。

OSM 的 tile usage policy 不允許高流量使用。正式上線前應改用有金鑰與 SLA 的圖磚供應商，或自架圖磚。目前這是唯一一個對第三方（非官方資料源）的執行期依賴；它失效時只有底圖消失，車位數字與街道排名不受影響。

## Known limitations

- 只涵蓋裝有可用地面感測器的車位。本站沒有的街道仍可能有停車位。
- 感測器讀數是關於最近過去的事實，不保證你抵達時位子還在。
- 目的地距離是到感測器位置的直線估計，不是步行路線或交通時間。地標座標可能是建築參考點而非入口，也不承諾抵達時仍有空位。
- 街道層級的限制是概要；現場標誌永遠優先。
- 583 個車位（9.2%）無法對應街道名稱，歸入「未分區」；它們計入全市總數，但不會出現在推薦名單。
