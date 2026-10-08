# Trace Logo Editor Operations

Production operations are managed from the main PC's shared workspace:

`C:\Users\tabaw\Documents\sbc-ops`

Read that workspace's README.md, inventory.json, and the font section of
OPERATIONS.md for the maintained deployment, backup, recovery, and tunnel
procedures. This repository remains the source of truth for the application code.
Do not create a second running deployment or copy its code into the operations repo.

```powershell
cd C:\Users\tabaw\Documents\sbc-ops
.\ops.ps1 status font
.\ops.ps1 backup font
.\ops.ps1 deploy font
.\ops.ps1 rollback font
```

The production layout is unchanged:

- Public URL: https://trace-logo-editor.pages.dev/
- SSH alias: diva-sbc
- SBC code: /home/orangepi/trace-logo-editor
- Container: trace_logo_editor, bound to 127.0.0.1:8787
- Dedicated tunnel: trace-logo-cloudflare-tunnel.service
- Persistent data: data/shared-project.json on the SBC, excluded from Git

Static and Pages Function changes also need the Pages deployment described in
this repository's [README.md](README.md). Application development and Git commits
stay in this repository; server lifecycle and recovery use sbc-ops.

This deployment is independent of DIVA and the bot manager. User linger is
currently enabled; the former instructions describing it as disabled are obsolete.
