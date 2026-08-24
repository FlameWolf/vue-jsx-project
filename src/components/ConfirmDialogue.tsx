import { onBeforeUnmount, onMounted, VaporTransition, withModifiers } from "vue";
import { onCancel, onConfirm, state } from "@/composables/useConfirmDialogue";

const handlers: Record<string, (() => void) | undefined> = {
	Escape: onCancel,
	Enter: onConfirm
};

function onKeyDown(e: KeyboardEvent) {
	if (!(e.key in handlers && state.value.visible)) {
		return;
	}
	e.preventDefault();
	handlers[e.key]?.();
}

export default function ConfirmDialogue() {
	onMounted(() => {
		window.addEventListener("keydown", onKeyDown);
	});

	onBeforeUnmount(() => {
		window.removeEventListener("keydown", onKeyDown);
	});

	return (
		<>
			<VaporTransition name="confirm-fade">
				<div v-if={state.value.visible} class="confirm-overlay" onClick={withModifiers(onCancel, ["self"])}>
					<div class="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="`confirm-title`">
						<h5 id="confirm-title" class="confirm-title">{state.value.title}</h5>
						<p class="confirm-message">{state.value.message}</p>
						<div class="confirm-actions">
							<button type="button" class="btn btn-outline-secondary" onClick={onCancel}>{state.value.cancelText}</button>
							<button type="button" class={["btn", { [`btn-${state.value.variant}`]: true }]} onClick={onConfirm} autofocus={true}>{state.value.confirmText}</button>
						</div>
					</div>
				</div>
			</VaporTransition>
		</>
	);
}