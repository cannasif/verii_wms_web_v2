# Terminal theme → verii_wms_web_v2 (wire-up log)

V2 zaten Terminal CSS’e sahipti (`src/index.css` + `terminal-v2-bridge.css`).  
Eksik olan **React DNA** bağlandı.

## Yapılanlar

1. **Loading / Empty / Error**
   - `OpsLoadingState`, `OpsGridEmptyState`, `OpsGridErrorState` eklendi
   - `AdvancedDataGrid` → `> RUN FETCH` / `> INFO NO_DATA` / `> ERR`
   - `RouteLoader` → `> RUN BOOT`
   - `WorkspaceRouteLoader` → `> RUN FETCH`

2. **Toast**
   - `src/components/ui/sonner.tsx` → `SYS // NOTIFY` + `[OK]/[INF]/[WRN]/[ERR]/[RUN]`
   - `main.tsx` buna bağlandı

3. **Dashboard**
   - Stub kaldırıldı
   - `DashboardPage` + `dashboard-ops-ui` eklendi (clip-path paneller, metrics, FEED/CMD)
   - Quick link’ler V2 route’larına map edildi

4. **Sidebar**
   - Label’lar mono + uppercase tracking
   - Bridge CSS: sidebar font + primary CTA clip-path

5. **Typecheck:** `npx tsc -b` geçti

## Kontrol listesi (UI)

- Skin = Terminal (Premium kapalı)
- Liste sayfası yüklenirken `> RUN FETCH` görünmeli
- Dashboard dolu (hero + metrik + feed/quick)
- Toast’ta `[OK]` / `SYS // NOTIFY`
- Sidebar yazıları mono uppercase
