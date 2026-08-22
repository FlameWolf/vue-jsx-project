import { computed, Fragment } from "vue";

type Props = {
	message?: string;
	minimal?: boolean;
	showMessage?: boolean;
	tag?: string;
};

export default function Spinner(props: Props) {
	const showMessage = computed(() => props.showMessage ?? true);
	const dynamic = computed(() => props.tag ?? "div");
	const dynamicProps = { class: "spinner-border spinner-border-sm", role: "status" };

	return (
		<>
			<Fragment v-if={!props.minimal}>
				<div class={["d-flex", "flex-column", "justify-content-center", "align-items-center", { [`py-3`]: !showMessage.value }]}>
					<div class="spinner-border" aria-hidden="true" aria-label={showMessage.value ? undefined : props.message}></div>
					<div v-if={showMessage.value} class="mt-3" role="status">{props.message ?? "Loading..."}</div>
				</div>
			</Fragment>
			<dynamic.value v-else {...dynamicProps}></dynamic.value>
		</>
	);
}