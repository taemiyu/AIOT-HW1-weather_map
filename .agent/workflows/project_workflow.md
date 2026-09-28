---
tag: "2026.09.28-current"
status: "CURRENT"
project: "AIoT L3 CWA HW1"
description: "Current five-gate Taiwan Weather GIS development workflow"
source: ".agent/workflows/project_workflow.md"
---

# CURRENT TAG — 2026.09.28 (CURRENT / ACTIVE)

# Taiwan Weather GIS — Project Workflow

## Governing Rule
嚴格依序執行：Gate 1 CWA API → Gate 2 Database → Gate 3 Local Taiwan GIS → Gate 4 GitHub → Gate 5 Vercel

DO NOT BUILD EVERYTHING AT ONCE.
每個 Gate 必須 BUILD → RUN → TEST → VERIFY → PASS。FAIL 時停留在該 Gate 修正。不得使用 mock/fake weather data。

Dataset decision (user, 2026-09-28): use CWA **O-A0003-001** (現在天氣觀測報告, observation) instead of a forecast dataset.
Field mapping: Weather → Weather, MinT/MaxT → DailyExtreme DailyLow/DailyHigh AirTemperature, Forecast Time → ObsTime. PoP not provided by this dataset.

## Gate 1 — CWA API
1. 確認 Dataset 與 endpoint。 2. 從 .env 讀取 CWA_API_KEY；不得輸出完整 key。 3. 發送真實 HTTP request。
4. 驗證 HTTP status。 5. 依實際 response 解析 JSON，不猜 schema。 6. 先驗證一個地區，例如臺中市。
7. 輸出 Location、Time、Weather、MinT、MaxT；Dataset 有提供時再輸出 PoP。 8. 確認其他台灣地區也存在。 9. 實際 RUN 並留下驗證結果。
禁止實作 Database、GIS、GitHub deployment、Vercel。 → GATE 1 = PASS

## Gate 2 — Database
真實 CWA response ETL → SQLite；schema、資料驗證、duplicate strategy；SQL SELECT 驗證。禁止開始 GIS。 → GATE 2 = PASS

## Gate 3 — Local Taiwan GIS
3A Taiwan Map → 3B One Marker → 3C Weather Popup → 3D Taiwan Locations → 3E Database → GIS → 3F Taiwan GeoJSON → 3G Interactive Dashboard.
Leaflet + OpenStreetMap + Taiwan GeoJSON；Weather 必須來自 Database。 → GATE 3 = PASS

## Gate 4 — GitHub
整理 repo、README/design、requirements、安全設定。Push 前確認 .env 與 secret 不在 Git history/current files。 → GATE 4 = PASS

## Gate 5 — Vercel
GitHub → Vercel，Environment Variables，build/deploy，驗證 public URL，測試 push 觸發 auto deployment。
Local SQLite 非 Production DB；需線上持續寫入則採 Cloud Database。 → GATE 5 = PASS

## Final
五 Gate 全 PASS → DIC-2 / AIoT L3 CWA HW1 = COMPLETE
