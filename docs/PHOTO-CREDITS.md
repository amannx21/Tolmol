# Landing-page reference photographs

> **Placeholders for the demo.** The pictures in `apps/web/public/images/` and `docs/media/reference-photos/` illustrate
> the layout only. They belong to their owners, are credited below, and are **not** covered by this repository's MIT
> licence. A real deployment would use original or licensed images.

## MGNREGA images

The wage homepage pairs the supplied workers-in-a-field illustration with the existing heading and buttons. The supplied StudyIQ scheme graphic appears in a matching photo band below the hero, beside an explanation of work days, wages and workers' confirmations. Both keep their natural proportions and source credits. Responsive 640/960 px WebP files are served locally; source files are `nrega-scheme.jpg` and `nrega-workers.jpg` in `docs/media/reference-photos/`. No report questions, links or submission behavior changed.

| Image | Source |
| --- | --- |
| Supplied scheme graphic, with Gandhi portrait | [StudyIQ](https://www.studyiq.com/articles/mahatma-gandhi-national-rural-employment-guarantee-scheme/) |
| Supplied workers beneath an MGNREGA banner | [Shutterstock AI, asset 2622134373](https://www.shutterstock.com/image-generated/mgnrega-2622134373) |

These are third-party representative illustrations, not Tolmol records or proof of official endorsement. Their copyrights remain with their owners. The workers' picture is an existing Shutterstock AI asset matching the user reference, not a newly generated image. Its public preview, including any source marks, is preserved and labelled as a preview.

## School-meal illustrations

The school-meal homepage uses three illustrations matching the user's references: the classroom scene beside the main heading, the serving scene in a photo band below the hero, and a photo of children eating their mid-day meal beside the existing how-it-works steps. Images retain their natural proportions and include Hindi/English alternative text and visible source links. The classroom illustration loads eagerly; the other two load lazily. The existing ration images and reporting workflows are unchanged.

| Illustration | Source |
| --- | --- |
| Children sharing lunch in a classroom | [Good Food Movement](https://gfm.akshayakalpa.org/read/feature-article/midday-meals-scheme-in-indian-schools-nutrition-learning-limitations-cost-cutting-infrastructure) |
| Curry served onto a rice plate | [The New Indian Express](https://www.newindianexpress.com/states/kerala/2025/Jul/07/mid-day-meals-feeling-the-bite-of-fund-crunch-kerala-government-to-turn-to-lsgs) |
| Schoolchildren eating their mid-day meal in a government school (photo, cropped) | [Myadam Abhilash, Wikimedia Commons](https://commons.wikimedia.org/wiki/File:MDM_scheme.jpg), CC0 (public domain dedication) |

Source files are `school-meal-classroom.webp`, `school-meal-serving.jpg` and `school-meal-child.jpg` in `docs/media/reference-photos/`. Local WebP copies live in `apps/web/public/images/`: 640/960 px variants for the first two and a 600 px crop of the children's photo. The classroom and serving illustrations retain their copyright. The children's photo is CC0: its author placed it in the public domain, so it may be used, cropped and published freely.

## Ration photographs

The first two real photographs match images supplied by the user as visual references. Two further photographs illustrate weighing grain and community participation in the report flow. They provide PDS context; they do not depict Tolmol users, identify the synthetic demo shop, or substantiate any shortfall allegation. The generated community image was not integrated into the app.

| Photograph | Credit | Source |
| --- | --- | --- |
| Grain being measured and distributed inside a ration shop | Diwakar Prasad / Hindustan Times | [Hindustan Times, 29 April 2020](https://www.hindustantimes.com/india-news/demand-for-ration-cards-increases-amid-lockdown/story-xwaP0y153pnzrz91FAdKAI.html) |
| People outside a yellow PDS shop | PradeepGaurs / Shutterstock | [Cornell Chronicle, 20 October 2022](https://news.cornell.edu/stories/2022/10/new-project-will-reveal-true-cost-indias-food-subsidies) |
| Grain being weighed while distribution is recorded | Published by the Haryana Food Department; photographer not identified on the source page | [Haryana e-PDS portal](https://haryanafood.gov.in/pds-2/) |
| Card holders collecting grain together at a shop | Published by Krishi Jagran; photographer not identified on the source page | [Krishi Jagran, 28 June 2019](https://krishijagran.com/news/one-nation-one-ration-card-all-you-need-to-know-about-government-s-new-scheme-how-to-avail-its-benefit/) |

Original downloaded source files are kept under `docs/media/reference-photos/`. Responsive WebP copies are served locally from `apps/web/public/images/`, at 640 and 960 pixels wide. Compression and resizing preserve the photographic content; no generative edits were made. Source credit links appear alongside both photos.

These third-party photographs retain their original copyright and are not covered by the repository's MIT licence. A source credit is attribution, not a grant of reuse rights.

Placement: the distribution photograph sits below the main hero, beside the explanation of quantities and community confirmation; the storefront photograph appears in the shop-record discovery section. Both use lazy loading, descriptive Hindi/English alternative text, fixed image dimensions and natural proportions.

The weighing photograph appears at the start of both report forms. The community photograph accompanies the confirmed report receipt, alongside the link to follow shop and official updates. The photographs stay out of the quantity-editing steps. All four are served locally with source links and Hindi/English alternative text.
