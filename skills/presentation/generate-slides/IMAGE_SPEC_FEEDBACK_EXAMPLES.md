# IMAGE_SPEC Feedback Examples

This document shows example feedback that users will receive when image specifications change.

## Example 1: First run (all images are "new")

```
🖼️  Added images: 8

  Slide 2 — The Challenge
  ├─ Filename: images/challenge-abstract.png
  ├─ Prompt: "Abstract visualization of a complex system failing. Dark background with red circuit patterns breaking apart, geometric shapes fragmenting outward, cyberpunk aesthetic, high contrast"
  └─ 📋 Ready to generate with your AI tool

  Slide 4 — Our Solution Architecture  
  ├─ Filename: images/architecture-diagram.png
  ├─ Prompt: "Clean technical architecture diagram showing interconnected modules in blue and white, minimalist design, grid background, professional style"
  └─ 📋 Ready to generate with your AI tool

  Slide 7 — Real-world impact
  ├─ Filename: images/impact-metrics.png
  ├─ Prompt: "Dashboard showing upward trending metrics with green indicators, clean data visualization style, transparent background"
  └─ 📋 Ready to generate with your AI tool

  [... 5 more ...]

 💡 Tip: Copy the prompts directly to Midjourney, DALL-E, or your image generation tool.
    See IMAGE_SPEC.md for complete specifications.

📄 Full specification: IMAGE_SPEC.md
```

---

## Example 2: Agenda updated (new + removed + modified)

```
🖼️  Added images: 3

  Slide 5 — Market Opportunity
  ├─ Filename: images/market-size.png
  ├─ Prompt: "Large market visualization with growth arrows and percentage indicators, vibrant greens and blues, professional infographic style"
  └─ 📋 Ready to generate with your AI tool

  Slide 12 — Case Study Results
  ├─ Filename: images/case-study-hero.png
  ├─ Prompt: "Success story visualization with checkmarks and celebration elements, modern flat design, warm color palette"
  └─ 📋 Ready to generate with your AI tool

  Slide 15 — Call to Action
  ├─ Filename: images/cta-background.png
  ├─ Prompt: "Inspiring abstract background suggesting forward momentum, gradient from blue to purple, dynamic composition"
  └─ 📋 Ready to generate with your AI tool

 💡 Tip: Copy the prompts directly to Midjourney, DALL-E, or your image generation tool.
    See IMAGE_SPEC.md for complete specifications.

🗑️  Removed images: 2

  - images/old-intro.png (was: Slide 1 — Introduction)
  - images/outdated-timeline.png (was: Slide 8 — Historical Context)

 💡 These files are no longer needed. You can delete them from the images/ folder if backed up.
    See IMAGE_SPEC.md for the current specification.

✏️  Modified specifications: 1

  images/architecture-diagram.png
  ├─ Slide 4 — Our Solution Architecture
  ├─ Previous prompt: "Technical architecture showing 3 main components connected by arrows"
  └─ Updated prompt: "Clean technical architecture diagram showing interconnected modules in blue and white, minimalist design, grid background, professional style"

 💡 These images need to be regenerated with the updated prompts.
    See IMAGE_SPEC.md for complete specifications.

📄 Full specification: IMAGE_SPEC.md
```

---

## Example 3: Minimal changes (just modified)

```
✏️  Modified specifications: 1

  images/hero-banner.png
  ├─ Slide 1 — Introduction  
  ├─ Previous prompt: "Hero image showing enterprise professionals collaborating"
  └─ Updated prompt: "Hero image showing diverse team of professionals collaborating across digital platforms, modern office setting, energetic atmosphere, photography style"

 💡 These images need to be regenerated with the updated prompts.
    See IMAGE_SPEC.md for complete specifications.

📄 Full specification: IMAGE_SPEC.md
```

---

## Example 4: No changes (silent skip)

When `IMAGE_SPEC.md` is generated with identical content to the previous version, no diff feedback is shown. The normal approval prompt is presented:

```
IMAGE_SPEC.md has been generated with 8 image specifications.
You can use these directly with Midjourney, DALL-E, or other image generation tools.
Would you like to review them before we generate the slides?
```

---

## Integration in Step 8 Final Report

After slides are generated, the report includes:

```
✅ 15 slide(s) generated
🖼️  Image specifications: IMAGE_SPEC.md (8 images)
    📋 Ready to generate images using Midjourney, DALL-E, or your preferred AI tool
    💾 Place generated images in the images/ folder
📝 Proofreading: ✅ No encoding errors or unexpected characters, ✅ Terminology consistent with glossary, ✅ 15 slides — within estimated count
⚠️  Quality warnings: none
❌  Failed sources: none
▶️  Next steps:
    1. Review IMAGE_SPEC.md for image prompts and specifications
    2. Generate images and save to the images/ folder
    3. Open PRESENTASJON.html to preview your presentation
    4. Run `marp -s .` for live presentation mode
```
