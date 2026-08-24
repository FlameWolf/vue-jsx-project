import { privacyEffectiveDate, privacyIntro, privacySections } from "@/content/privacy";
import LegalPage from "@/components/LegalPage";

export default function PrivacyPolicy() {
	return <LegalPage title="Privacy Policy" effectiveDate={privacyEffectiveDate} intro={privacyIntro} sections={privacySections}/>;
}