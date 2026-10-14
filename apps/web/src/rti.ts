// "Draft my RTI": builds a Right to Information application about one fair-price shop, with Tolmol's
// on-chain evidence attached as an annex. Personal details are left as blanks to fill in by hand:
// Tolmol never asks for, stores or sends a name, address or card number.
//
// Legal basis (Right to Information Act, 2005): s.6(1) request in English, Hindi or the official language;
// s.6(2) no reasons needed; s.7(1) reply within 30 days; s.7(5) no fee for persons below the poverty line.
import { dedupeReports, explorerEntityUrl, formatBp, formatKg, shopStats, validWitnesses, type Report, type Shop, type Witness } from "tolmol-sdk"
import type { Lang } from "./i18n"

export type RtiInput = {
  shop: Pick<Shop, "shopId" | "district" | "state" | "labelEn" | "labelHi"> | undefined
  shopId: string
  months: string[]
  reports: Report[]
  witnesses: Witness[]
  atBlock: bigint
  pageUrl: string
}

const STATE_EN: Record<string, string> = { BR: "Bihar", UP: "Uttar Pradesh", JH: "Jharkhand" }
const STATE_HI: Record<string, string> = { BR: "बिहार", UP: "उत्तर प्रदेश", JH: "झारखंड" }

export function draftRti(input: RtiInput, lang: Lang): string {
  const kept = dedupeReports(input.reports)
  const stats = shopStats(input.reports, input.witnesses)[0]
  const months = input.months.length ? input.months.join(", ") : "—"
  const district = input.shop?.district ? input.shop.district[0]!.toUpperCase() + input.shop.district.slice(1) : "[district]"
  const state = input.shop ? (lang === "hi" ? STATE_HI : STATE_EN)[input.shop.state] ?? input.shop.state : "[state]"
  const evidence = kept
    .map((r) => `- ${r.month} ${r.item}: ${formatKg(r.receivedG)} / ${formatKg(r.entitledG)} (${formatBp(r.shortfallBp)}), ${validWitnesses(r, input.witnesses).length} conf. ${explorerEntityUrl(r.key)}`)
    .join("\n")
  const summary = stats
    ? `${stats.reports} reports from ${stats.reporters} devices; total shortfall ${formatKg(stats.totalShortfallG)} of ${formatKg(stats.totalEntitledG)} (${formatBp(stats.shortfallBp)}); ${stats.corroborated} reports confirmed by other devices.`
    : "No reports recorded."
  const synthetic = input.shopId.startsWith("SYN-")

  if (lang === "hi") {
    return `सेवा में,
लोक सूचना अधिकारी (PIO),
ज़िला आपूर्ति कार्यालय, ${district}, ${state}

विषय: सूचना का अधिकार अधिनियम, 2005 की धारा 6(1) के तहत आवेदन — उचित मूल्य दुकान ${input.shopId}

महोदय/महोदया,

कृपया उचित मूल्य दुकान ${input.shopId} के बारे में ${months} महीनों की निम्नलिखित सूचना की प्रमाणित प्रतियाँ दें:

1. दुकान को आवंटित और उठाए गए अनाज (चावल, गेहूँ, मोटा अनाज) की मात्रा।
2. स्टॉक रजिस्टर और बिक्री/वितरण रजिस्टर।
3. ePoS लेन-देन का विवरण (कार्ड-वार नाम छिपाकर), और प्रमाणीकरण विफलताओं की संख्या।
4. इस दुकान के इलेक्ट्रॉनिक तराज़ू के ePoS से जुड़े होने की स्थिति।
5. इन महीनों में दुकान के निरीक्षण की रिपोर्ट और कम तौल की शिकायतों पर की गई कार्रवाई।

धारा 6(2) के अनुसार मुझे सूचना माँगने का कारण बताना आवश्यक नहीं है। धारा 7(1) के अनुसार सूचना 30 दिनों के भीतर दी जानी चाहिए।
[ ] आवेदन शुल्क ₹10 संलग्न है।   [ ] मैं गरीबी रेखा से नीचे (BPL) हूँ, धारा 7(5) के तहत शुल्क नहीं लगेगा (प्रमाण संलग्न)।

आवेदक का नाम: ______________________
पता: ______________________________
दिनांक: ____________   हस्ताक्षर: ____________

संलग्नक: तोलमोल पर दर्ज सार्वजनिक रिकॉर्ड (Arkiv Tiramisu, ब्लॉक ${input.atBlock})
${summary}
${evidence}
पूरा रिकॉर्ड: ${input.pageUrl}
${synthetic ? "\nनोट: यह डेमो दुकान नकली (सिंथेटिक) है। असली आवेदन के लिए अपनी असली दुकान का नंबर लिखें।\n" : ""}`
  }

  return `To,
The Public Information Officer (PIO),
District Supply Office, ${district}, ${state}

Subject: Application under Section 6(1) of the Right to Information Act, 2005 — Fair Price Shop ${input.shopId}

Sir/Madam,

Please provide certified copies of the following information about Fair Price Shop ${input.shopId} for ${months}:

1. Quantity of foodgrains (rice, wheat, coarse grains) allocated to and lifted by the shop.
2. The shop's stock register and sale/distribution register.
3. ePoS transaction records (with card holders' names masked) and the number of failed authentications.
4. Whether the shop's electronic weighing scale is integrated with its ePoS device.
5. Inspection reports for the shop in these months, and action taken on complaints of under-weighing.

Under Section 6(2) I am not required to give reasons for this request. Under Section 7(1) the information is due within 30 days.
[ ] The application fee of Rs 10 is enclosed.   [ ] I am below the poverty line (BPL); no fee is payable under Section 7(5) (proof enclosed).

Name of applicant: ______________________
Address: ________________________________
Date: ____________   Signature: ____________

Annex: public record on Tolmol (Arkiv Tiramisu, read at block ${input.atBlock})
${summary}
${evidence}
Full record: ${input.pageUrl}
${synthetic ? "\nNote: this demo shop is SYNTHETIC. For a real application, write your real shop's number.\n" : ""}`
}
