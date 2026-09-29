# Changelog

## 2.0.0

Baseline for versioned releases. Everything since the unversioned 1.1.0 is in the git history; 2.0.0 marks the breaking changes among it, including new blocking checks such as the 20 px Effective Text Size rule for diagrams.

**Upgrading:** update the plugin (`/plugin update presentation-skills`) or reinstall the Skills (`npx skills update`). Existing Presentation Project Folders may now fail validation: re-run Generate Slides and the Media Renderers, then fix what `presentation-validation` reports.
