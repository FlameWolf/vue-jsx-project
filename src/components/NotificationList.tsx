import { computed, Fragment, ref } from "vue";
import { VaporFor } from "vue-jsx-vapor";
import { notifications, removeNotification, type Notification } from "@/stores/notifications";

export default function NotificationList() {
	const sortedNotifications = computed(() => notifications.value.toSorted((a, b) => b.timeStamp - a.timeStamp));

	return (
		<>
			<div class="d-flex flex-column gap-2 notification-list position-fixed end-0 bottom-0 me-2 mb-2">
				<VaporFor in={sortedNotifications.value}>
					{(notification: Notification) => (
						<Fragment key={notification.id}>
							<div class={`alert alert-${notification.type} m-0 ms-auto`} role="alert">
								<div class="d-flex">
									<div v-html={notification.message}></div>
									<button class="btn-close ms-2" onClick={() => removeNotification(notification.id)} aria-label="Close"></button>
								</div>
							</div>
						</Fragment>
					)}
				</VaporFor>
			</div>
		</>
	);
}