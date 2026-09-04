import { normalizeClass, VaporFor } from "vue-jsx-vapor";
import { colours } from "@/constants/colours";
import * as notesStore from "@/stores/notes";
import Icon from "@/components/Icon";
import type { SetupContext } from "vue";

type Props = {
	filterMode?: boolean;
	selected?: Colour;
};
type Events = {
	selectionChanged: (colour: Colour) => void;
};

export default function DisplayColourList(props: Props & EventBindings<Events>, { emit }: SetupContext<Events>) {
	function isActive(colour: Colour) {
		if (props.filterMode) {
			return notesStore.searchColours.value.has(colour);
		}
		return props.selected === colour;
	}

	return (
		<>
			<div class="d-flex flex-wrap gap-2 p-2 border rounded">
				<VaporFor in={colours}>
					{colour => (
						<a class={normalizeClass(["colour-circle rounded-circle", { [`bg-${colour}`]: true }])} onClick={() => emit(`selectionChanged`, colour)} role="button" aria-label={colour}>
							<Icon v-if={isActive(colour)} type="check2"/>
						</a>
					)}
				</VaporFor>
			</div>
		</>
	);
}