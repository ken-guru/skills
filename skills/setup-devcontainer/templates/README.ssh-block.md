## SSH deploy key and signing key

Git push/pull and commit signing use separate developer-owned SSH keys. Put
`deploy-key`, `deploy-key.pub`, `signing-key`, and `signing-key.pub` in a host
directory (a per-repo path under `~/.devcontainer-credentials/` works well)
and export `DEVCONTAINER_CREDENTIALS_DIR` before reopening the
Shared Container. The directory is mounted read-only outside the Shared
Checkout and validated during setup; the code identity cannot read it.
`skills/setup-devcontainer/templates/provision-ssh-keys.sh` generates and
places both keys for you: a fresh deploy key every run (GitHub only allows
one registration per repo), and a signing key it detects and offers to
reuse across repos (it's tied to your account, not any one repo) rather
than always generating a new one. It never contacts GitHub — registration
happens the way described below.

Register the deploy public key for this repository as an Authentication Key
and the signing public key in the account as a Signing Key. The setup prints
the keys and the registration URLs on attach. Dismiss each prompt when done:

```bash
touch ~/.ssh/.deploy-key-registered
touch ~/.ssh/.signing-key-registered
```

No GitHub Administration permission is required for setup. Deploy-key
registration is intentionally manual, and `GH_TOKEN` is never used to manage
repository keys.

`GH_TOKEN` authenticates `gh` API operations; the protected deploy key handles
SSH push/pull, and the protected signing key handles signed commits. The
agent-operation identity can use these credentials, while the code runner
cannot.

## GitHub authority

Use a repository-scoped fine-grained token with this contract:

| Capability | Access |
| --- | --- |
| Issues and pull requests | Read/write |
| Repository contents | Read |
| Workflow files | Write |
| Workflow status/history | Read |
| Dependabot, advisories, code scanning, secret scanning, security events | Read |
| Repository administration, secrets/variables, workflow-run mutation | None |

File changes are delivered through commits, pushes, and pull requests. The
agent does not mutate repository files directly through the GitHub API and
cannot dispatch, rerun, cancel, or approve workflow runs.
