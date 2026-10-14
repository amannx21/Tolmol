# Tolmol visual design

The interface pairs a calm civic-service layout with an editorial identity: generous space, a balance-and-grain illustration, clear evidence cards and large controls. Both Easy and Full modes retain their existing workflows. New identity copy is available in English and Hindi.

## Palette

| Role | Colour | Use |
| --- | --- | --- |
| Forest | `#195C45` | Primary buttons, links, selected controls |
| Ivory | `#F6F7F2` | Page background |
| White | `#FFFFFF` | Cards and inputs |
| Mint | `#EAF1E9` | Selected states and supporting surfaces |
| Deep green | `#203B33` | Main text |
| Muted green | `#62716A` | Supporting text |
| Grain gold | `#DCA956` | Decorative accent and focus outline |
| Amber | `#956015` | Warning text |
| Red | `#B3261E` | Errors and significant shortfalls |

Primary actions use white on forest. Secondary actions use forest on white with an outline. Gold is an accent, not small text on white. Status text accompanies colour. System dark mode uses lighter status colours and dark green surfaces.

## Motion

- 160 ms hover/press feedback on controls.
- 300 ms, 8 px entrance on major panels.
- 350 ms width transition when a shortfall bar changes.
- A one-time 1.4-second balance movement and a brief grain-sprout drawing on the welcome illustration.
- Home cards reveal once on entering the viewport, with a 420 ms transition and small stagger. Keyboard focus reveals a card immediately. Without IntersectionObserver, content stays visible.
- Shortfall bars fill over 650 ms while their numeric labels stay readable.
- Easy report stages show progress across shop/month, grain quantity, other issues and review. A 220 ms transition marks each screen change without animating quantities.
- A checkmark draws after the existing save flow reports success; successful confirmations receive a short highlight. New live dashboard records get a brief edge highlight.
- Links respond with a small directional arrow movement; FAQ text opens with a short fade.
- A small loading spinner with a screen-reader status label.
- All animation and transitions disabled under `prefers-reduced-motion`.

No animation library, external font request or raster asset is required. Existing reporting, queries, exports, offline queue, device identity and verification logic are unchanged.

## Home-page flow and actions

Easy-mode ration amounts use an editable numeric field plus two labelled buttons: "1 kilo less" / "1 kilo more" ("1 किलो कम" / "1 किलो ज़्यादा"). Fraction buttons were removed. Direct entry supports decimals to gram precision, Hindi numerals and a decimal comma. Invalid or out-of-range input disables Next instead of silently advancing with the previous amount. Zero received remains valid; the existing entitlement and received-amount limits are preserved.

Browser checks covered direct entry, repeated 1 kg adjustments, lower/upper boundaries, empty and malformed input, decimal precision, Hindi numerals, comma entry, and exact review totals. Hindi layouts passed at 360, 768 and 1440 px. Build, lint and all 81 unit tests passed.

The landing hero uses plain language in either Hindi ("पूरा राशन। सबका हक़।") or English ("Your ration. Your right."), alongside "सबके लिए समान / Equal for all". A lightweight vector illustration shows equal grain measures and scales settling level. Language choices are visible in the hero, its explanation can be read aloud on request, and large icon-and-text actions open reporting or shop records. A new visitor's direct report action selects Easy mode; returning users retain their chosen mode and saved shop. Easy and Full mode selection remains available beneath the first-visit hero.

Home now leads from the main report action through three workflow steps, a clearly labelled synthetic shop preview, discovery cards for the existing tools, privacy information, expandable FAQs and a closing report action. Welcome and Easy mode include the simpler journey; Full mode also exposes evidence checking, test cards and RTI drafting. No extra network reads or invented report totals are used in these sections.

The navigation stays visible while scrolling, with Report as its primary action. Links sit alongside the features they open. On phones, major actions occupy a full row. Shop pages make reporting the primary action, and the full report form has a full-width review button. The explore control scrolls and moves focus to the journey without changing the hash route, and respects reduced-motion settings. Navigation order matches keyboard order.

Browser checks found scrollable pages without horizontal overflow for Welcome, Easy and Full at 360, 768 and 1440 px. Explore scrolling, FAQ expansion and shop navigation passed. Hindi and dark-mode checks at phone size found no overflow or uncaught page errors.

## Research

- [GOV.UK colour guidance](https://design-system.service.gov.uk/styles/colour/): contrast and functional colour roles informed the palette.
- [Carbon motion principles](https://www.carbondesignsystem.com/building-blocks/foundations/motion/overview): short, purposeful motion informed control feedback and panel entrances.

## Validation

Production build, ESLint and all 81 unit tests passed. Headless Edge checks covered Home, Report, Dashboard, Verify and About at 360, 390, 768 and 1440 px. Additional Full-mode checks included Shop at 360 and 1440 px in light and dark modes. No horizontal page overflow was found. English/Hindi switching and Full-mode selection worked; the initial route sweep produced no uncaught page errors. Desktop welcome and home screenshots were visually inspected.

These are layout and navigation checks, not a complete accessibility audit or a live on-chain submission test. Network-dependent data may still be loading during layout checks. Existing Hindi translations and the new identity copy benefit from native-speaker review.

Motion checks passed for scroll reveals, keyboard-focus visibility, reduced motion, print visibility and the missing-IntersectionObserver fallback. Responsive checks covered 360, 768 and 1440 px. An Easy-mode browser walkthrough using a mocked shop passed through review with the correct shortfall, checked progress stages and confirmed that reduced motion disables the step transition. No live writes were made. The production build, ESLint and all 81 unit tests passed after the motion additions.

Landing checks passed for both languages at 360, 768 and 1440 px, one main heading, first-visit reporting, saved-shop links and preservation of Full mode. The illustration settles after 2.4 seconds; all grain and scale motion is disabled under reduced motion. Dark-mode checks found no horizontal overflow. Hindi desktop and phone layouts were visually inspected. Read-aloud quality depends on voices available on the user's device.

Actions now use a consistent set of SVG symbols alongside their text: speaker for listening, shop for shop selection, calendar for month, grain/card/people for report choices, paper plane for sending, share arrow for sharing, download arrow for files, envelope for letters and printer for printing. Navigation uses labelled icons, stacked on phones to keep Report visible. Existing useful symbols on plus/minus controls and issue choices are retained. Decorative SVGs are hidden from screen readers to avoid repeating button labels. Landing and mocked Easy-wizard browser checks passed after these additions.

## Report introduction and confirmed receipt

The first Easy-mode shop-selection step and the Full report form include a compact real grain-weighing photograph. After a successful save, both flows show "Your report has been raised on Tolmol" (with a Hindi equivalent), its reference link, a community photograph and a description of the existing verified-official action feature. Buttons open the shop's updates and the complaint draft. The receipt explains the current manual submission step for a formal government complaint; it does not claim delivery to a government portal or that an official has acted.

The receipt moves keyboard focus to the success heading. Easy mode renders it only after `fileReport` succeeds. Full mode renders it after loading a valid newly saved report authored by this device. Failed writes and offline-queued reports retain their existing separate feedback. A visitor adding `new=1` to someone else's report cannot display the new receipt.

Mocked browser checks passed for successful saves in both modes, Hindi receipt text, photo loading, correct update/complaint links, 360/768/1440 px layouts, failed writes, offline queueing and the other-reporter case. No live writes were made. Build, lint and all 81 unit tests passed. There are now four real reference photographs in the UI.

## Animated colour previews

The shared landing now includes a real ration-distribution photograph beside the explanation of quantities and community confirmation. The shop-record section includes a real storefront photograph. Both match user-supplied references, have linked photo credits, and are labelled as representative context rather than records about the synthetic demo shop. See [photo credits](PHOTO-CREDITS.md). Lazy-loaded WebP files are about 55–62 KB at 640 px and 101–106 KB at 960 px.

Photo checks passed on Home and the design preview in both languages at 360, 768 and 1440 px: both images decoded successfully, caption text displayed correctly and there was no horizontal overflow or uncaught page error. The distribution and shop sections were visually inspected on desktop. Production build and lint passed.

Open `#/design-preview` to compare Cream + Mustard, White + Setting Sun, Oat + Plum, Pearl + Slate Blue, Sand + Copper and Ivory + Coral with actual motion and emoji-labelled actions. This page shares the real landing and discovery components, provides an animation replay control and keeps each candidate in light mode. Reporting and shop links open the existing app. The palettes are scoped to the preview, so selecting one does not apply it to the app.

The preview uses 📝 for reporting, 🏪 for shops, 🔊 for listening, 👥 for community confirmation and ✉️ for letters, with visible text labels. Browser checks passed for all six palettes at 360, 768 and 1440 px, animation replay and settling, Hindi on a phone, reduced motion, light palettes under a dark system preference, and returning to the app. Build, lint and all 81 unit tests passed.
