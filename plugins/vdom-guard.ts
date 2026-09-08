import { relative } from "node:path";
import { Plugin } from "vite";
import type { PluginContext } from "rolldown";

interface Options {
	markers?: string[];
	maxChains?: number;
	failOnLeak?: boolean;
}

const DEFAULT_MARKERS = ["createVNode", "createBaseVNode", "createElementBlock", "createBlock", "openBlock", "withDirectives", "renderList"];
const rel = (id: string) => relative(process.cwd(), id.split("?")[0]);

/** Walk backward over importers (static + dynamic) from `target` to entries. */
function traceChains(ctx: PluginContext, target: string, maxChains: number): string[][] {
	const chains: string[][] = [];
	const queue: string[][] = [[target]];
	const seen = new Set<string>();
	while (queue.length && chains.length < maxChains) {
		const path = queue.shift()!;
		const head = path[0];
		if (seen.has(head)) {
			continue;
		}
		seen.add(head);
		const info = ctx.getModuleInfo(head);
		const importers = [...(info?.importers ?? []), ...(info?.dynamicImporters ?? [])];
		if (importers.length === 0) {
			chains.push(path); // reached an entry point
			continue;
		}
		for (const imp of importers) {
			if (!path.includes(imp)) queue.push([imp, ...path]);
		}
	}
	return chains;
}

export function vdomGuard(opts: Options = {}): Plugin {
	const { markers = DEFAULT_MARKERS, maxChains = 5, failOnLeak = false } = opts;
	const markerRes = markers.map(m => new RegExp(`\\b${m}\\b`));
	return {
		name: "vdom-guard",
		apply: "build",
		generateBundle(_output, bundle) {
			// 1. Modules that actually survived tree-shaking into a chunk.
			const includedIds = new Set<string>();
			for (const file of Object.values(bundle)) {
				if (file.type === "chunk") {
					for (const id of file.moduleIds) includedIds.add(id);
				}
			}
			// 2. Which included modules still carry a VDOM marker.
			const leaks: { id: string; hit: string }[] = [];
			for (const id of includedIds) {
				const code = this.getModuleInfo(id)?.code;
				if (!code) continue;
				const idx = markerRes.findIndex(re => re.test(code));
				if (idx !== -1) leaks.push({ id, hit: markers[idx] });
			}
			if (leaks.length === 0) {
				this.info("vdom-guard: no VDOM markers reached the bundle — pure Vapor output.");
				return;
			}
			// 3. Report each leak with the import chain that anchored it.
			const lines = ["vdom-guard: VDOM runtime leaked into the bundle:"];
			for (const { id, hit } of leaks) {
				lines.push(`\n  • ${rel(id)}  (marker: ${hit})`);
				for (const chain of traceChains(this, id, maxChains)) {
					lines.push("\t" + chain.map(rel).join("\n\t\t\u21B3 "));
				}
			}
			const report = lines.join("\n");
			failOnLeak ? this.error(report) : this.warn(report);
		}
	};
}