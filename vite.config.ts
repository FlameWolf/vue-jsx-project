import { fileURLToPath, URL } from "node:url";
import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { defineConfig, PluginOption } from "vite";
import vueJsxVapor from "vue-jsx-vapor/vite";
import purgeCSSPlugin from "@fullhuman/postcss-purgecss";

const apiProxy = {
	"/api": {
		target: "http://localhost:3000",
		changeOrigin: false
	}
};

function precacheManifestPlugin(): PluginOption {
	const CACHE_VERSION_PLACEHOLDER = `"__CACHE_VERSION__"`;
	const PRECACHE_MANIFEST_PLACEHOLDER = `["__PRECACHE_MANIFEST__"]`;
	const SHELL_FILES = ["/", "/index.html", "/favicon.svg", "/logo.svg", "/manifest.webmanifest"];

	let bundleAssetPaths: string[] = [];
	let outDir = "dist";

	return {
		name: "precache-manifest",
		apply: "build",
		writeBundle(options, bundle) {
			outDir = options.dir ?? "dist";
			bundleAssetPaths = Object.keys(bundle)
				.filter(name => !name.endsWith(".map") && name !== "sw.js")
				.map(name => "/" + name);
		},
		async closeBundle() {
			const swPath = path.resolve(outDir, "sw.js");
			const manifest = Array.from(new Set([...SHELL_FILES, ...bundleAssetPaths])).sort();
			const hash = crypto.createHash("sha256").update(manifest.join("\n")).digest("hex").slice(0, 8);
			const swContent = await fs.readFile(swPath, "utf-8");
			if (!swContent.includes(CACHE_VERSION_PLACEHOLDER) || !swContent.includes(PRECACHE_MANIFEST_PLACEHOLDER)) {
				throw new Error("precache-manifest: placeholders not found in sw.js");
			}
			const updated = swContent.replace(CACHE_VERSION_PLACEHOLDER, JSON.stringify(hash)).replace(PRECACHE_MANIFEST_PLACEHOLDER, JSON.stringify(manifest));
			await fs.writeFile(swPath, updated);
		}
	};
}

export default defineConfig(({ command }) => ({
	plugins: [vueJsxVapor({ macros: true }), precacheManifestPlugin()],
	resolve: {
		alias: {
			"@": fileURLToPath(new URL("./src", import.meta.url))
		}
	},
	css: {
		postcss: {
			plugins:
				command === "build"
					? [
							purgeCSSPlugin({
								content: ["./index.html", "./src/**/*.{vue,js,ts,jsx,tsx}"],
								defaultExtractor: content => content.match(/[\w-/:]+(?<!:)/g) || [],
								safelist: {
									standard: [/^btn-(outline-)?(primary|secondary|success|danger|warning|info|light|dark|link)$/, /^alert-(primary|secondary|success|danger|warning|info|light|dark)$/, /^bg-(none|black|silver|grey|white|maroon|red|purple|fuchsia|green|lime|olive|yellow|navy|blue|teal|aqua)$/, "d-hidden"]
								}
							})
						]
					: []
		}
	},
	...(command === "serve" && {
		server: {
			proxy: apiProxy
		},
		preview: {
			proxy: apiProxy
		}
	}),
	build: {
		rollupOptions: {
			output: {
				manualChunks(id) {
					const vendorModules = ["node_modules/@vue/", "node_modules/@vue-jsx-vapor/", "node_modules/vue/", "node_modules/vue-jsx-vapor/", "node_modules/vue-router/"];
					if (vendorModules.some(module => id.includes(module))) {
						return "vendor-vue";
					}
				}
			}
		}
	}
}));