import { useTemplateRef, type SetupContext } from "vue";
import { normalizeClass, VaporFor } from "vue-jsx-vapor";
import { useDropdown } from "@/composables/useDropdown";
import DisplayColourList from "@/components/DisplayColourList";

type Props = {
	selectedCount: number;
	actions: SelectionAction[];
	showColours?: boolean;
};
type Events = {
	action: (key: SelectionAction["key"]) => void;
	cancel: () => void;
};

export default function SelectionActionBar(props: Props & EventBindings<Events>, { emit }: SetupContext<Events>) {
	const dropupTrigger = useTemplateRef<HTMLElement>("dropup-trigger");
	const dropdown = useDropdown(dropupTrigger);

	function colourSelected(colour: Colour) {
		emit("action", colour);
	}

	return (
		<>
			<div class="selection-action-bar">
				<span class="fw-medium">{props.selectedCount} selected</span>
				<DisplayColourList v-if={dropdown.show.value} onSelectionChanged={colourSelected}/>
				<div class="d-flex gap-2 flex-wrap justify-content-end w-100">
					<button v-if={props.showColours} ref="dropup-trigger" class="btn btn-sm btn-outline-primary dropdown-toggle" onClick={() => dropdown.toggle()}>Apply Colour</button>
					<VaporFor in={props.actions}>
						{action => (
							<button key={action.key} class={normalizeClass(["btn btn-sm", { [`btn-${action.variant}`]: true }])} onClick={() => emit(`action`, action.key)}>{action.label}</button>
						)}
					</VaporFor>
					<button class="btn btn-outline-secondary btn-sm" onClick={() => emit(`cancel`)}>Cancel</button>
				</div>
			</div>
		</>
	);
}