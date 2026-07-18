/** @type {import('next').NextConfig} */
const webpack = require("webpack");

const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    config.externals.push(
      "pino-pretty", "lokijs", "encoding",
      { "@react-native-async-storage/async-storage": "commonjs @react-native-async-storage/async-storage" }
    );
    // RainbowKit >=2.2 pulls in Coinbase's Base Account connector, which
    // references optional @x402/* payment-protocol packages we don't use on
    // Monad. Ignore the whole family instead of listing every leaf path.
    config.plugins.push(
      new webpack.IgnorePlugin({ resourceRegExp: /^@x402\// })
    );
    return config;
  },
};
module.exports = nextConfig;
