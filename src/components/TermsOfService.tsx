import { termsEffectiveDate, termsIntro, termsSections } from "@/content/terms";
import LegalPage from "@/components/LegalPage";

function TermsOfService() {
	return <LegalPage title="Terms of Service" effectiveDate={termsEffectiveDate} intro={termsIntro} sections={termsSections}/>;
}

export default Object.assign(TermsOfService, { displayName: TermsOfService.name });