const { build } = require("esbuild");
const { copyFile } = require("fs/promises");
const { resolve } = require("path");

const baseOptions = {
    entryPoints: ["./src/index.ts"],
    platform: "node",
    target: "es2018",
    bundle: true,
    external: ["@glideapps/ts-necessities"],
};

async function buildPackage() {
    try {
        // Build ESM version
        await build({
            ...baseOptions,
            outfile: "./dist/index.mjs",
            format: "esm",
        });

        // Build CommonJS version
        await build({
            ...baseOptions,
            outfile: "./dist/index.js",
            format: "cjs",
        });

        // Copy the TypeScript declarations
        await copyFile(
            resolve("./dist/index.d.ts"),
            resolve("./dist/index.d.mts")
        ).catch((err) => {
            // Ignore if the file doesn't exist, as TypeScript doesn't generate .d.mts files
            if (err.code !== "ENOENT") {
                throw err;
            }
        });

        console.log("✅ Build completed");
    } catch (err) {
        console.error("❌ Build failed:", err);
        process.exit(1);
    }
}

buildPackage();
