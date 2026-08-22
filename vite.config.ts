import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import vueJsxVapor from "vue-jsx-vapor/vite";

export default defineConfig({
	plugins: [vueJsxVapor({ macros: true })],
	resolve: {
		alias: {
			"@": fileURLToPath(new URL("./src", import.meta.url))
		}
	}
});