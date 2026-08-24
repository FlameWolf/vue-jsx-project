import { computed } from "vue";
import { VaporFor } from "vue-jsx-vapor";
import { notifications, removeNotification } from "@/stores/notifications";

export default function NotificationList() {
	const sortedNotifications = computed(() => notifications.value.toSorted((a, b) => b.timeStamp - a.timeStamp));

	return (
		<>
			<div class="d-flex flex-column gap-2 notification-list position-fixed end-0 bottom-0 me-2 mb-2">
				<VaporFor in={sortedNotifications.value}>
					{notification => (
						<template key={notification.id}>
							<div class={["alert m-0 ms-auto", { [`alert-${notification.type}`]: true }]} role="alert">
								<div class="d-flex">
									<div v-html={notification.message}></div>
									<button class="btn-close ms-2" onClick={() => removeNotification(notification.id)} aria-label="Close"></button>
								</div>
							</div>
						</template>
					)}
				</VaporFor>
			</div>
		</>
	);
}