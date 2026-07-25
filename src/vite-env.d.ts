/// <reference types="vite/client" />

declare module '@/config/config.json' {
  interface Config {
    branches: Array<{
      id: string;
      name: string;
      code?: string;
    }>;
  }
  const config: Config;
  export default config;
}
