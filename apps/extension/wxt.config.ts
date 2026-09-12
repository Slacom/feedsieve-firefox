import { defineConfig } from 'wxt';
import { buildExtensionManifest } from './src/lib/platform/manifest';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: ({ browser, mode, manifestVersion }) =>
    buildExtensionManifest({ browser, mode, manifestVersion }),
  vite: (env) => ({
    define: {
      // dev/本地测试 API 覆盖：只在 development 构建生效（FEEDSIEVE_API_BASE=http://localhost:8787 pnpm dev）。
      // 生产构建恒为空字符串回退官方线上实例——pack-store 的 manifest 审计查不到
      // 代码内嵌地址，任何环境变量泄漏进生产 zip 都会静默指向错误 API，故此处必须按 mode 隔离。
      __FEEDSIEVE_API_BASE__: JSON.stringify(
        env.mode === 'development' ? (process.env.FEEDSIEVE_API_BASE ?? '') : '',
      ),
    },
  }),
  zip: {
    name: 'feedsieve',
  },
});
