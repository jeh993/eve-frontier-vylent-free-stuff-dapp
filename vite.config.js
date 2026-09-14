import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig(({ command }) => ({
    base: "./",

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
}));