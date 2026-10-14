# Sources (verified 2026-10-13; sections 6 to 9 added 2026-10-14)

Every number Tolmol shows or the README cites comes from this list. Each entry was opened at
the primary source on 2026-10-13, and the quote below is copied from it.

## 1. NFSA entitlements (official)

**National Food Security Portal, Government of India: "NFSA Act" page.**
https://nfsa.gov.in/portal/nfsa-act

> "While AAY households, which constitute poorest of the poor are entitled to 35 kg of
> foodgrains per family per month, priority households are entitled to 5 kg per person per month."

Used for: the entitlement helper in the report form.
- Priority household (PHH): 5,000 g x number of members per month.
- Antyodaya (AAY): 35,000 g per family per month.
- The rice/wheat/millet split varies by state, so the user enters the entitled amount per item.

## 2. Free distribution under PMGKAY (official)

**Press Information Bureau, Cabinet decision, posted 29 Nov 2023.**
"Free Foodgrains for 81.35 crore beneficiaries for five years: Cabinet Decision".
https://www.pib.gov.in/PressReleasePage.aspx?PRID=1980686

> "The Cabinet led by Prime Minister has decided that the Central government will provide free
> food grains to about 81.35 crore beneficiaries under the Pradhan Mantri Garib Kalyan Anna Yojana
> (PMGKAY) for a period of five years with effect from 1st January, 2024"

> "a network of over 5 lakh Fair Price Shops"

Used for: scale (81.35 crore people, over 5 lakh shops). Grain is free, so a shortfall is
grain lost, not money overcharged.

## 3. Leakage: grain that never reaches beneficiaries (research)

**Raya Das, Ranjana Roy, Ashok Gulati. "Rationalising Public Distribution System in India".
ICRIER Policy Brief 27, November 2024.** https://icrier.org/pdf/pb-27.pdf

> "the Household Consumption Expenditure Survey (HCES) of 2022-23 shows that almost 28 percent
> of the grains supplied by Food Corporation of India (FCI) and state governments never reaches
> the intended beneficiaries."

> "Without state-offtake adjustment the leakage is 25.3 percent."

The brief also notes that surveys can under- or over-report PDS receipts. We cite that caveat
alongside the number.

## 4. Biometric/ePoS failures exclude legitimate beneficiaries (research)

**Karthik Muralidharan, Paul Niehaus, Sandip Sukhtankar. "Identity Verification Standards in
Welfare Programs: Experimental Evidence from India". NBER Working Paper 26744, February 2020.**
https://www.nber.org/papers/w26744

> "Corruption fell but with substantial costs to legitimate beneficiaries, 1.5-2 million of whom
> lost access to benefits at some point during the reforms."

Context: Aadhaar-based biometric authentication in Jharkhand's PDS.

## 5. The government itself treats under-weighing as a problem (official)

**Press Information Bureau, Department of Food & Public Distribution, posted 21 Jun 2021.**
https://www.pib.gov.in/PressReleasePage.aspx?PRID=1729070

> "The Department of Food & Public Distribution has issued a notification on 18th June, 2021 to
> ensure right quantity to beneficiaries in distribution of subsidized foodgrains as per their
> entitlement under the National Food Security Act (NFSA), 2013."

The release explains that linking ePoS devices to electronic weighing scales is meant to ensure the
beneficiary "is given the right quantity of foodgrains by the Fair Price Shop dealer".

## 6. Where a card holder can complain: the law (official)

**The National Food Security Act, 2013 (No. 20 of 2013), Chapter VII, as published in the Gazette of India.**
https://dfpd.gov.in/WriteReadData/Other/nfsa_1.pdf (opened 2026-10-14)

> Section 14: "Every State Government shall put in place an internal grievance redressal mechanism which may
> include call centres, help lines, designation of nodal officers, or such other mechanism as may be prescribed."

> Section 15(5): "The officer referred to in sub-section (1) shall hear complaints regarding non-distribution of
> entitled foodgrains or meals, and matters relating thereto"

Section 15(1) creates a District Grievance Redressal Officer (DGRO) in every district, and 15(6) lets a complainant
who is not satisfied appeal to the State Food Commission.
> Section 28(1): "Every local authority, or any other authority or body, as may be authorised by the State
> Government, shall conduct or cause to be conducted, periodic social audits on the functioning of fair price shops"

Used for: the "Complaint to the DGRO" letter on each shop page (`apps/web/src/rti.ts`, `draftComplaint`), and the
"What you can do next" panel shown after a report.

## 7. The 1967 helpline and One Nation One Ration Card (official)

**Press Information Bureau backgrounder, "Securing Every Plate: India's Multi-Faceted Mission to Ensure Food and
Nutritional Equity for 81 Crore Citizens", October 2025.**
https://static.pib.gov.in/WriteReadData/specificdocs/documents/2025/oct/doc20251015667601.pdf (opened 2026-10-14)

> "Helpline number 1967/1800 - State series number is operational in all the States/ UTs for contacting and
> redressal of the complaints in Public Distribution System"

> ONORC lets beneficiaries "lift their entitled food grains from any FPS in the country using their existing ration
> card/Aadhaar card with biometric authentication"

Used for: the "Call 1967" button and the note that a migrant can take their ration at any shop.

## 8. Fingerprints that fail: why "thumb failed" is an issue tag (reporting)

**Shagun, "Weathered hands, worn rights", Down To Earth, 28 Nov 2024.**
https://www.downtoearth.org.in/food/weathered-hands-worn-rights-biometric-failures-block-access-to-rations-for-seniors-labourers-under-e-kyc

Reports elderly people and construction workers whose worn fingerprints fail e-KYC and who are left without
rations; senior citizens are described as "among the worst affected".
Used for: the issue tags "Fingerprint or OTP failed, got nothing" and "Thumbprint taken, but full grain not given".

## 9. Migrants turned away despite ONORC (reporting)

**Niyati Shah and Anoushka Srinivas, "One Nation, Fragmented Rations: Migration and Food Insecurity in Bengaluru",
The Migration Story, 9 Dec 2025.** https://themigrationstory.com/post/one-nation-fragmented-rations-migration-and-food-insecurity-in-bengaluru/

Documents migrants refused at fair-price shops ("This is a village card") and cites official figures of 698
inter-state portability transactions against 1,062,481 intra-state ones in Karnataka in September 2023.
Used for: the issue tag "Card from another place refused (One Nation One Ration Card)".

The other four tags (asked to pay, shop closed on ration day, bad grain, no receipt) are everyday complaint types
we chose ourselves; we cite no statistic for them. Source 2 shows that PMGKAY grain is free, which is why "asked to
pay money" is a complaint at all. Tolmol stores all tags only as a 7-bit number, never as text.

## 10. What a fair-price shop owner must do (official)

**The Targeted Public Distribution System (Control) Order, 2015, clause 10.** https://indiankanoon.org/doc/74257660/
(opened 2026-10-15)

> Clause 10(3): "The fair price shop owner shall not retain the ration cards after the supply of the foodgrains."

Clause 10(4) lists the owner's duties, including display boards for entitlement, scale of issue, retail prices and
"timings of opening and closing of the fair price shop" (10(4)(ii)), records such as the stock and sale registers
(10(4)(iii)), and opening and closing as per the displayed timings (10(4)(vii)).
Used for: the fixed list of answers a verified dealer can give (`RESPONSE_ACTIONS` in `packages/tolmol-sdk/src/answers.ts`).

## 11. Community score cards (method)

**World Bank, "The Community Score Card Process"** (methodology note).
https://www.betterevaluation.org/sites/default/files/community_scorecard_process_worldbank03.pdf and the CIVICUS
toolkit https://www.civicus.org/documents/toolkits/PGX_H_Community%20Score%20Cards.pdf

Community score cards have service users score a service, the provider assess itself, and both meet to agree on
improvements. Tolmol's "shops answer, reporters confirm" follows that loop on Arkiv: reports are the users' scores, the
dealer's answers are the provider's side, and the reporter's "fixed / not fixed" closes the loop.
Used for: the shop score card.

## 12. What the department can and must do about a shop (official)

**The Targeted Public Distribution System (Control) Order, 2015.** https://indiankanoon.org/doc/74257660/ (opened 2026-10-15)

> Clause 10(7): "The designated authority shall take prompt action in respect of violation of any condition of licence
> including any irregularity committed by the fair price shop owner, which may include suspension or cancellation of
> the fair price shop owner's licence."

> Clause 11(1): "The State Government shall ensure regular inspections of fair price shops not less than once in three
> months by the designated authority."

> Clause 13: "If any person contravenes any of the provisions of this Order he shall be liable to punishment under
> section 7 of the Act." (the Essential Commodities Act, 1955)

Clause 10(9) requires a new licence within a month of a cancellation; clause 11(4) sets up vigilance committees down
to the shop level, and clause 12(2) asks every local authority to conduct periodic social audits.
Used for: the fixed list of official actions (`OFFICIAL_ACTIONS` in `packages/tolmol-sdk/src/official.ts`).

## 13. What card holders actually face at the shop (reporting)

**Siraj Dutta, "The inefficiency of Aadhaar authentication and others: lessons from the mess in the Jharkhand PDS",
Scroll.in, 17 Jul 2022.** https://scroll.in/article/1027232/the-inefficiency-of-aadhaar-authentication-and-others-lessons-from-the-mess-in-the-jharkhand-pds

In one village "cardholders received just 35% of the grain in February and 33% in March even though the full amount
was registered" in the point-of-sale machine; dealers told people their ration had "lapsed".
Used for: the questions "the machine slip shows more grain than I got" and "told my ration lapsed".

**"FP shop dealers forcing consumers to buy goods", The Hans India, 20 Aug 2017.**
https://www.thehansindia.com/posts/index/Telangana/2017-08-20/FP-shop-dealers-forcing-consumers-to-buy-goods/320315

Card holders were "forced to buy all the products which are sold there like dal, salt, oil" before getting their rice.
Used for: the question "made to buy other things to get my ration".

The questions "the dealer kept my ration card" and "no board showing stock, price and timings" follow the dealer's
duties in the TPDS (Control) Order 2015, clauses 10(3) and 10(4)(ii) (§10 above). "Had to come 3 or more times",
"not weighed in front of me", "a different grain" and "a family member's share left out" are everyday complaints we
chose ourselves; we cite no statistic for them.

## What we do not claim

- We do not claim any specific dealer or shop short-weighs. All shops in Tolmol are synthetic.
- We do not claim Tolmol measures leakage. It records what beneficiaries say they received,
  corroborated by other beneficiaries, in a form nobody can quietly delete.
