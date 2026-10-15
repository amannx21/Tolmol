// "Draft my RTI": builds a Right to Information application about one fair-price shop, with Tolmol's
// on-chain evidence attached as an annex. Personal details are left as blanks to fill in by hand:
// Tolmol never asks for, stores or sends a name, address or card number.
//
// Legal basis (Right to Information Act, 2005): s.6(1) request in English, Hindi or the official language;
// s.6(2) no reasons needed; s.7(1) reply within 30 days; s.7(5) no fee for persons below the poverty line.
import { dedupeReports, explorerEntityUrl, formatBp, formatKg, issueList, schemeIssueList, shopStats, validWitnesses, type AnyItem, type Report, type Scheme, type Shop, type Witness, type IssueName } from "tolmol-sdk"
import { districtName, monthName, type Lang } from "./i18n"

export type RtiInput = {
  shop: (Pick<Shop, "shopId" | "district" | "state" | "labelEn" | "labelHi"> & { scheme?: Scheme }) | undefined
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
  if (input.shop?.scheme && input.shop.scheme !== "pds") return draftSchemeLetter("rti", input, input.shop.scheme, lang)
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
  if (input.shop?.scheme && input.shop.scheme !== "pds") return draftSchemeLetter("complaint", input, input.shop.scheme, lang)
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

// ------------------------------------------------------------------ school meals and rural work
// The same letters for the other schemes on the ledger. Addressed to the authority that handles the complaint:
// school meals (PM POSHAN) to the district education office; MGNREGA wages to the block Programme Officer, with a copy
// to the district's MGNREGA Ombudsperson. Personal details stay blanks to fill in by hand.
const SCHEME_ISSUE_TEXT: Record<Lang, Record<string, string>> = {
  en: {
    poor_meal: "the food was spoilt, undercooked, or had insects or stones",
    less_food: "children were given too little food",
    menu_ignored: "the notified menu was not followed",
    unsafe_kitchen: "the kitchen was dirty or there was no clean drinking water",
    seated_apart: "children were made to sit or eat separately",
    money_asked: "parents were asked to pay for the meal",
    children_work: "children were made to cook, clean or serve",
    wage_late: "wages were not paid within 15 days of the work",
    paid_less: "workers were paid for fewer days, or a lower rate, than they worked",
    job_card_kept: "job cards are kept by someone other than the household",
    work_denied: "work was asked for but not given within 15 days",
    no_site_facilities: "there was no drinking water, shade or first aid at the worksite",
    bribe_asked: "workers were asked to pay to get work or wages",
    fake_names: "the muster roll lists people who did not work",
  },
  hi: {
    poor_meal: "भोजन ख़राब या कच्चा था, या उसमें कीड़े या कंकड़ थे",
    less_food: "बच्चों को बहुत कम भोजन दिया गया",
    menu_ignored: "तय मेन्यू का पालन नहीं हुआ",
    unsafe_kitchen: "रसोई गंदी थी या साफ़ पीने का पानी नहीं था",
    seated_apart: "बच्चों को अलग बैठाया या अलग खिलाया गया",
    money_asked: "भोजन के लिए माता-पिता से पैसे माँगे गए",
    children_work: "बच्चों से खाना बनवाया, सफ़ाई या परोसने का काम करवाया गया",
    wage_late: "काम के 15 दिन के भीतर मज़दूरी नहीं मिली",
    paid_less: "मज़दूरों को किए गए काम से कम दिनों या कम दर का भुगतान हुआ",
    job_card_kept: "जॉब कार्ड परिवार के बजाय कोई और रखता है",
    work_denied: "काम माँगा गया पर 15 दिन में नहीं मिला",
    no_site_facilities: "कार्यस्थल पर पीने का पानी, छाया या प्राथमिक उपचार नहीं था",
    bribe_asked: "काम या मज़दूरी के लिए पैसे माँगे गए",
    fake_names: "मस्टर रोल में ऐसे लोगों के नाम हैं जिन्होंने काम नहीं किया",
  },
}

function schemeAmount(item: AnyItem, n: number, lang: Lang) {
  if (item === "meal_days") return lang === "hi" ? `${n} दिन` : `${n} days`
  if (item === "wage_inr") return `₹${n.toLocaleString("en-IN")}`
  return lang === "hi" ? formatKg(n).replace(" kg", " किलो") : formatKg(n)
}

function draftSchemeLetter(kind: "rti" | "complaint", input: RtiInput, scheme: Exclude<Scheme, "pds">, lang: Lang): string {
  const kept = dedupeReports(input.reports, input.withdrawn)
  const stats = shopStats(input.reports, input.witnesses, input.withdrawn)[0]
  const item: AnyItem = scheme === "mdm" ? "meal_days" : "wage_inr"
  const amt = (n: number) => schemeAmount(item, n, lang)
  const district = input.shop?.district ? districtName(input.shop.district, lang) : "[district]"
  const state = input.shop ? (lang === "hi" ? STATE_HI : STATE_EN)[input.shop.state] ?? input.shop.state : "[state]"
  const months = input.months.length ? input.months.map((m) => monthName(m, lang)).join(", ") : "—"
  const name = input.shop ? (lang === "hi" ? input.shop.labelHi : input.shop.labelEn) : input.shopId
  const issues = [...new Set(kept.flatMap((r) => schemeIssueList(scheme, r.issues)))]
  const issueLines = issues.map((i) => `- ${SCHEME_ISSUE_TEXT[lang][i] ?? i}`).join("\n")
  const keys = kept.slice(0, 20).map((r) => `- ${explorerEntityUrl(r.key)}`).join("\n")
  const synthetic = input.shopId.startsWith("SYN-")
  const record = stats
    ? lang === "hi"
      ? `तोलमोल पर दर्ज सार्वजनिक रिकॉर्ड के अनुसार ${stats.reporters} डिवाइसों से ${stats.reports} रिपोर्टें हैं; कुल कमी ${amt(stats.totalShortfallG)}, ${amt(stats.totalEntitledG)} में से (${formatBp(stats.shortfallBp)}); ${stats.corroborated} रिपोर्टों की दूसरों ने पुष्टि की है।`
      : `The public record on Tolmol shows ${stats.reports} reports from ${stats.reporters} devices: a total shortfall of ${amt(stats.totalShortfallG)} out of ${amt(stats.totalEntitledG)} (${formatBp(stats.shortfallBp)}), with ${stats.corroborated} reports confirmed by others.`
    : ""
  const evidence =
    lang === "hi"
      ? `सबूत (Arkiv Tiramisu, ब्लॉक ${input.atBlock}; हर रिकॉर्ड को कोई भी जाँच सकता है):\n${keys}\nपूरा रिकॉर्ड: ${input.pageUrl}`
      : `Evidence (Arkiv Tiramisu, block ${input.atBlock}; anyone can verify each record):\n${keys}\nFull record: ${input.pageUrl}`
  const note = synthetic ? (lang === "hi" ? "\nनोट: यह डेमो रिकॉर्ड नकली (सिंथेटिक) है। असली आवेदन में असली स्कूल या पंचायत लिखें।\n" : "\nNote: this demo record is SYNTHETIC. In a real letter, write the real school or panchayat.\n") : ""
  const sign =
    lang === "hi"
      ? "नाम: ______________________   पता: ______________________________\nदिनांक: ____________   हस्ताक्षर: ____________"
      : "Name: ______________________   Address: ______________________________\nDate: ____________   Signature: ____________"

  if (kind === "rti") {
    if (scheme === "mdm")
      return lang === "hi"
        ? `सेवा में,\nलोक सूचना अधिकारी (PIO),\nज़िला शिक्षा कार्यालय (पीएम पोषण / मध्याह्न भोजन), ${district}, ${state}\n\nविषय: सूचना का अधिकार अधिनियम, 2005 की धारा 6(1) के तहत आवेदन — ${name} (${input.shopId})\n\nकृपया ${months} महीनों की निम्नलिखित सूचना की प्रमाणित प्रतियाँ दें:\n\n1. हर स्कूल दिवस पर परोसे गए भोजन की संख्या और उपस्थिति।\n2. स्कूल को मिला खाद्यान्न और खाना पकाने की राशि।\n3. स्कूल का तय साप्ताहिक मेन्यू।\n4. इस स्कूल के भोजन के निरीक्षण की रिपोर्टें।\n\nमैं गरीबी रेखा से नीचे हूँ / शुल्क ₹10 संलग्न है (जो लागू हो)।\n\n${sign}\n\n${record}\n${evidence}\n${note}`
        : `To,\nThe Public Information Officer,\nDistrict Education Office (PM POSHAN / mid-day meal), ${district}, ${state}\n\nSubject: Application under Section 6(1) of the Right to Information Act, 2005 — ${name} (${input.shopId})\n\nPlease provide certified copies of the following for ${months}:\n\n1. The number of meals served and the attendance on each school day.\n2. The foodgrain and cooking cost received by the school.\n3. The school's notified weekly menu.\n4. Inspection reports of the school's meals.\n\nI am below the poverty line / the fee of Rs 10 is enclosed (whichever applies).\n\n${sign}\n\n${record}\n${evidence}\n${note}`
    return lang === "hi"
      ? `सेवा में,\nलोक सूचना अधिकारी (PIO),\nकार्यक्रम अधिकारी, मनरेगा, प्रखंड ______, ${district}, ${state}\n\nविषय: सूचना का अधिकार अधिनियम, 2005 की धारा 6(1) के तहत आवेदन — ${name} (${input.shopId})\n\nकृपया ${months} महीनों की निम्नलिखित सूचना की प्रमाणित प्रतियाँ दें:\n\n1. पंचायत के कामों के मस्टर रोल।\n2. मज़दूरी सूची और भुगतान आदेश, तारीख़ों के साथ।\n3. काम माँगने वालों की सूची और काम मिलने की तारीख़ें।\n4. पंचायत की सामाजिक अंकेक्षण (सोशल ऑडिट) रिपोर्ट।\n\nमैं गरीबी रेखा से नीचे हूँ / शुल्क ₹10 संलग्न है (जो लागू हो)।\n\n${sign}\n\n${record}\n${evidence}\n${note}`
      : `To,\nThe Public Information Officer,\nProgramme Officer, MGNREGA, Block ______, ${district}, ${state}\n\nSubject: Application under Section 6(1) of the Right to Information Act, 2005 — ${name} (${input.shopId})\n\nPlease provide certified copies of the following for ${months}:\n\n1. The muster rolls of the works in this gram panchayat.\n2. The wage lists and payment orders, with their dates.\n3. The list of people who asked for work, and the dates work was given.\n4. The social audit report of the gram panchayat.\n\nI am below the poverty line / the fee of Rs 10 is enclosed (whichever applies).\n\n${sign}\n\n${record}\n${evidence}\n${note}`
  }

  if (scheme === "mdm")
    return lang === "hi"
      ? `सेवा में,\nज़िला शिक्षा अधिकारी (पीएम पोषण / मध्याह्न भोजन),\n${district}\n\nविषय: ${name} (${input.shopId}) में बच्चों को स्कूल का भोजन न मिलने की शिकायत\n\nमहोदय/महोदया,\n\n${months} में ${name} में बच्चों को हर स्कूल दिवस पर गरम पका भोजन नहीं मिला।\n${record}\n${issueLines ? `इसके अलावा:\n${issueLines}` : ""}\n\nकृपया शिकायत की जाँच करें, स्कूल का भोजन रजिस्टर देखें, और हर स्कूल दिवस पर भोजन सुनिश्चित करें।\n\nमाता-पिता / अभिभावक का ${sign}\n\n${evidence}\n${note}`
      : `To,\nThe District Education Officer (PM POSHAN / mid-day meal),\n${district}\n\nSubject: Complaint about school meals not given at ${name} (${input.shopId})\n\nSir/Madam,\n\nIn ${months}, children at ${name} did not get a hot cooked meal on every school day.\n${record}\n${issueLines ? `In addition:\n${issueLines}` : ""}\n\nPlease inquire into this complaint, examine the school's meal register, and make sure a meal is served on every school day.\n\nParent or guardian — ${sign}\n\n${evidence}\n${note}`
  return lang === "hi"
    ? `सेवा में,\nकार्यक्रम अधिकारी, मनरेगा, प्रखंड ______, ${district}\nप्रतिलिपि: ज़िले के मनरेगा लोकपाल\n\nविषय: ग्राम पंचायत ${name} (${input.shopId}) में मनरेगा मज़दूरी न मिलने या कम मिलने की शिकायत\n\nमहोदय/महोदया,\n\n${months} में ${name} में किए गए काम की पूरी मज़दूरी समय पर नहीं मिली।\n${record}\n${issueLines ? `इसके अलावा:\n${issueLines}` : ""}\n\nकृपया मस्टर रोल और भुगतान रिकॉर्ड की जाँच करें, बकाया मज़दूरी दिलवाएँ, और अधिनियम के अनुसार देरी का मुआवज़ा दें।\n\nजॉब कार्ड संख्या: ______________________\n${sign}\n\n${evidence}\n${note}`
    : `To,\nThe Programme Officer, MGNREGA, Block ______, ${district}\nCopy: the MGNREGA Ombudsperson of the district\n\nSubject: Complaint about MGNREGA wages not paid, or paid short, at Gram Panchayat ${name} (${input.shopId})\n\nSir/Madam,\n\nIn ${months}, workers at ${name} did not get the full wages for their work on time.\n${record}\n${issueLines ? `In addition:\n${issueLines}` : ""}\n\nPlease examine the muster rolls and payment records, pay the wages due, and pay compensation for the delay as the Act provides.\n\nJob card number: ______________________\n${sign}\n\n${evidence}\n${note}`
}
