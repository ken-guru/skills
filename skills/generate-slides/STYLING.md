# Image Layout Reference

## The golden rule

**For every slide that has bullet points or paragraph text AND an image — always use `img-right`:**

```html
<img src="images/your-image.png" alt="Description" class="img-right">

## Slide Heading

- Bullet one
- Bullet two
- Bullet three
```

Place the `<img>` tag **after the heading, before any text content**. The image floats right (33% width), text flows left (67% width). No vertical space is wasted and the image cannot push content below the viewport.

---

## When centered images are allowed

A slide is a **title or section-divider slide** if it has **only a heading (H1 or H2) and no bullet points or paragraph text**. Centered `![alt](path)` syntax is allowed on these slides.

```markdown
# Hackathon 2026 — Agentisk Utvikling

![](images/title-hero.png)
```

```markdown
## Del 1 — Problem: Risikoer og guardrails
```

---

## Forbidden patterns

| Do NOT use | Reason |
|---|---|
| `![bg](image.png)` | Creates full-screen background that obscures text |
| `![bg left](image.png)` | Same — background directive |
| `![bg right](image.png)` | Same — background directive |
| `![alt](image.png)` on content slides | Centered, 35vh max-height, pushes bullets below viewport |
| `<div style="display:flex">` | Fragile, unreliable with Marp |
| `<img src="...">` with no class | Renders as centered block image |

---

## Layout specifications

| Use case | Syntax | Width | Max height |
|---|---|---|---|
| Content slide with image | `<img class="img-right">` | 33% | 60vh |
| Content slide with image left | `<img class="img-left">` | 33% | 60vh |
| Title / section-divider slide | `![alt](path)` | auto | 35vh |
| Video (dedicated slide only) | `<video src="..." controls></video>` | 100% | 65vh |

---

## Worked example

```markdown
---

### GitHub Advanced Security (GHAS) — obligatorisk grunnmur

<img src="images/ghas-overview.png" alt="GHAS overview diagram" class="img-right">

**Tre pilar:**
- **Dependabot alerts** — automatisk varsling om sårbare avhengigheter
- **Secret scanning** — GitHub blokkerer commits som inneholder hemmeligheter
- **CodeQL** — statisk kodeanalyse finner sikkerhetsfeil automatisk

Se [docs: GitHub security features](docs/sources/ghas-features.md)

---
```

The image sits on the right. All three bullets are visible within the slide. No overflow.
