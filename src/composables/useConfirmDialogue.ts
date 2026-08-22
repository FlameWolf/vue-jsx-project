import { ref, readonly } from "vue";
import { emptyString } from "@/constants/common";

export type ConfirmVariant = "danger" | "primary" | "warning";
export interface ConfirmOptions {
	title: string;
	message: string;
	confirmText?: string;
	cancelText?: string;
	variant?: ConfirmVariant;
}
interface ConfirmState {
	visible: boolean;
	title: string;
	message: string;
	confirmText: string;
	cancelText: string;
	variant: ConfirmVariant;
}

let resolver: ((value: boolean) => void) | null = null;
const params = ref<ConfirmState>({
	visible: false,
	title: emptyString,
	message: emptyString,
	confirmText: "Confirm",
	cancelText: "Cancel",
	variant: "primary"
});
export const state = readonly(params);

export function confirm(options: ConfirmOptions): Promise<boolean> {
	return new Promise(resolve => {
		if (resolver) {
			resolver(false);
		}
		params.value = {
			visible: true,
			title: options.title,
			message: options.message,
			confirmText: options.confirmText ?? "Confirm",
			cancelText: options.cancelText ?? "Cancel",
			variant: options.variant ?? "primary"
		};
		resolver = resolve;
	});
}

export function onConfirm() {
	const r = resolver;
	resolver = null;
	params.value.visible = false;
	if (r) {
		r(true);
	}
}

export function onCancel() {
	const r = resolver;
	resolver = null;
	params.value.visible = false;
	if (r) {
		r(false);
	}
}