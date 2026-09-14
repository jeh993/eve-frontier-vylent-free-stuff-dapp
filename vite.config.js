import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig(({ command }) => ({
    base:
        command === "build"
            ? "/eve-frontier-vylent-free-stuff-dapp/dist/"
            : "/",

    build: {
        rollupOptions: {
            input: {
                main: resolve(__dirname, "index.html"),
                admin: resolve(__dirname, "admin.html"),
                eveAdmin: resolve(__dirname, "eve-admin.html"),
                eveDeposit: resolve(__dirname, "eve-deposit.html"),
            },
        },
    },

    server: {
        proxy: {
            "/sui-rpc": {
                target: "https://fullnode.testnet.sui.io",
                changeOrigin: true,
                secure: true,
                rewrite: (path) => path.replace(/^\/sui-rpc/, ""),
            },

            "/sui-mainnet-rpc": {
                target: "https://fullnode.mainnet.sui.io",
                changeOrigin: true,
                secure: true,
                rewrite: (path) => path.replace(/^\/sui-mainnet-rpc/, ""),
            },
        },
    },
}));