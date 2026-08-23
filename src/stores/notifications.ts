import { readonly, ref } from "vue";
import type { UUID } from "crypto";

type Notification = {
	id: UUID;
	type: "success" | "info" | "warning" | "danger";
	timeStamp: number;
	message: string;
	removeTimer?: ReturnType<typeof setTimeout>;
};
type NotificationList = Array<Notification>;

const store = ref<NotificationList>([]);
export const notifications = readonly(store);

function createNotification(type: Notification["type"], message: string) {
	const notification: Notification = {
		id: crypto.randomUUID() as UUID,
		type,
		timeStamp: Date.now(),
		message
	};
	if (type !== "danger") {
		notification.removeTimer = setTimeout(() => {
			deleteNotification(notification);
		}, 5000);
	}
	if (store.value.length >= 5) {
		deleteNotification(store.value[0]!);
	}
	store.value.push(notification);
}

function deleteNotification(notification: Notification) {
	clearTimeout(notification.removeTimer);
	store.value.splice(store.value.indexOf(notification), 1);
}

export function addNotification(type: Notification["type"], message: string) {
	const existingNotification = store.value.find(n => n.message === message && n.type === type);
	if (!existingNotification) {
		createNotification(type, message);
		return;
	}
	deleteNotification(existingNotification);
	setTimeout(() => createNotification(type, message), 250);
}

export function removeNotification(id: UUID) {
	const notification = store.value.find(n => n.id === id);
	if (notification) {
		deleteNotification(notification);
	}
}