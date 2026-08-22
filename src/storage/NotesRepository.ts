import { NoteModel, type NoteMetaJSON } from "@/models/NoteModel";
import * as db from "@/storage/db";
import { tagsRepository } from "@/storage/TagsRepository";
import type { UUID } from "crypto";

class NotesRepository {
	async loadAll(): Promise<NoteModel[]> {
		return (await db.getAllNotes()).map(NoteModel.fromJSON);
	}

	async loadContent(id: UUID): Promise<string | undefined> {
		return await db.getNoteContent(id);
	}

	async search(predicate: (content: string) => boolean): Promise<Set<string>> {
		return await db.searchContents(predicate);
	}

	async saveFull(note: NoteModel): Promise<void> {
		const noteJson = note.toJSON();
		await db.putNote(noteJson);
		note.content = undefined;
		delete noteJson.content;
		await this.saveTags(noteJson);
	}

	async saveManyFull(notes: NoteModel[]): Promise<void> {
		const noteJsons = notes.map(note => note.toJSON());
		await db.putNotes(noteJsons);
		notes.forEach(note => (note.content = undefined));
		noteJsons.forEach(json => delete json.content);
		await this.saveManyTags(noteJsons);
	}

	async getTagsToSave(meta: NoteMetaJSON): Promise<string[]> {
		const tagsToSave: string[] = [];
		if (meta.tags) {
			for (const tag of meta.tags) {
				if (!(await tagsRepository.load(tag))) {
					tagsToSave.push(tag);
				}
			}
		}
		return tagsToSave;
	}

	async saveTags(meta: NoteMetaJSON) {
		if (meta.tags) {
			const tagsToSave = await this.getTagsToSave(meta);
			if (tagsToSave.length) {
				tagsRepository.saveMany(tagsToSave);
			}
		}
	}

	async saveManyTags(metas: NoteMetaJSON[]) {
		const tagsToSave = (await Promise.all(metas.map(this.getTagsToSave))).flat();
		if (tagsToSave.length) {
			tagsRepository.saveMany(tagsToSave);
		}
	}

	async saveMeta(note: NoteModel): Promise<void> {
		const meta = note.toMetaJSON();
		await db.putNoteMeta(meta);
		await this.saveTags(meta);
	}

	async saveManyMeta(notes: NoteModel[]): Promise<void> {
		const metas = notes.map(note => note.toMetaJSON());
		await db.putNotesMeta(metas);
		await this.saveManyTags(metas);
	}

	async remove(id: UUID): Promise<void> {
		await db.deleteNote(id);
	}

	async removeMany(ids: UUID[]): Promise<void> {
		await db.deleteNotes(ids);
	}
}

export const notesRepository = new NotesRepository();