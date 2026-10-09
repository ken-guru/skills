# Uutilsynet's guidance for accessible presentations, mapped to the skills' checks

Research for [#502](https://github.com/ken-guru/skills/issues/502), a child of
the map [#481](https://github.com/ken-guru/skills/issues/481). It checks the
accessibility bar set in
[#496](https://github.com/ken-guru/skills/issues/496) against an outside
authority, for the Marp stack chosen in
[#488](https://github.com/ken-guru/skills/issues/488) and the formats chosen in
[#491](https://github.com/ken-guru/skills/issues/491). Researched 2026-10-09.

## Question

What does Uutilsynet (the Norwegian Authority for Universal Design of ICT)
require or recommend for accessible presentations, and how does each point map
onto the new skills' checks? Cover every point in its
[PowerPoint guidance](https://www.uutilsynet.no/veiledning/powerpoint/229) and
the pages it links to: slide titles, reading order, alt text, tables, links,
contrast, fonts, language, and exported PDF. For each point, say:

- whether it applies to a Marp deck delivered as HTML, as a tagged PDF, and as a
  PPTX made of slide pictures
- whether the bar decided in #496 already covers it, and what is missing
- whether a script can check it or only a person can

Also note where the guidance differs from WCAG 2.2 AA, and what Norwegian law
requires of presentations, if anything.

## Answer in brief

- **The decided bar covers only the visual half.** #496's WCAG 2.2 AA bar
  (contrast, colour never the only signal, 20 px minimum) matches Uutilsynet's
  contrast advice. It says nothing about the structural points that make up
  most of Uutilsynet's PowerPoint page: a real title on every slide, reading
  order, alt text, table header rows, descriptive links, and document language.
  The chart and diagram decisions (#494, #495) cover alt text for those two
  kinds of visual only.
- **Marp gets the structure right when the Markdown is right** (measured, Marp
  CLI 4.5.1). `#`/`##` become real `<h1>`/`<h2>` in HTML and `H1`/`H2` tags in
  the PDF. `lang:` sets `<html lang>`, each slide's `lang` and the PDF's
  `/Lang`. Image alt text reaches HTML `alt` and the PDF's `/Alt`. Tables get
  `<th>` and `TH` tags with a scope. Links become `<a>` and a tagged `/Link`.
  `title:` becomes the HTML `<title>` and the PDF title, shown in the viewer's
  title bar.
- **Five gaps were measured in Marp's output.** No check sees them unless the
  skills add one:
  1. A slide with no heading has no title. Its PDF bookmark reads "Page 4", in
     English, even in a Norwegian deck.
  2. `![](img.png)` gives `alt=""`, which marks the image as decoration. A
     forgotten alt text therefore passes silently.
  3. A `bg` background image loses its alt text in the PDF. In HTML its text
     becomes a `<figcaption>` in a layer that comes before the slide's heading,
     so a screen reader reads it first. In the PDF, the heading on that slide
     was tagged as a generic `H` instead of `H2`.
  4. A phrase marked `<span lang="en">` keeps its language in HTML but loses
     it in the PDF.
  5. CSS can change the visual order without changing the reading order
     (`flex-direction: row-reverse`).
- **The PPTX made of slide pictures fails nearly every point.** Each slide is
  one background picture with no text, no title, no alt text, no language, and
  no working links. Only the document title and the speaker notes survive
  (measured). Uutilsynet's PowerPoint advice cannot be met in that format.
  This confirms #491's decision to label it "not editable or accessible". It
  should never be the copy that gets published.
- **Scripts can check most of the structure.** They can confirm that each slide
  has a heading, that headings are unique, that every image has alt text, that
  `lang` and `title` are set, that table and link markup is right, that no
  bare URLs or "klikk her" links are used, and that the PDF has its tags,
  `/Lang`, `/Alt` and title. Only a person can judge whether alt text,
  headings and link text are *good*, whether the reading order makes sense,
  whether there is too much text, and whether a table is really data.
- **Uutilsynet asks for slightly more than WCAG in places:** a unique title per
  slide, common typefaces without thin strokes, little italic text and few
  capitals, less text and fewer elements per slide, and running an
  accessibility checker on both the source and the PDF. These are
  recommendations, not legal requirements.
- **Norwegian law asks for less than the bar.** The regulation (FOR-2013-06-21-732,
  under likestillings- og diskrimineringsloven § 18) points at WCAG 2.1 AA for
  the public sector and a WCAG 2.0 subset for private businesses. WCAG 2.2 is
  not part of Norwegian law. A live slide show is not in scope. A deck
  *published on a website* is: as a document on a public-sector site it must
  meet WCAG 2.1 AA. So a WCAG 2.2 AA bar is stricter than the law requires,
  but it has to include the structural criteria (1.1.1, 1.3.1, 1.3.2, 2.4.2,
  2.4.4, 2.4.6, 3.1.1, 3.1.2) to be compliant at all.

## Method and source quality

**Primary sites could not be reached from this sandbox.** `www.uutilsynet.no`,
`lovdata.no`, `www.w3.org` and `web.archive.org` all refused the connection or
had no route, using curl, Python and the WebFetch tool. The network allows npm
and GitHub only. The sources were therefore used as follows:

| Source | How it was read | Trust |
|---|---|---|
| Uutilsynet guidance pages | Web-search excerpts of the pages listed under Sources, including the Norwegian wording the search engine returned | **Second-hand.** The wording is the search engine's excerpt, not a verbatim read of the page. The points agree across eight queries, but every quotation below should be checked against the live page before it is quoted as Uutilsynet's own words. |
| WCAG 2.2 success criteria | Normative text from the W3C's own source repository, [`w3c/wcag`](https://github.com/w3c/wcag) (`guidelines/sc/20/*.html`, `guidelines/sc/21/*.html`), via the GitHub API | Primary (W3C's source for the Recommendation, read from `main`) |
| Norwegian law (Lovdata) | Web-search excerpts of Lovdata and of Uutilsynet's regulation pages | **Second-hand**, as for Uutilsynet |
| Marp 4.5.1 output | **Measured.** Rendered a five-slide test deck and a background-image deck with Marp CLI 4.5.1 (Marp Core 4.4.0) and chrome-headless-shell 155.0.8059.39 via `CHROME_PATH`, Linux arm64. Inspected the HTML with grep and Python, the PDF with `pdfinfo`, `qpdf --qdf` and `pdftotext`, and the PPTX by unzipping it. | Measured |

The test deck had `lang: nb`, `title:` and `description:`, an `h1` and three
`h2` slides, a slide with no heading, a two-column table, a descriptive link, an
English `<span lang="en">` phrase, one image with alt text and one with
`![]()`, and a `row-reverse` flex layout. The second deck had a
`![bg right:40% …]` image and a `![w:300 …]` sized image. Notes were in HTML
comments.

## Findings

### 1. What Uutilsynet says

Uutilsynet's PowerPoint page says the same general principles apply in any
presentation tool, and uses PowerPoint because most people do. The page and the
general pages it links to (Utforming og presentasjon, Kontrast, Tabeller,
Lenker, PDF, Dokumenter på nettsider, Bilder og grafikk) make these points. The
Norwegian is as the search engine excerpted it; see the caveat above.

1. **Use the layout templates; headings must be real headings.** *"Det som
   fremstår som overskrift i presentasjonen, må også være merket som
   overskrift i dokumentet. Det er ikke nok å lage en tekstboks med stor
   skriftstørrelse og fet skrift, fordi en skjermleser bruker koden bak
   formateringen til å forstå at det er en overskrift."* (What looks like a
   heading must also be marked as a heading. A text box in large bold type is
   not enough, because a screen reader uses the code behind the formatting.)
   Use the built-in layouts under *Lysbilder → Oppsett* (Slides → Layout),
   whose title field also puts the title first in the reading order.
2. **Every slide has a title, ideally a unique one.** Screen-reader users use
   the titles to navigate and to pick the right slide. *"Hvert bilde bør få en
   unik tittel"* (Each slide should get a unique title.)
3. **Reading order must be logical.** *"En skjermleser leser objektene i et
   lysbilde i den rekkefølgen de ble lagt til."* (A screen reader reads a
   slide's objects in the order they were added.) If a list was added before
   the heading, the list is read first, and *"feil leserekkefølge kan gjøre
   hele dokumentet umulig å forstå"* for a screen-reader user (a wrong reading
   order can make the whole document impossible to understand). Fix it in the
   selection pane.
4. **Alt text on images and illustrations.** *"Bilder og illustrasjoner som
   brukes i presentasjoner, skal ha en alternativ tekst som beskriver
   innholdet i bildet … slik at en person som ikke ser bildet, likevel forstår
   informasjonen det er ment å gi."* (Images and illustrations shall have alt
   text describing them, so that someone who cannot see the image still gets
   its information.) Purely decorative images are exempt. Keep each alt text
   short. One alt text can explain the purpose of the whole slide.
5. **Tables are made with the table tool and have header rows.** Tables are
   hard to navigate with assistive technology, and *"korrekt merking og bruk
   av overskriftsrader er avgjørende"* (correct marking and use of header rows
   is critical). Never fake a table with tabs or spaces.
6. **Links have descriptive text.** The purpose of a link must be clear from
   its text. Avoid *"Les mer"* and *"Klikk her"* (WCAG 2.4.4). PowerPoint
   underlines links automatically, so links are not shown by colour alone.
7. **Contrast.** *"4,5:1 for liten tekst og 3,0:1 for stor eller fet tekst"*,
   where large text is over 24 px, or at least 19 px in bold.
8. **Fonts.** Use common typefaces whose letters are easy to recognise and
   whose strokes are not too thin. Avoid much italic text and long runs of
   capitals.
9. **Language.** *"Du må angi hvilket språk teksten er skrevet på."* (You must
   state the language the text is in.) A screen reader then picks the right
   voice. Passages in another language, such as quotations, should be marked
   with their own language.
10. **Keep slides simple.** Presentations should be easy to read and
    understand. Too much text and too many elements make them hard to follow.
11. **Run the accessibility checker.** Use the built-in checker (*Se
    gjennom → Kontroller tilgjengelighet*, Review → Check Accessibility).
12. **Export a tagged PDF and check it as well.** When saving as PDF, keep
    *"Merker for dokumentstruktur for tilgjengelighet"* (document structure
    tags for accessibility) switched on under *Flere alternativer →
    Alternativer*. It is usually on by default. A universally designed PDF has
    to start from a universally designed source, and it is easier to fix
    accessibility in the source than in a PDF editor afterwards, so check both
    the source and the PDF.
13. **Teachers' own material must be universally designed**, PowerPoint
    included (from "Lærerens ansvar for universell utforming").

### 2. How Marp 4.5.1 expresses each point (measured)

| Point | HTML (`--html` or default) | Tagged PDF | PPTX made of slide pictures |
|---|---|---|---|
| Headings | `#` → `<h1>`, `##` → `<h2>`, inside `<section id="n" lang="nb">` within an `<svg><foreignObject>` with no `role`, so the content stays exposed | `H1`, `H2` structure elements. Exception: on the `bg` slide the `##` was tagged generic `H` | No text at all. `ppt/slides/slideN.xml` holds one unnamed shape, and the slide is a background picture |
| Slide with no heading | No heading. Nothing warns about it | No heading. With `--pdf-outlines` its bookmark is "Page 4" (in English, in an `nb` deck). Slides with headings get "Page n" with the heading nested under it | n/a |
| Document title | `title:` → `<title>`, `description:` → `<meta name="description">` | `/Title` set, `/DisplayDocTitle true` | `dc:title` set |
| Language | `lang: nb` → `<html lang="nb">` and `lang` on every `<section>`. `<span lang="en">` is kept, even without `--html` | `/Lang (nb)` only. **The `en` span is lost** | None |
| Alt text | `![alt](x)` → `alt="…"`. `![](x)` → `alt=""` (decorative). `![w:300 alt](x)` strips the keyword and keeps the alt text | `Figure` with `/Alt` (UTF-16). The `alt=""` image is not a `Figure` (artifact) | **None.** No `descr` anywhere |
| Background image `![bg right:40% alt](x)` | A `<figure>` with CSS background and `<figcaption>alt</figcaption>`, in a background `<section>` that comes **before** the content `<section>` in the DOM | `Figure` with **no `/Alt`**. The caption text is not in the text layer | n/a |
| Table | `<table>` with `<th>` in the first row. Markdown cannot make row headers | `Table`/`TR`/`TH`/`TD`, and `TH` has `/Scope` | Picture |
| Link | `<a href>` with its text | `Link` structure element plus a `/Link` annotation | Picture: **not clickable** |
| Reading order | DOM order is source order. `flex-direction: row-reverse` showed B left of A while the DOM reads A, B | `pdftotext` follows the visual order (B, A). The tag tree follows the DOM (tag order not inspected item by item) | n/a |
| Speaker notes | In the presenter view (`.bespoke-marp-note`) | Not included (the `--pdf-notes` annotations were checked in #492) | `notesSlideN.xml`, as text |

### 3. Where Uutilsynet and WCAG 2.2 AA differ

The success criteria below are quoted from the W3C source.

- **Titles.** WCAG asks for *"Web pages have titles that describe topic or
  purpose"* (2.4.2, A) and *"Headings and labels describe topic or purpose"*
  (2.4.6, AA). Uutilsynet's *unique* title per slide goes further. It comes
  from PowerPoint's checker, not from a WCAG criterion.
- **Reading order** is 1.3.2, *"a correct reading sequence can be
  programmatically determined"* (A). Headings and tables are 1.3.1, *"structure,
  and relationships conveyed through presentation can be programmatically
  determined"* (A).
- **Alt text** is 1.1.1 (A). Decorative content is exempt in both.
- **Links** are 2.4.4 (A), *"from the link text alone or from the link text
  together with its programmatically determined link context"*. Uutilsynet's
  advice against "Les mer" even when the context explains it is stricter than
  the criterion.
- **Contrast** is 1.4.3 (AA, 4.5:1, large text 3:1) and 1.4.11 (AA, 3:1 for
  graphics). WCAG defines large text as 18 pt or 14 pt bold, which is 24 px or
  about 18.7 px bold. Uutilsynet rounds the bold figure to 19 px. #496's
  18.7 px matches WCAG.
- **Colour** is 1.4.1 (A), the same in both. Underlined links meet it.
- **Language** is 3.1.1 (A) for the page and 3.1.2 (AA) for parts. The same in
  both.
- **Fonts, italics, capitals, amount of text, running a checker** have no WCAG
  criterion. They are Uutilsynet recommendations.
- **The 20 px minimum** in #496 is in neither. It is the skill set's own,
  stricter choice. WCAG's nearest criterion is 1.4.4 Resize Text (200 % zoom).
  Marp's HTML scales as a whole, and 1.4.10 Reflow exempts presentations by
  name: *"Examples of content which requires two-dimensional layout are …
  presentations"*.
- **Images of text** (1.4.5, AA) apply: a slide of rendered text must not be a
  picture when real text is possible. This is the WCAG reason the PPTX made of
  slide pictures fails, and a reason never to put a screenshot of text on a
  slide.
- **Flashing and motion** (2.3.1, 2.2.2) apply to HTML transitions or animated
  GIFs, and Uutilsynet's PowerPoint page does not mention them. Not measured
  here.

### 4. What Norwegian law requires

Read from search excerpts of Lovdata and Uutilsynet's regulation pages, not
from Lovdata itself (see Method):

- **The law.** Likestillings- og diskrimineringsloven (LOV-2017-06-16-51) § 18:
  public and private organisations must make their *"hovedløsninger for
  informasjons- og kommunikasjonsteknologi (IKT) rettet mot eller stilt til
  rådighet for allmennheten"* (main ICT solutions aimed at or made available to
  the public) universally designed, unless that is an unreasonable burden. One
  search excerpt read *"for bruker"* instead of *"for allmennheten"*, so check
  the exact wording on Lovdata.
  There is no "likeverdsforskrift". The regulation is *Forskrift om universell
  utforming av informasjons- og kommunikasjonsteknologiske (IKT)-løsninger*
  (FOR-2013-06-21-732).
- **Scope.** The regulation covers web solutions (including digital learning
  material) and automated machines. A slide show given live in a room is not
  an ICT solution in its sense. A deck **published** on a website or in an app
  is a document in that solution. For the public sector (the Web Accessibility
  Directive, in force from 1 February 2023), documents published after
  1 February 2022, such as PDF and Office files, must meet WCAG 2.1 A and AA
  (through EN 301 549). Older documents are exempt unless they are needed for
  an active case process. Private businesses must meet the 35 WCAG 2.0
  criteria on their web solutions.
- **WCAG 2.2.** Uutilsynet's "Status for nyere versjoner av WCAG" page says
  WCAG 2.2 is not part of Norwegian regulation and will not be soon. One search
  excerpt claims a WCAG 2.2-based EN 301 549 was released in September 2026 but
  is not yet adopted. **Unverified.**
- **Consequence for the skills.** A bar of WCAG 2.2 AA is stricter than the law
  for any format it covers, as long as it covers the structural criteria. A
  public-sector user publishing a deck needs the HTML or PDF to meet WCAG 2.1
  AA. The PPTX made of slide pictures cannot meet it.

## Recommendation (evidence, not a decision)

1. **Extend the bar beyond the visual criteria.** Name 1.1.1, 1.3.1, 1.3.2,
   1.4.5, 2.4.2, 2.4.4, 2.4.6, 3.1.1 and 3.1.2 next to #496's contrast, colour
   and size criteria, so the spec in #490 has one accessibility bar.
2. **Make `drafting-slides` write accessible Markdown by default.** That means:
   - a `#`/`##` heading on every slide, unique across the deck, with
     `<!-- _class: … -->` layouts that keep it
   - `lang:` and `title:` in the front matter, and `<span lang="…">` for
     passages in another language
   - alt text on every content image, and `![](x)` only for real decoration
   - Markdown tables for data, never for layout
   - descriptive link text and no bare URLs
   - no `bg` images for content, since `bg` loses alt text in the PDF and
     reorders HTML
3. **Give `rendering-slides` a structure check alongside the contrast
   script.** On the Deck Source and the output it should check:
   - every slide has a heading, and no two headings are the same
   - every image has non-empty alt text or an explicit decorative marker
   - `lang` and `title` are present
   - links have descriptive text, flagging bare URLs and phrases such as
     "klikk her", "les mer", "click here" and "read more"
   - the PDF has `Tagged: yes`, `/Lang`, `/Title`, `/DisplayDocTitle`, and an
     `/Alt` on each `Figure`
   - theme CSS does not hide link underlines or reorder content (`order`,
     `*-reverse`, absolute positioning in the layout classes)

   Render with `--pdf-outlines` only if slides without headings are banned,
   since otherwise bookmarks read "Page n".
4. **Give `reviewing-presentation` the judgments a script cannot make:**
   whether alt text, headings and link text are good, whether the reading order
   matches the visual order, whether there is too much text or too many
   elements, whether tables are really data, and whether italics and capitals
   are used sparingly.
5. **Keep the PPTX made of slide pictures labelled as inaccessible**, and say
   in that label to publish the HTML or PDF instead. If a slide-picture PPTX is
   ever needed, Marp could at least fill `descr` from each slide's text, but
   that is a later enhancement.

## Mapping table

"Bar" means the accessibility bar decided in #496 (contrast, colour never the
only signal, 20 px minimum). "Partly" means another decision covers part of
it. ✔ means applies, ✘ means it cannot be met in that format.

| Guidance point | HTML | Tagged PDF | Image PPTX | Covered by the bar? | Script or person | Owning skill |
|---|---|---|---|---|---|---|
| Real heading on every slide (1.3.1, 2.4.6) | ✔ | ✔ (H1/H2 tags) | ✘ no text | **No** | Script: presence and uniqueness. Person: does it describe the slide | `drafting-slides` writes it; `rendering-slides` checks it; `reviewing-presentation` judges it |
| Unique slide titles (Uutilsynet) | ✔ | ✔ (outline) | ✘ | **No** | Script | `rendering-slides` |
| Document title (2.4.2) | ✔ `<title>` | ✔ `/Title`, `/DisplayDocTitle` | ✔ `dc:title` | **No** | Script | `drafting-slides` (front matter); `rendering-slides` checks |
| Reading order (1.3.2) | ✔ DOM = source; CSS can break it | ✔ follows DOM; `bg` layers come first | ✘ | **No** | Script: bans reordering CSS and content `bg`. Person: visual matches spoken order | `rendering-slides` (theme and check); `reviewing-presentation` |
| Alt text on images (1.1.1) | ✔ | ✔ `/Alt`; ✘ for `bg` images | ✘ dropped | **Partly** (#494 charts, #495 diagrams) | Script: present and non-empty unless marked decorative. Person: quality | `creating-diagrams`, `creating-charts`, `generating-images` write it; `drafting-slides` places it; `rendering-slides` checks; `reviewing-presentation` judges |
| One alt text explaining the whole slide (Uutilsynet) | ✔ | ✔ | ✘ | No | Person | `drafting-slides`; `reviewing-presentation` |
| Tables with header rows (1.3.1) | ✔ `<th>` automatic | ✔ `TH` with scope | ✘ | **No**, though Marp does it by default | Script: real table markup, no layout tables. Person: is it data | `drafting-slides`; `reviewing-presentation` |
| Descriptive link text (2.4.4) | ✔ | ✔ `Link` tag | ✘ not clickable | **No** | Script: flags bare URLs and "klikk her" phrases. Person: is it descriptive | `drafting-slides`; `rendering-slides` checks; `reviewing-presentation` |
| Links not shown by colour alone (1.4.1) | ✔ | ✔ | ✔ (visually) | **Yes** (colour never the only signal) | Script: theme keeps `text-decoration` on `a` | `rendering-slides` (theme) |
| Text contrast 4.5:1 / 3:1 (1.4.3) | ✔ | ✔ | ✔ | **Yes** | Script (theme pairs); person (rendered slides, text on images) | `rendering-slides`; `reviewing-presentation` |
| Graphics contrast 3:1 (1.4.11) | ✔ | ✔ | ✔ | **Yes** | Script (theme values passed on); person | `creating-diagrams`, `creating-charts`; `reviewing-presentation` |
| Common, legible fonts; no thin strokes (Uutilsynet) | ✔ | ✔ | ✔ | **Partly** (system font stacks, 20 px) | Script: font size and weight (brand fonts below 400 weight). Person: legibility | `rendering-slides` (theme, brand-font intake) |
| Little italic text, few capitals (Uutilsynet) | ✔ | ✔ | ✔ | **No** | Script: count `*…*` and runs of capitals. Person | `drafting-slides`; `reviewing-presentation` |
| Document language (3.1.1) | ✔ `<html lang>` | ✔ `/Lang` | ✘ | **No** | Script | `drafting-slides` (`lang:`); `rendering-slides` checks |
| Language of parts (3.1.2) | ✔ `<span lang>` | ✘ **lost in PDF** (measured) | ✘ | **No** | Script: presence. Person: which phrases need it | `drafting-slides`; open question for `rendering-slides` |
| No images of text (1.4.5) | ✔ | ✔ | ✘ whole deck is pictures | **No** | Person; script can flag images with much OCR text | `drafting-slides`, `generating-images`; `reviewing-presentation` |
| Less text, fewer elements (Uutilsynet) | ✔ | ✔ | ✔ | **Partly** (20 px minimum limits density) | Script: overflow and word count per slide. Person | `planning-presentation`, `drafting-slides`; `reviewing-presentation` |
| Tagged PDF export | n/a | ✔ Marp's default (measured) | n/a | **No** (#491 only says "tagged") | Script: `Tagged: yes`, structure tree | `rendering-slides` |
| Run an accessibility checker on both source and PDF | ✔ | ✔ | ✘ | **No** | Script, then person | `rendering-slides` (script); `reviewing-presentation` (review) |
| Flashing and motion (2.3.1, 2.2.2; not in Uutilsynet's page) | ✔ (transitions, GIFs) | n/a | n/a | **No** | Script: flags animated media and transitions. Person | `drafting-slides`; `reviewing-presentation` |

## Open questions

- **Language of parts in the PDF.** Chrome drops `<span lang>` from the PDF
  tags (measured). Is that a Marp setting, a Chrome limit, or acceptable for
  the skills? It probably matters only for mixed-language decks.
- **Slides without a heading.** Should a heading be compulsory on every slide
  (images, quotes, title slide), visible or visually hidden? That decides
  whether `--pdf-outlines` is safe and how the `visual` and `quote` layout
  classes are written.
- **Decorative images.** `![](x)` means "decorative" in Marp, so a forgotten
  alt text is silent. Should the Deck Source need an explicit marker (for
  example `![decorative](x)` mapped to `alt=""`, or a comment), so the check
  can tell the two apart?
- **`bg` images for content.** Ban them, or report Marp's behaviour upstream
  (no `/Alt` in the PDF, background layer read before the heading)?
- **Image PPTX alt text.** Should `rendering-slides` add each slide's text as
  `descr` to the PPTX pictures after Marp exports them, or keep the PPTX
  clearly second-class?
- **Verifying the Norwegian wording.** The Uutilsynet and Lovdata quotations
  here come from search excerpts. Someone with access to those sites should
  check them before they go into SKILL.md prose. Also check the claimed
  September 2026 EN 301 549 release.

## Sources

Uutilsynet (read through search excerpts; the site could not be reached):

- [PowerPoint](https://www.uutilsynet.no/veiledning/powerpoint/229)
- [Utforming og presentasjon](https://www.uutilsynet.no/veiledning/utforming-og-presentasjon/227)
- [Kontrast](https://www.uutilsynet.no/veiledning/kontrast/48)
- [Tabeller](https://www.uutilsynet.no/veiledning/tabeller/225)
- [Lenker](https://www.uutilsynet.no/veiledning/lenker/214) and
  [2.4.4 Formål med lenke (i kontekst)](https://www.uutilsynet.no/veiledning/244-formal-med-lenke-i-kontekst/1251)
- [Bilder og grafikk](https://www.uutilsynet.no/veiledning/bilder-og-grafikk/205)
- [PDF](https://www.uutilsynet.no/veiledning/pdf/218) and
  [Rettleiar for universelt utforma Word- og PDF-dokument](https://www.uutilsynet.no/veiledning/rettleiar-universelt-utforma-word-og-pdf-dokument/1636)
- [Dokumenter på nettsider](https://www.uutilsynet.no/veiledning/dokumenter-pa-nettsider/208)
- [Lærerens ansvar for universell utforming](https://www.uutilsynet.no/veiledning/laererens-ansvar-universell-utforming/2675)
- [Status for nyere versjoner av WCAG](https://www.uutilsynet.no/fremtidig-regelverk/status-nyere-versjoner-av-wcag/1868)
- [EUs webdirektiv (WAD)](https://www.uutilsynet.no/webdirektivet-wad/eus-webdirektiv-wad/265)
- [Unntakene fra universell utforming av ikt](https://www.uutilsynet.no/regelverk/unntakene-fra-universell-utforming-av-ikt/2248)

Law (read through search excerpts; Lovdata could not be reached):

- [Forskrift om universell utforming av IKT-løsninger, FOR-2013-06-21-732](https://lovdata.no/dokument/SF/forskrift/2013-06-21-732)
  and the [2021 amendment, FOR-2021-12-21-3939](https://lovdata.no/forskrift/2021-12-21-3939)
- [Likestillings- og diskrimineringsloven, LOV-2017-06-16-51](https://lovdata.no/nav/lov/2017-06-16-51/kap3/%C2%A717)

W3C (read from the W3C source repository):

- [WCAG 2.2](https://www.w3.org/TR/WCAG22/). Success-criterion text from
  [`w3c/wcag` `guidelines/sc/`](https://github.com/w3c/wcag/tree/main/guidelines/sc)
- [WCAG2ICT](https://github.com/w3c/wcag2ict), the W3C guidance on applying WCAG
  to non-web documents. Its existence was checked; its content was not read.

Measured: Marp CLI 4.5.1 (Marp Core 4.4.0), chrome-headless-shell
155.0.8059.39, `pdfinfo`, `qpdf`, `pdftotext`, unzip. The render setup is
from [`headless-browser-provisioning.md`](https://github.com/ken-guru/skills/blob/research/headless-browser-provisioning/docs/research/headless-browser-provisioning.md).
