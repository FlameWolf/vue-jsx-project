import { privacyEffectiveDate, privacyIntro, privacySections } from "@/content/privacy";
import LegalPage from "@/components/LegalPage";

function PrivacyPolicy() {
	return <LegalPage title="Privacy Policy" effectiveDate={privacyEffectiveDate} intro={privacyIntro} sections={privacySections}/>;
}

export default Object.assign(PrivacyPolicy, { displayName: PrivacyPolicy.name });