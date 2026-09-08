# Per-Tool-Container SSH deploy and signing keys, not one shared pair per repo

Every Tool Container now gets its own SSH deploy key and signing key, replacing the single
shared key pair every SSH-enabled Tool Container previously reused. The prior design's stated
rationale — "sharing one key pair doesn't widen the blast radius, since Docker boundaries
between Tool Containers don't apply once the key itself is out" — held only because every Tool
Container already shared one on-disk checkout (Shared Checkout) and therefore already trusted
each other by construction. Once Private Checkout gives each Tool Container its own isolated
disk, a shared SSH volume would be the one surface left connecting them: a compromised or
runaway agent in one container could still read the key material used by every sibling. Moving
to per-container keys closes that surface and buys selective revocation (distrust one tool
without touching the others), at the cost of turning the signing key's one-time manual
GitHub-UI registration step into one per SSH-enabled tool (no API path exists for signing-key
registration or deletion).
