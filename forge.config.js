const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { WebpackPlugin } = require('@electron-forge/plugin-webpack');

// Prefer fewer native file watchers. Allow opting into polling if env is set.
const usePolling = process.env.WATCHPACK_POLLING === 'true' || process.env.CHOKIDAR_USEPOLLING === '1';
const commonWatchOptions = {
  ignored: ['**/node_modules/**', '**/.git/**', '**/.webpack/**', '**/dist/**'],
  followSymlinks: false,
  aggregateTimeout: 300,
  ...(usePolling ? { poll: 1000 } : {}),
};

/** @type {import('@electron-forge/shared-types').ForgeConfig} */
module.exports = {
  packagerConfig: {
    icon: undefined,
  },
  rebuildConfig: {},
  plugins: [
    new WebpackPlugin({
      // Avoid default logger port 9000 conflicts
      loggerPort: 9010,
      mainConfig: {
        mode: process.env.NODE_ENV || 'development',
        entry: {
          main: path.resolve(__dirname, 'src/main/main.ts'),
          tabPreload: path.resolve(__dirname, 'src/tabPreload.ts'),
          'preload-view': path.resolve(__dirname, 'src/main/preload-view.ts'),
        },
        target: 'electron-main',
        externals: {
          'better-sqlite3': 'commonjs2 better-sqlite3',
        },
        watchOptions: commonWatchOptions,
        module: {
          rules: [
            {
              test: /\.ts$/,
              exclude: /node_modules/,
              use: 'ts-loader',
            },
          ],
        },
        resolve: { extensions: ['.ts', '.js'] },
        output: { path: path.resolve(__dirname, '.webpack/main'), filename: '[name].js' },
      },
      renderer: {
        config: {
          mode: process.env.NODE_ENV || 'development',
          target: 'web',
          entry: { renderer: path.resolve(__dirname, 'src/renderer/index.tsx') },
          watchOptions: commonWatchOptions,
          module: {
            rules: [
              {
                test: /\.(ts|tsx)$/,
                exclude: /node_modules/,
                use: 'ts-loader',
              },
              {
                test: /\.css$/,
                use: ['style-loader', 'css-loader', 'postcss-loader'],
              },
            ],
          },
          resolve: { extensions: ['.ts', '.tsx', '.js'] },
          plugins: [
            new HtmlWebpackPlugin({
              template: path.resolve(__dirname, 'src/renderer/index.html'),
              filename: 'index.html',
            }),
          ],
          devServer: {
            static: false,
            client: { overlay: false },
            hot: true,
            devMiddleware: { writeToDisk: false },
            watchFiles: [
              'src/renderer/**/*',
              'src/preload.ts',
              'src/main/**/*.ts',
              '!**/node_modules/**',
              '!**/.webpack/**',
            ],
          },
        },
        entryPoints: [
          {
            html: path.resolve(__dirname, 'src/renderer/index.html'),
            js: path.resolve(__dirname, 'src/renderer/index.tsx'),
            name: 'main_window',
            preload: {
              js: path.resolve(__dirname, 'src/preload.ts'),
            },
          },
        ],
      },
    }),
  ],
};
