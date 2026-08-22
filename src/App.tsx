import "@/styles.css";
import { addNotification } from "@/stores/notifications";
import ThemeToggle from "@/components/ThemeToggle";
import NotificationList from "@/components/NotificationList";

export default function App() {
	addNotification("success", "Test notification");

	return (
		<>
			<h1>Hello World!</h1>
			<ThemeToggle/>
			<NotificationList/>
		</>
	);
}