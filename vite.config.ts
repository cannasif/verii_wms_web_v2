import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

const allowedHosts = ["https://wms.v3rii.com"];

function normalizeChunkId(id: string): string {
  return id.split(path.sep).join('/');
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // Heavy barcode/3D engines are intentionally lazy-loaded feature chunks.
    // Keep the limit tight enough to catch accidental route bloat without
    // warning on isolated, user-triggered engines such as bwip-js.
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      onwarn(warning, warn) {
        if (
          warning.code === 'INVALID_ANNOTATION' &&
          typeof warning.id === 'string' &&
          (
            warning.id.includes('@microsoft/signalr/dist/esm/Utils.js') ||
            warning.id.includes('@hugeicons/core-free-icons/dist/esm/')
          )
        ) {
          return;
        }

        warn(warning);
      },
      output: {
        manualChunks(id) {
          const chunkId = normalizeChunkId(id);

          if (
            chunkId.includes('/node_modules/react/') ||
            chunkId.includes('/node_modules/react-dom/') ||
            chunkId.includes('/node_modules/scheduler/')
          ) {
            return 'vendor-react';
          }

          if (chunkId.includes('/node_modules/react-router/') || chunkId.includes('/node_modules/react-router-dom/')) {
            return 'vendor-router';
          }

          if (chunkId.includes('/node_modules/@tanstack/')) {
            return 'vendor-query';
          }

          if (
            chunkId.includes('/node_modules/react-hook-form/') ||
            chunkId.includes('/node_modules/@hookform/') ||
            chunkId.includes('/node_modules/zod/')
          ) {
            return 'vendor-forms';
          }

          if (chunkId.includes('/node_modules/i18next/') || chunkId.includes('/node_modules/react-i18next/')) {
            return 'vendor-i18n';
          }

          if (chunkId.includes('/node_modules/axios/')) {
            return 'vendor-http';
          }

          if (chunkId.includes('/node_modules/@react-three/fiber/')) {
            return 'vendor-3d-fiber';
          }

          if (chunkId.includes('/node_modules/@react-three/drei/') || chunkId.includes('/node_modules/three-stdlib/')) {
            return 'vendor-3d-drei';
          }

          if (chunkId.includes('/node_modules/three/')) {
            return 'vendor-3d-three';
          }

          if (chunkId.includes('/node_modules/jspdf') || chunkId.includes('/node_modules/jspdf-autotable')) {
            return 'vendor-pdf';
          }

          if (chunkId.includes('/node_modules/xlsx/')) {
            return 'vendor-xlsx';
          }

          if (chunkId.includes('/node_modules/bwip-js/')) {
            return 'vendor-barcode-render';
          }

          if (chunkId.includes('/node_modules/konva/') || chunkId.includes('/node_modules/react-konva/')) {
            return 'vendor-barcode-canvas';
          }

          if (chunkId.includes('/node_modules/@microsoft/signalr/')) {
            return 'vendor-signalr';
          }

          if (
            chunkId.includes('/src/features/inventory/3d-warehouse/components/WarehouseScene') ||
            chunkId.includes('/src/features/inventory/3d-warehouse/components/Shelf3D') ||
            chunkId.includes('/src/features/inventory/3d-warehouse/components/AisleFloor3D') ||
            chunkId.includes('/src/features/inventory/3d-warehouse/components/WarehouseFloor') ||
            chunkId.includes('/src/features/inventory/3d-warehouse/components/WarehouseBin') ||
            chunkId.includes('/src/features/inventory/3d-warehouse/components/WarehouseShelf') ||
            chunkId.includes('/src/features/inventory/3d-warehouse/components/AisleFloor') ||
            chunkId.includes('/src/features/inventory/3d-warehouse/components/Bin3D')
          ) {
            return 'warehouse-3d-scene';
          }

          // Let Rollup group third-party vendor modules naturally. The custom
          // vendor split was producing circular imports between vendor chunks
          // at runtime.
          return undefined;
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    allowedHosts: allowedHosts,
    host: "0.0.0.0",
  },
})
