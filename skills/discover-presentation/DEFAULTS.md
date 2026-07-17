# Default Assumptions

## Default table

| Aspect | Default |
|---|---|
| Language | Inferred from user input; defaults to English if not specified |
| Duration | 45 minutes |
| Audience | Mixed technical (developers + some management) |
| Slide density | Max 5–6 bullet points; split if exceeded |
| Presentation style | Informative with a clear narrative arc |
| Visual preference | Picture (AI-generated) |
| Visual composition | Selected Presentation Theme composes each Slide Archetype |
| Presenter notes | Always generated, bullet format |
| Paginate | Always on |
| Theme | Editorial (`editorial`), offline-safe fonts, no External Font Override |
| Code blocks | Not permitted (warn and redirect to image/video) |
| Progressive reveal | Not used (all bullets visible immediately) |

---

## Narrative structures

Infer the most fitting structure from the topic and occasion. Present the inferred choice in the defaults confirmation.

### Technical topic (tool, technology, system)
> problem → solution → demonstration → implications

Slides flow: Why this matters → What the tool is → How to use it → What changes for the team

### Strategy or organizational topic
> why → what → how → next steps

Slides flow: Context and motivation → The goal/vision → Concrete actions → Call to action

### Educational / awareness topic
> context → core content → examples → takeaways

Slides flow: Why you should care → Core concepts → Real-world examples → Key things to remember

### Workshop or hands-on session
> intro → concepts → exercise → summary

Slides flow: Goals for today → Concepts to know → Exercise instructions → Debrief and next steps

---

## Audience profiles and their impact

### Primarily developers
- Use technical terminology freely
- Include architecture diagrams and flow references
- Presenter notes may include code context (not code blocks on slides)

### Mixed technical (default)
- Explain acronyms on first use
- Balance depth with accessibility
- Avoid assuming deep familiarity with any specific tool

### Leadership / management
- Lead with business impact and strategic alignment
- Minimize technical depth on slides
- Reserve technical detail for presenter notes

### External / conference audience
- Define all internal acronyms and organization-specific terms
- Avoid internal references (internal tools, processes, team names)
- Higher production quality expectation — images should be polished

---

## Duration and slide count heuristics

| Duration | Estimated slides (excl. title/agenda) |
|---|---|
| 15 minutes | 8–12 slides |
| 30 minutes | 15–20 slides |
| 45 minutes | 22–30 slides |
| 60 minutes | 30–40 slides |
| 90 minutes | 45–60 slides (consider breaks) |

These are guides — content density varies. Always prefer fewer, clearer slides over many dense ones.
