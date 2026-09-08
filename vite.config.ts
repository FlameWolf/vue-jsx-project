import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import vueJsxVapor from "vue-jsx-vapor/vite";
import purgeCSSPlugin from "@fullhuman/postcss-purgecss";
import { precacheManifest } from "./plugins/precache-manifest.js";
import { vdomGuard } from "./plugins/vdom-guard.js";

const apiProxy = {
	"/api": {
		target: "http://localhost:3000",
		changeOrigin: false
	}
};

export default defineConfig(({ command }) => ({
	plugins: [vueJsxVapor(), precacheManifest(), vdomGuard()],
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