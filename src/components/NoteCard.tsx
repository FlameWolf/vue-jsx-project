import { computed, withModifiers, type SetupContext } from "vue";
import { VaporFor } from "vue-jsx-vapor";
import { RouterLink } from "vue-router";
import { emptyString } from "@/constants/common";
import * as notesStore from "@/stores/notes";
import Icon from "@/components/Icon";
import type { NoteModel } from "@/models/NoteModel";
import type { UUID } from "crypto";

type Props = {
	note: NoteModel;
	selectionMode: boolean;
	selected: boolean;
};
type Events = { toggleSelect: (id: UUID) => void };

export default function NoteCard(props: Props & EventBindings<Events>, { emit }: SetupContext<Events>) {
	const note = computed(() => props.note);
	const colourClass = computed(() => (note.value.colour ? { [`bg-${note.value.colour}`]: true } : {}));

	function formatDate(date?: Date): string {
		if (!date) {
			return emptyString;
		}
		return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
	}

	function handleClick(e?: Event) {
		if (props.selectionMode) {
			e?.preventDefault();
			emit("toggleSelect", note.value.id);
		}
	}

	function addToSearchTags(tag: string) {
		if (props.selectionMode) {
			return;
		}
		notesStore.addSearchTag(tag);
	}

	return (
		<>
			<RouterLink to={`/notes/${note.value.id}`} class={["card note-card text-decoration-none position-relative", { ...colourClass, selected: props.selectionMode && props.selected }]} onClick_capture={handleClick}>
				<div v-if={note.value.pinnedAt || note.value.favedAt} class="d-flex gap-2 small position-absolute top-0 p-2 status-badge">
					<Icon v-if={note.value.pinnedAt} type="pinAngleFill"/>
					<Icon v-if={note.value.favedAt} type="starFill"/>
				</div>
				<div class="card-body d-flex flex-column">
					<input v-if={props.selectionMode} type="checkbox" class="form-check-input selection-checkbox rounded-circle" checked={props.selected}/>
					<div class="d-flex gap-1 mb-2">
						<div class="text-truncate">{note.value.title}</div>
						<div class="badge align-self-center border ms-auto">{formatDate(note.value.modifiedAt ?? note.value.createdAt)}</div>
					</div>
					<p class="card-text small overflow-hidden">{note.value.summary}</p>
				</div>
				<div class="bg-body small w-100 position-absolute bottom-0">
					<div v-if={note.value.tags} class="d-flex gap-1 px-2 py-2">
						<VaporFor in={note.value.tags as string[]}>
							{tag => (<a class="badge text-bg-secondary" role="button" onClick={withModifiers(() => addToSearchTags(tag), ["prevent"])}>#{tag}</a>)}
						</VaporFor>
					</div>
					<div class="d-flex gap-1 px-2 py-2 border-top">
						<div class="badge text-bg-secondary" v-if={note.value.sentenceCount}>{note.value.sentenceCount} sentences</div>
						<div class="badge text-bg-secondary" v-if={note.value.wordCount}>{note.value.wordCount} words</div>
						<div class="badge text-bg-secondary" v-if={note.value.characterCount}>{note.value.characterCount} characters</div>
					</div>
				</div>
			</RouterLink>
		</>
	);
}