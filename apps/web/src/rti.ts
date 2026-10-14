// "Draft my RTI": builds a Right to Information application about one fair-price shop, with Tolmol's
// on-chain evidence attached as an annex. Personal details are left as blanks to fill in by hand:
// Tolmol never asks for, stores or sends a name, address or card number.
//
// Legal basis (Right to Information Act, 2005): s.6(1) request in English, Hindi or the official language;
// s.6(2) no reasons needed; s.7(1) reply within 30 days; s.7(5) no fee for persons below the poverty line.
import { dedupeReports, explorerEntityUrl, formatBp, formatKg, issueList, shopStats, validWitnesses, type Report, type Shop, type Witness, type IssueName } from "tolmol-sdk"
import { districtName, monthName, type Lang } from "./i18n"

export type RtiInput = {
  shop: Pick<Shop, "shopId" | "district" | "state" | "labelEn" | "labelHi"> | undefined
  shopId: string
  months: string[]
  reports: Report[]
  witnesses: Witness[]
  atBlock: bigint
  pageUrl: string
  /** Keys of reports their own reporter withdrew; left out of the evidence. */
  withdrawn?: ReadonlySet<string>
}

const ITEM_EN: Record<string, string> = { rice: "rice", wheat: "wheat", millet: "coarse grain", total: "all grain" }
const ITEM_HI: Record<string, string> = { rice: "चावल", wheat: "गेहूँ", millet: "मोटा अनाज", total: "कुल अनाज" }
const STATE_EN: Record<string, string> = { BR: "Bihar", UP: "Uttar Pradesh", JH: "Jharkhand" }
const STATE_HI: Record<string, string> = { BR: "बिहार", UP: "उत्तर प्रदेश", JH: "झारखंड" }

export function draftRti(input: RtiInput, lang: Lang): string {
  const kept = dedupeReports(input.reports, input.withdrawn)
  const stats = shopStats(input.reports, input.witnesses, input.withdrawn)[0]
  const months = input.months.length ? input.months.map((m) => monthName(m, lang)).join(", ") : "—"
  const district = input.shop?.district ? districtName(input.shop.district, lang) : "[district]"
  const kg = (g: number) => (lang === "hi" ? formatKg(g).replace(" kg", " किलो") : formatKg(g))
  const state = input.shop ? (lang === "hi" ? STATE_HI : STATE_EN)[input.shop.state] ?? input.shop.state : "[state]"
  const evidence = kept
    .map((r) => `- ${monthName(r.month, lang)} ${(lang === "hi" ? ITEM_HI : ITEM_EN)[r.item] ?? r.item}: ${kg(r.receivedG)} / ${kg(r.entitledG)} (${formatBp(r.shortfallBp)}), ${validWitnesses(r, input.witnesses).length} ${lang === "hi" ? "पुष्टि" : "conf."} ${explorerEntityUrl(r.key)}`)
    .join("\n")
  const summary = stats
    ? lang === "hi"
      ? `${stats.reporters} डिवाइसों से ${stats.reports} रिपोर्टें; कुल कमी ${kg(stats.totalShortfallG)}, ${kg(stats.totalEntitledG)} में से (${formatBp(stats.shortfallBp)}); ${stats.corroborated} रिपोर्टों की दूसरे डिवाइसों ने पुष्टि की।`
      : `${stats.reports} reports from ${stats.reporters} devices; total shortfall ${kg(stats.totalShortfallG)} of ${kg(stats.totalEntitledG)} (${formatBp(stats.shortfallBp)}); ${stats.corroborated} reports confirmed by other devices.`
    : lang === "hi"
      ? "कोई रिपोर्ट दर्ज नहीं।"
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

const ISSUE_TEXT: Record<Lang, Record<IssueName, string>> = {
  en: {
    charged_money: "money was demanded for grain that is free",
    auth_failed: "authentication failed and no grain was given",
    thumb_no_grain: "the thumbprint was taken but the full grain was not given",
    shop_closed: "the shop was closed on distribution day",
    bad_quality: "the grain was of bad quality",
    portability_refused: "a ration card from another place was refused",
    no_receipt: "no receipt was given",
    slip_mismatch: "the machine slip recorded more grain than was handed over",
    no_weighing: "the grain was not weighed in front of the card holder",
    tied_sale: "card holders were made to buy other items to get their ration",
    card_kept: "the dealer kept the ration card, which clause 10(3) of the TPDS (Control) Order 2015 forbids",
    no_board: "there was no board showing entitlement, price, timings and stock (clause 10(4)(ii))",
    told_lapsed: "card holders were told that their ration had lapsed or not arrived",
    many_trips: "card holders had to come three or more times",
    wrong_grain: "a different grain was given, or one grain was not given at all",
    threatened: "card holders were scolded or threatened for asking",
    member_left_out: "a family member's share was left out",
  },
  hi: {
    charged_money: "मुफ़्त अनाज के लिए पैसे माँगे गए",
    auth_failed: "प्रमाणीकरण नहीं हुआ और अनाज नहीं दिया गया",
    thumb_no_grain: "अंगूठा लगवाया गया पर पूरा अनाज नहीं दिया गया",
    shop_closed: "वितरण के दिन दुकान बंद थी",
    bad_quality: "अनाज ख़राब गुणवत्ता का था",
    portability_refused: "दूसरी जगह का राशन कार्ड नहीं माना गया",
    no_receipt: "रसीद नहीं दी गई",
    slip_mismatch: "मशीन की पर्ची में दिए गए अनाज से ज़्यादा दर्ज किया गया",
    no_weighing: "अनाज कार्डधारक के सामने नहीं तौला गया",
    tied_sale: "राशन लेने के लिए कार्डधारकों को दूसरी चीज़ें ख़रीदने को मजबूर किया गया",
    card_kept: "डीलर ने राशन कार्ड अपने पास रख लिया, जो TPDS (नियंत्रण) आदेश 2015 के खंड 10(3) में मना है",
    no_board: "हक़, दाम, समय और स्टॉक बताने वाला बोर्ड नहीं था (खंड 10(4)(ii))",
    told_lapsed: "कार्डधारकों से कहा गया कि उनका राशन लैप्स हो गया या आया नहीं",
    many_trips: "कार्डधारकों को तीन या ज़्यादा बार आना पड़ा",
    wrong_grain: "दूसरा अनाज दिया गया, या कोई अनाज दिया ही नहीं गया",
    threatened: "पूछने पर कार्डधारकों को डाँटा या धमकाया गया",
    member_left_out: "परिवार के किसी सदस्य का हिस्सा नहीं दिया गया",
  },
}

/**
 * A complaint to the District Grievance Redressal Officer (National Food Security Act 2013, s.15(5): the DGRO hears
 * complaints about non-distribution of entitled foodgrains). Personal details are blanks to fill in by hand.
 */
export function draftComplaint(input: RtiInput, lang: Lang): string {
  const kept = dedupeReports(input.reports, input.withdrawn)
  const stats = shopStats(input.reports, input.witnesses, input.withdrawn)[0]
  const district = input.shop?.district ? districtName(input.shop.district, lang) : "[district]"
  const months = input.months.length ? input.months.map((m) => monthName(m, lang)).join(", ") : "—"
  const kg = (g: number) => (lang === "hi" ? formatKg(g).replace(" kg", " किलो") : formatKg(g))
  const issues = new Set(kept.flatMap((r) => issueList(r.issues)))
  const issueLines = [...issues].map((i) => `- ${ISSUE_TEXT[lang][i]}`).join("\n")
  const keys = kept.slice(0, 20).map((r) => `- ${explorerEntityUrl(r.key)}`).join("\n")
  const synthetic = input.shopId.startsWith("SYN-")
  if (lang === "hi") {
    return `सेवा में,
ज़िला शिकायत निवारण अधिकारी,
${district}

विषय: उचित मूल्य दुकान ${input.shopId} पर हक़ का अनाज न मिलने की शिकायत (राष्ट्रीय खाद्य सुरक्षा अधिनियम 2013, धारा 15)

महोदय/महोदया,

${months} में उचित मूल्य दुकान ${input.shopId} से मुझे और दूसरे कार्डधारकों को हक़ से कम अनाज मिला।
${stats ? `तोलमोल पर दर्ज सार्वजनिक रिकॉर्ड के अनुसार ${stats.reporters} डिवाइसों से ${stats.reports} रिपोर्टें हैं; कुल कमी ${kg(stats.totalShortfallG)} (${formatBp(stats.shortfallBp)}) है, और ${stats.corroborated} रिपोर्टों की दूसरे कार्डधारकों ने पुष्टि की है।` : ""}
${issueLines ? `इसके अलावा:\n${issueLines}` : ""}

कृपया शिकायत की जाँच करें, दुकान का स्टॉक और वितरण रिकॉर्ड देखें, और मेरा बकाया अनाज दिलवाएँ।

नाम: ______________________   राशन कार्ड संख्या: ______________________
पता: ______________________________   मोबाइल: ______________
दिनांक: ____________   हस्ताक्षर: ____________

सबूत (Arkiv Tiramisu, ब्लॉक ${input.atBlock}; हर रिकॉर्ड को कोई भी जाँच सकता है):
${keys}
पूरा रिकॉर्ड: ${input.pageUrl}
${synthetic ? "\nनोट: यह डेमो दुकान नकली (सिंथेटिक) है। असली शिकायत में अपनी असली दुकान का नंबर लिखें।\n" : ""}`
  }
  return `To,
The District Grievance Redressal Officer,
${district}

Subject: Complaint about entitled foodgrains not given at Fair Price Shop ${input.shopId} (National Food Security Act 2013, Section 15)

Sir/Madam,

In ${months}, I and other card holders received less than our entitlement at Fair Price Shop ${input.shopId}.
${stats ? `The public record on Tolmol shows ${stats.reports} reports from ${stats.reporters} devices, a total shortfall of ${kg(stats.totalShortfallG)} (${formatBp(stats.shortfallBp)}), and ${stats.corroborated} reports confirmed by other card holders.` : ""}
${issueLines ? `In addition:\n${issueLines}` : ""}

Please inquire into this complaint, examine the shop's stock and distribution registers, and arrange for the grain due to me.

Name: ______________________   Ration card number: ______________________
Address: ______________________________   Mobile: ______________
Date: ____________   Signature: ____________

Evidence (Arkiv Tiramisu, block ${input.atBlock}; anyone can verify each record):
${keys}
Full record: ${input.pageUrl}
${synthetic ? "\nNote: this demo shop is SYNTHETIC. In a real complaint, write your real shop's number.\n" : ""}`
}
