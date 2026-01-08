import { cloudflareDevProxyVitePlugin as remixCloudflareDevProxy, vitePlugin as remixVitePlugin } from '@remix-run/dev';
import UnoCSS from 'unocss/vite';
import { defineConfig, type ViteDevServer } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import { optimizeCssModules } from 'vite-plugin-optimize-css-modules';
import tsconfigPaths from 'vite-tsconfig-paths';
import * as dotenv from 'dotenv';

dotenv.config();

// ===== Build-time safe Git info =====
const gitInfo = {
  commitHash: process.env.VERCEL_GIT_COMMIT_SHA || 'no-git-info',
  branch: process.env.VERCEL_GIT_COMMIT_REF || 'unknown',
  commitTime: process.env.VERCEL_GIT_COMMIT_TIMESTAMP || 'unknown',
  author: process.env.VERCEL_GIT_COMMIT_AUTHOR_NAME || 'unknown',
  email: process.env.VERCEL_GIT_COMMIT_AUTHOR_EMAIL || 'unknown',
  remoteUrl: process.env.VERCEL_GIT_REPO_URL || 'unknown',
  repoName: process.env.VERCEL_GIT_REPO_SLUG || 'unknown',
};

// ===== Package.json info =====
// Safe fallback in case we cannot read package.json at runtime
let pkg = {
  name: 'codinit.dev',
  description: 'A LLM interface',
  license: 'MIT',
  dependencies: {},
  devDependencies: {},
  peerDependencies: {},
  optionalDependencies: {},
};

try {
  pkg = require('./package.json'); // Bundled at build-time
} catch {
  // Keep default
}

export default defineConfig((config) => {
  return {
    define: {
      __COMMIT_HASH: JSON.stringify(gitInfo.commitHash),
      __GIT_BRANCH: JSON.stringify(gitInfo.branch),
      __GIT_COMMIT_TIME: JSON.stringify(gitInfo.commitTime),
      __GIT_AUTHOR: JSON.stringify(gitInfo.author),
      __GIT_EMAIL: JSON.stringify(gitInfo.email),
      __GIT_REMOTE_URL: JSON.stringify(gitInfo.remoteUrl),
      __GIT_REPO_NAME: JSON.stringify(gitInfo.repoName),
      __APP_VERSION: JSON.stringify(process.env.npm_package_version || '0.0.0'),
      __PKG_NAME: JSON.stringify(pkg.name),
      __PKG_DESCRIPTION: JSON.stringify(pkg.description),
      __PKG_LICENSE: JSON.stringify(pkg.license),
      __PKG_DEPENDENCIES: JSON.stringify(pkg.dependencies || {}),
      __PKG_DEV_DEPENDENCIES: JSON.stringify(pkg.devDependencies || {}),
      __PKG_PEER_DEPENDENCIES: JSON.stringify(pkg.peerDependencies || {}),
      __PKG_OPTIONAL_DEPENDENCIES: JSON.stringify(pkg.optionalDependencies || {}),
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
    },
    build: {
      target: 'esnext',
    },
    plugins: [
      nodePolyfills({
        include: ['buffer', 'process', 'util', 'stream', 'path'],
        globals: {
          Buffer: true,
          process: true,
          global: true,
        },
        protocolImports: true,
        exclude: ['child_process', 'fs', 'path'],
      }),
      {
        name: 'buffer-polyfill',
        transform(code, id) {
          if (id.includes('env.mjs')) {
            return {
              code: `import { Buffer } from 'buffer';\n${code}`,
              map: null,
            };
          }
          return null;
        },
      },
      // Only use Cloudflare dev proxy locally
      config.mode !== 'test' && !process.env.VERCEL && remixCloudflareDevProxy(),
      remixVitePlugin({
        future: {
          v3_fetcherPersist: true,
          v3_relativeSplatPath: true,
          v3_throwAbortReason: true,
          v3_lazyRouteDiscovery: true,
        },
      }),
      UnoCSS(),
      tsconfigPaths(),
      chrome129IssuePlugin(),
      config.mode === 'production' && optimizeCssModules({ apply: 'build' }),
    ],
    envPrefix: [
      'VITE_',
      'OPENAI_LIKE_API_BASE_URL',
      'OLLAMA_API_BASE_URL',
      'LMSTUDIO_API_BASE_URL',
      'TOGETHER_API_BASE_URL',
    ],
    css: {
      preprocessorOptions: {
        scss: {
          api: 'modern-compiler',
        },
      },
    },
  };
});

function chrome129IssuePlugin() {
  return {
    name: 'chrome129IssuePlugin',
    configureServer(server: ViteDevServer) {
      server.middlewares.use((req, res, next) => {
        const raw = req.headers['user-agent']?.match(/Chrom(e|ium)\/([0-9]+)\./);

        if (raw) {
          const version = parseInt(raw[2], 10);

          if (version === 129) {
            res.setHeader('content-type', 'text/html');
            res.end(
              `<html><body><h1>Unsupported Browser Version</h1><p>Chrome version 129 has a known issue that affects this application. Please downgrade to version 128 or upgrade to version 130 or later.</p></body></html>`,
            );
            return;
          }
        }

        next();
      });
    },
  };
}
