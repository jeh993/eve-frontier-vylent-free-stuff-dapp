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
                index: resolve(process.cwd(), "index.html"),
                admin: resolve(process.cwd(), "admin.html"),
            },
        },
    },
}));