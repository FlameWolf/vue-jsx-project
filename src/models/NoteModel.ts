import { emptyString } from "@/constants/common";
import { parseValidDate } from "@/utils/dates";
import { isValidCount } from "@/utils/numbers";
import { equals, getCharacterCount, getSentenceCount, getSummary, getWordCount } from "@/utils/text-analysis";
import type { UUID } from "crypto";

export interface NoteMetaJSON {
	id: string;
	title: string;
	createdAt: string;
	modifiedAt?: string;
	favedAt?: string;
	pinnedAt?: string;
	archivedAt?: string;
	deletedAt?: string;
	stateChangedAt?: string;
	colour?: string;
	tags?: string[];
	summary: string;
	sentenceCount: number;
	wordCount: number;
	characterCount: number;
}

export interface NoteJSON extends NoteMetaJSON {
	content?: string;
}

export class NoteModel {
	id: UUID;
	title: string;
	content?: string;
	createdAt: Date;
	modifiedAt?: Date;
	favedAt?: Date;
	pinnedAt?: Date;
	archivedAt?: Date;
	deletedAt?: Date;
	stateChangedAt?: Date;
	colour?: string;
	tags?: string[];
	summary!: string;
	sentenceCount!: number;
	wordCount!: number;
	characterCount!: number;

	constructor(title: string, content?: string, id?: UUID) {
		this.id = id ?? crypto.randomUUID();
		this.title = title;
		this.content = content;
		this.createdAt = new Date();
		if (content !== undefined) {
			this.computeDerived();
		}
	}

	computeDerived() {
		const content = this.content ?? emptyString;
		this.summary = getSummary(content);
		this.sentenceCount = getSentenceCount(content);
		this.wordCount = getWordCount(content);
		this.characterCount = getCharacterCount(content);
	}

	update(title: string, content: string) {
		this.title = title;
		this.content = content;
		this.modifiedAt = new Date();
		this.computeDerived();
	}

	fave() {
		if (this.deletedAt) {
			return;
		}
		const now = new Date();
		this.favedAt = now;
		this.stateChangedAt = now;
	}

	unfave() {
		this.favedAt = undefined;
		this.stateChangedAt = new Date();
	}

	pin() {
		if (this.archivedAt || this.deletedAt) {
			return;
		}
		const now = new Date();
		this.pinnedAt = now;
		this.stateChangedAt = now;
	}

	unpin() {
		this.pinnedAt = undefined;
		this.stateChangedAt = new Date();
	}

	archive() {
		const now = new Date();
		this.pinnedAt = undefined;
		this.archivedAt = now;
		this.stateChangedAt = now;
	}

	unarchive() {
		this.archivedAt = undefined;
		this.stateChangedAt = new Date();
	}

	trash() {
		const now = new Date();
		this.pinnedAt = undefined;
		this.deletedAt = now;
		this.stateChangedAt = now;
	}

	restore() {
		this.deletedAt = undefined;
		this.stateChangedAt = new Date();
	}

	setColour(colour: string) {
		this.colour = colour;
		this.stateChangedAt = new Date();
	}

	unsetColour() {
		this.colour = undefined;
		this.stateChangedAt = new Date();
	}

	addTags(tags: string[]) {
		tags.forEach(tag => {
			if (!tag) {
				return;
			}
			this.tags ??= [];
			if (this.tags.some(x => equals(x, tag))) {
				return;
			}
			this.tags.push(tag);
		});
		this.stateChangedAt = new Date();
	}

	removeTags(tags: string[]) {
		tags.forEach(tag => {
			if (!this.tags) {
				return;
			}
			const index = this.tags.findIndex(x => equals(x, tag));
			if (index !== -1) {
				this.tags.splice(index, 1);
			}
		});
		this.stateChangedAt = new Date();
	}

	toMetaJSON(): NoteMetaJSON {
		return {
			id: this.id,
			title: this.title,
			createdAt: this.createdAt.toISOString(),
			modifiedAt: this.modifiedAt?.toISOString(),
			favedAt: this.favedAt?.toISOString(),
			pinnedAt: this.pinnedAt?.toISOString(),
			archivedAt: this.archivedAt?.toISOString(),
			deletedAt: this.deletedAt?.toISOString(),
			stateChangedAt: this.stateChangedAt?.toISOString(),
			colour: this.colour,
			tags: this.tags,
			summary: this.summary,
			sentenceCount: this.sentenceCount,
			wordCount: this.wordCount,
			characterCount: this.characterCount
		};
	}

	toJSON(): NoteJSON {
		return Object.assign(this.toMetaJSON(), {
			content: this.content
		});
	}

	static fromJSON(data: NoteJSON): NoteModel {
		const note = new NoteModel(data.title, data.content, data.id as UUID);
		note.createdAt = parseValidDate(data.createdAt) ?? note.createdAt;
		note.modifiedAt = parseValidDate(data.modifiedAt);
		note.favedAt = parseValidDate(data.favedAt);
		note.pinnedAt = parseValidDate(data.pinnedAt);
		note.archivedAt = parseValidDate(data.archivedAt);
		note.deletedAt = parseValidDate(data.deletedAt);
		note.stateChangedAt = parseValidDate(data.stateChangedAt);
		note.colour = data.colour;
		note.tags = data.tags;
		if (typeof data.summary === "string" && isValidCount(data.sentenceCount) && isValidCount(data.wordCount) && isValidCount(data.characterCount)) {
			note.summary = data.summary;
			note.sentenceCount = data.sentenceCount;
			note.wordCount = data.wordCount;
			note.characterCount = data.characterCount;
		} else {
			note.computeDerived();
		}
		return note;
	}
}