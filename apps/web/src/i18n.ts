import { useEffect, useState } from "preact/hooks"

export type Lang = "en" | "hi"

// Hindi strings were drafted by an AI assistant and need review by a native speaker (see docs/LLMS_USED.md).
const en = {
  appName: "Tolmol",
  tagline: "Ration shortfall evidence that no dealer, official or app host can quietly erase.",
  synthetic: "Demo: every shop and report here is synthetic test data on the Tiramisu testnet.",
  navHome: "Home",
  navReport: "Report",
  navDashboard: "Dashboard",
  navAbout: "About",
  ctaReport: "Report a shortfall",
  ctaDashboard: "See the worst shops",
  homeWhy:
    "Ration-card holders often get less grain than their entitlement, and it is their word against the dealer's. Tolmol keeps a shared record: each report is signed by the reporter's phone, other card holders can confirm it, and nobody can edit or delete it afterwards.",
  homeHow1: "Report what you were entitled to and what you received.",
  homeHow2: "Another card holder at the same shop confirms it from their own phone.",
  homeHow3: "Anyone (journalist, NGO, RTI filer) can check and download the evidence.",
  state: "State",
  district: "District",
  shop: "Ration shop (synthetic)",
  chooseShop: "Choose a shop",
  month: "Month",
  item: "Grain",
  rice: "Rice",
  wheat: "Wheat",
  millet: "Millet",
  entitledKg: "Entitled (kg) for this grain",
  receivedKg: "Actually received (kg)",
  helperTitle: "Not sure of your entitlement?",
  helperText: "Under NFSA, priority households get 5 kg per person per month in total, and Antyodaya (AAY) families get 35 kg per family. Your state decides the rice/wheat split.",
  helperPhh: "Priority household, members:",
  helperAay: "Antyodaya (AAY) family",
  helperTotal: "Total grain per month",
  shortfall: "Shortfall",
  preview: "Check before you send",
  permanentWarning: "This record is permanent. Nobody, not even you, can edit or delete it later. Do not type any name or number about yourself: Tolmol does not ask for any.",
  submit: "Send report",
  sending: "Sending to Arkiv…",
  sent: "Report saved on Arkiv",
  shareForWitness: "Share this page with another card holder from the same shop so they can confirm it:",
  viewOnExplorer: "View on the block explorer",
  reportTitle: "Shortfall report",
  corroborate: "I also got less at this shop this month",
  corroborating: "Confirming…",
  corroborated: "Thank you. Your confirmation is saved on Arkiv.",
  witnesses: "Confirmations",
  noWitnesses: "No confirmations yet",
  reporter: "Reported by device",
  you: "you",
  expires: "Stays queryable for",
  days: "days",
  createdBlock: "Created at block",
  shopTitle: "Shop",
  reports: "Reports",
  allMonths: "All months",
  asOfBlock: "Show as it was at block",
  asOfNow: "Latest",
  apply: "Apply",
  export: "Download evidence",
  duplicateIgnored: "duplicate, not counted",
  selfWitnessIgnored: "same device as reporter, not counted",
  dashboardTitle: "Worst shortfalls",
  live: "Live",
  connecting: "Connecting…",
  reconnecting: "Reconnecting…",
  from: "From",
  to: "To",
  rank: "#",
  corroboratedReports: "confirmed reports",
  loading: "Reading from Arkiv…",
  empty: "No reports yet.",
  error: "Something went wrong",
  device: "Your device ID",
  deviceHelp: "An anonymous key created on this phone. It signs your reports. It is not linked to your name or ration card.",
  balance: "Test gas",
  getGas: "Get free test gas",
  gettingGas: "Requesting…",
  gasOk: "Test gas received",
  needGas: "This device needs a little free test gas before it can write.",
  faucetFallback: "Or use the Arkiv faucet",
  alreadyReported: "This device already reported this shop, month and grain.",
  alreadyWitnessed: "This device already confirmed this report.",
  ownReport: "You wrote this report, so you cannot confirm it. Ask another card holder.",
  readCheck: "Check it yourself without this website",
  language: "हिन्दी",
  notFound: "Not found or expired",
  aboutTitle: "About Tolmol",
} as const

export type Key = keyof typeof en

const hi: Record<Key, string> = {
  appName: "तोलमोल",
  tagline: "राशन में कटौती का ऐसा सबूत जिसे कोई डीलर, अधिकारी या ऐप चलाने वाला चुपचाप मिटा नहीं सकता।",
  synthetic: "डेमो: यहाँ की हर दुकान और रिपोर्ट Tiramisu टेस्टनेट पर बना नकली (सिंथेटिक) डेटा है।",
  navHome: "मुख्य",
  navReport: "रिपोर्ट",
  navDashboard: "डैशबोर्ड",
  navAbout: "जानकारी",
  ctaReport: "कम राशन की रिपोर्ट करें",
  ctaDashboard: "सबसे खराब दुकानें देखें",
  homeWhy:
    "राशन कार्ड वालों को अक्सर हक़ से कम अनाज मिलता है, और फिर उनकी बात डीलर की बात के ख़िलाफ़ होती है। तोलमोल एक साझा रिकॉर्ड रखता है: हर रिपोर्ट रिपोर्ट करने वाले के फ़ोन से साइन होती है, दूसरे कार्डधारक उसकी पुष्टि कर सकते हैं, और बाद में कोई उसे बदल या मिटा नहीं सकता।",
  homeHow1: "बताइए कितना अनाज मिलना था और कितना मिला।",
  homeHow2: "उसी दुकान का दूसरा कार्डधारक अपने फ़ोन से पुष्टि करता है।",
  homeHow3: "कोई भी (पत्रकार, संस्था, RTI करने वाले) सबूत जाँच और डाउनलोड कर सकता है।",
  state: "राज्य",
  district: "ज़िला",
  shop: "राशन दुकान (नकली)",
  chooseShop: "दुकान चुनें",
  month: "महीना",
  item: "अनाज",
  rice: "चावल",
  wheat: "गेहूँ",
  millet: "मोटा अनाज",
  entitledKg: "इस अनाज का हक़ (किलो)",
  receivedKg: "असल में मिला (किलो)",
  helperTitle: "अपना हक़ नहीं पता?",
  helperText: "NFSA के तहत प्राथमिकता वाले परिवार को हर सदस्य पर महीने में कुल 5 किलो और अंत्योदय (AAY) परिवार को 35 किलो मिलता है। चावल/गेहूँ का बँटवारा राज्य तय करता है।",
  helperPhh: "प्राथमिकता परिवार, सदस्य:",
  helperAay: "अंत्योदय (AAY) परिवार",
  helperTotal: "महीने का कुल अनाज",
  shortfall: "कमी",
  preview: "भेजने से पहले जाँच लें",
  permanentWarning: "यह रिकॉर्ड स्थायी है। बाद में कोई भी, आप भी नहीं, इसे बदल या मिटा नहीं सकता। अपने बारे में कोई नाम या नंबर न लिखें: तोलमोल ऐसा कुछ नहीं माँगता।",
  submit: "रिपोर्ट भेजें",
  sending: "Arkiv पर भेजा जा रहा है…",
  sent: "रिपोर्ट Arkiv पर सहेज ली गई",
  shareForWitness: "यह पेज उसी दुकान के किसी दूसरे कार्डधारक को भेजें ताकि वे पुष्टि कर सकें:",
  viewOnExplorer: "ब्लॉक एक्सप्लोरर पर देखें",
  reportTitle: "कमी की रिपोर्ट",
  corroborate: "मुझे भी इस महीने इस दुकान पर कम मिला",
  corroborating: "पुष्टि हो रही है…",
  corroborated: "धन्यवाद। आपकी पुष्टि Arkiv पर सहेज ली गई।",
  witnesses: "पुष्टियाँ",
  noWitnesses: "अभी कोई पुष्टि नहीं",
  reporter: "रिपोर्ट करने वाला डिवाइस",
  you: "आप",
  expires: "इतने दिन खोजने लायक रहेगा",
  days: "दिन",
  createdBlock: "बनने का ब्लॉक",
  shopTitle: "दुकान",
  reports: "रिपोर्टें",
  allMonths: "सभी महीने",
  asOfBlock: "इस ब्लॉक पर जैसा था वैसा दिखाएँ",
  asOfNow: "नवीनतम",
  apply: "लागू करें",
  export: "सबूत डाउनलोड करें",
  duplicateIgnored: "दोहराई गई, गिनी नहीं गई",
  selfWitnessIgnored: "रिपोर्ट करने वाला ही डिवाइस, गिनी नहीं गई",
  dashboardTitle: "सबसे ज़्यादा कमी",
  live: "लाइव",
  connecting: "जुड़ रहा है…",
  reconnecting: "फिर से जुड़ रहा है…",
  from: "से",
  to: "तक",
  rank: "#",
  corroboratedReports: "पुष्ट रिपोर्टें",
  loading: "Arkiv से पढ़ा जा रहा है…",
  empty: "अभी कोई रिपोर्ट नहीं।",
  error: "कुछ गड़बड़ हुई",
  device: "आपके डिवाइस की पहचान",
  deviceHelp: "इस फ़ोन पर बनी एक गुमनाम कुंजी। यह आपकी रिपोर्ट पर साइन करती है। यह आपके नाम या राशन कार्ड से जुड़ी नहीं है।",
  balance: "टेस्ट गैस",
  getGas: "मुफ़्त टेस्ट गैस लें",
  gettingGas: "माँगा जा रहा है…",
  gasOk: "टेस्ट गैस मिल गई",
  needGas: "लिखने से पहले इस डिवाइस को थोड़ी मुफ़्त टेस्ट गैस चाहिए।",
  faucetFallback: "या Arkiv faucet का उपयोग करें",
  alreadyReported: "इस डिवाइस ने इस दुकान, महीने और अनाज की रिपोर्ट पहले ही कर दी है।",
  alreadyWitnessed: "इस डिवाइस ने इस रिपोर्ट की पुष्टि पहले ही कर दी है।",
  ownReport: "यह रिपोर्ट आपने लिखी है, इसलिए आप इसकी पुष्टि नहीं कर सकते। किसी दूसरे कार्डधारक से कहें।",
  readCheck: "इस वेबसाइट के बिना ख़ुद जाँचें",
  language: "English",
  notFound: "नहीं मिला या समय समाप्त",
  aboutTitle: "तोलमोल के बारे में",
}

const dicts: Record<Lang, Record<Key, string>> = { en, hi }

let current: Lang = "en"
const listeners = new Set<(l: Lang) => void>()
try {
  const saved = localStorage.getItem("tolmol.lang")
  if (saved === "hi" || saved === "en") current = saved
  else if (navigator.language?.startsWith("hi")) current = "hi"
} catch {
  /* storage unavailable */
}

export function setLang(l: Lang) {
  current = l
  try {
    localStorage.setItem("tolmol.lang", l)
  } catch {
    /* ignore */
  }
  document.documentElement.lang = l
  listeners.forEach((f) => f(l))
}

export function useLang() {
  const [lang, set] = useState<Lang>(current)
  useEffect(() => {
    listeners.add(set)
    document.documentElement.lang = current
    return () => void listeners.delete(set)
  }, [])
  const t = (k: Key) => dicts[lang][k]
  return { lang, t, toggle: () => setLang(lang === "en" ? "hi" : "en") }
}

export const STATE_NAMES: Record<string, { en: string; hi: string }> = {
  BR: { en: "Bihar", hi: "बिहार" },
  UP: { en: "Uttar Pradesh", hi: "उत्तर प्रदेश" },
  JH: { en: "Jharkhand", hi: "झारखंड" },
}
