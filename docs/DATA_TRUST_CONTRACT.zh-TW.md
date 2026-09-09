# 資料可信 Contract

[English](DATA_TRUST_CONTRACT.md) · **繁體中文**

此文件是 production 行為與測試的共同契約。門檻是本產品的安全政策，不是 City of Melbourne 的 SLA。

修改本文件的任何數字，就是修改這個看板願意宣稱的內容。門檻集中在 `src/lib/config.ts`，並由 `src/__tests__/` 斷言。

> 本檔為 [DATA_TRUST_CONTRACT.md](DATA_TRUST_CONTRACT.md) 的中文版。英文版是主要版本，內容有出入時以英文版為準。

## Source of truth

| Feed | 官方資料集 | 必須保存的時間 |
| --- | --- | --- |
| 街邊停車位感測器 | [`on-street-parking-bay-sensors`](https://data.melbourne.vic.gov.au/explore/dataset/on-street-parking-bay-sensors/information/) | `status_timestamp`（感測器觀測）與 `lastupdated`（feed 發布） |

參考資料（建置時產生，不含任何時間戳）：

| Dataset | 用途 |
| --- | --- |
| `parking-zones-linked-to-street-segments` | zone → 街道名稱 |
| `sign-plates-located-in-each-parking-zone` | zone → 標誌牌限制 |

三個時間必須分開，永不互相替代：

- `observedAt` = `status_timestamp`，感測器看到這個狀態的時刻。
- `sourceTime` = payload 中最新的 `lastupdated`，feed 自己的發布時間。
- `fetchedAt` = 本產品下載的時間。

**不得**用 `fetchedAt`、build 時間、commit 時間、瀏覽器時間或快取寫入時間補任何缺失的來源時間。重新下載同一份快照不得讓它變新。

## 已驗證的產品事實

以下每一項都是 2026-09-08 對真實 feed 實測的結果，不是推測：

1. **feed 帶著死掉的感測器。** 6,324 筆中有 963 筆（15.2%）的 `lastupdated` 是數月至數年前；最舊的 `status_timestamp` 停在 2022-09-13。全部照單全收會宣稱 4,370 個空位，實際可信的只有 3,922 個——**虛報 448 個、高估 11.4%**。
2. **metadata 的新鮮度不等於資料的新鮮度。** `meshed-sensor-type-2` 的 catalog metadata 顯示 6 天前更新，最新一筆記錄卻是一年前。任何以 catalog `modified` 判斷新鮮度的做法都是錯的。
3. **34% 的 zone 有多重標誌牌代碼**（622 個有標誌的 zone 中有 212 個），常見組合是 `MP2P / LZ30`——計時收費區同時是特定時段的裝卸貨區。任選一筆顯示，會在另一份標誌適用的時段給出錯誤答案。
4. **522 個車位沒有 `zone_number`**，另有 61 個車位的 zone 不在議會的街道對照表中；合計 583 個（9.2%）無法命名街道。
5. **feed 約每 2 分鐘發布一次**，`/exports/json` 單次請求即可取得全部 6,324 筆（約 1.5 MB，gzip 後 174 KB），不需分頁。
6. **API 開放 CORS**（`access-control-allow-origin: *`）且不需 API key，額度為每 IP 每日 10,000 次。瀏覽器可直連，不需 proxy。

## Validation

只有全部成立時，payload 才能進入可呈現的 model：

- 回應是陣列，且長度 ≥ 5,000（已知 6,324；大幅縮水即不可信）。
- 無法解析的記錄比例 ≤ 2%。缺 `kerbsideid`、缺時間、缺座標或狀態不在 `{Present, Unoccupied}` 的記錄一律**丟棄**，不得預設為空位。
- 座標必須落在大墨爾本範圍內；超出者視為解析錯誤，不上地圖。
- `sourceTime` 可解析，且不得超前本機時鐘 2 分鐘以上。
- 回報中的感測器比例 ≥ 60%（實測 84.8%）。低於此無法描述全市。
- 佔用率必須落在 0–1。

HTTP 200 不等於有效。`{}`、錯誤頁 JSON、空陣列、缺欄位都必須判為 invalid。

## Sensor trust window

單一感測器只有在其 `lastupdated` 落在 **feed 自身最新讀數的 30 分鐘內**時才計入。

門檻比對的是 feed 的時間而不是本機時鐘：整份 feed 延遲一小時時，感測器彼此仍然一致——那是快照過期，不是感測器故障。這兩件事的處理方式不同。

未回報的感測器計入 `notReporting`，**永遠不併入空位數**。沒聽到消息的車位是未知，不是空位。

## Freshness state machine

依 `now - sourceTime` 分類：

| 狀態 | 規則 | UI contract |
| --- | --- | --- |
| `live` | ≤ 5 分鐘 | 可用現在式：「Bays free now」 |
| `delayed` | ≤ 15 分鐘 | 仍可顯示數字，但明示落後幾分鐘 |
| `stale` | ≤ 60 分鐘 | 標題改為「Bays free at last reading」；撤下所有現在式敘述 |
| `unavailable` | > 60 分鐘、缺資料、invalid、未來時間 | 顯示「無法確認」與重試／官方來源；**不得**顯示任何數字或綠色正常結論 |

門檻刻意比氣象或電力看板短。停車位在一台車開走的時間內就會改變：30 分鐘前的電力讀數是脈絡，30 分鐘前的停車讀數是錯誤答案，會害人開車前往一個已經被佔走的位子。

## Fallback、cache 與倒退

- 抓取或驗證失敗時保留上一份通過驗證的快照，並依其真實年齡顯示。不得產生 sample，不得把失敗當成空資料。
- 新快照的 `sourceTime` 若早於目前畫面上的，**必須拒絕**且不得覆寫。落後的 CDN edge 不得讓看板時光倒流。
- Freshness 在**每次 render 時**由時鐘重新計算，不是從上次 tick 存下的時間戳讀取。隱藏分頁的計時器會被瀏覽器節流；只要沒有這條規則，一個被還原的分頁就會在「Live」標籤下顯示一小時前的數字。
- 除了計時器外，`visibilitychange`、`focus` 與 `pageshow` 都會觸發重算。重算不設可見性條件；只有網路刷新才依可見性節流。

## Signage

只有當一條街的所有 zone 對限制代碼有共識時，才可具名顯示該限制。有歧義時，該列出實際存在的代碼並導向現場標誌——例如 `Metered 2hr / Loading zone 30min — read the sign`。

任選一個代碼顯示比什麼都不說更糟：在實際是裝卸貨時段的車位上標示「計時 2 小時」，是使用者被開罰單的方式。現場標誌永遠優先於本站。

## Required verification

- 真實 feed 形狀的 fixture；`{}`、空陣列、缺欄、未知狀態、缺時間、未來時間、非墨爾本座標。
- 感測器信任窗的邊界（29 分鐘內採信、60 分鐘外排除），以及「整份 feed 延遲但感測器一致」的情境。
- live / delayed / stale / unavailable 四個邊界。
- 開著的頁面在無網路刷新下自行老化跨越門檻。
- 較舊的快照不得覆寫較新的。
- 天真計數與誠實計數的差距（回歸鎖住 448 這個數量級）。
- 未分區群組不得出現在推薦名單頂端，但街道總和必須與全市總和一致。
- Production build 於真實瀏覽器檢查 desktop 與 375px mobile、水平溢出、console、鍵盤操作。
