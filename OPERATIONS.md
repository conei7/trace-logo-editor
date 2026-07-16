# Trace Logo Editor Operations

## Production layout

- Fixed URL: `https://trace-logo-editor.pages.dev/`
- SBC host: `orangepi5` (`diva-sbc` SSH alias)
- SBC repository: `/home/orangepi/trace-logo-editor`
- Container: `trace_logo_editor`
- Loopback port: `127.0.0.1:8787`
- User service: `trace-logo-cloudflare-tunnel.service`
- Tunnel log: `/home/orangepi/trace-logo-cloudflared.log`
- Persistent project: `/home/orangepi/trace-logo-editor/data/shared-project.json`

This deployment is independent from Diva Player. It does not use port 8080, the
`backend_default` Docker network, `diva-cloudflare-tunnel.service`, or Diva's
Cloudflare KV namespace.

## Normal deployment

Commit and push on Windows first. Then update only this repository and container:

```powershell
ssh.exe -F C:\Users\tabaw\.ssh\config diva-sbc "cd ~/trace-logo-editor && git pull --ff-only && docker compose up -d --build"
```

Static or Pages Function changes also require a Pages deployment:

```powershell
npm.cmd run build:pages
npx.cmd --yes wrangler@latest pages deploy dist --project-name trace-logo-editor --branch main
```

## Status checks

```powershell
ssh.exe -F C:\Users\tabaw\.ssh\config diva-sbc "cd ~/trace-logo-editor && docker compose ps && systemctl --user status trace-logo-cloudflare-tunnel.service --no-pager"
curl.exe -fsS https://trace-logo-editor.pages.dev/api/health
```

The current temporary tunnel URL is available with:

```powershell
ssh.exe -F C:\Users\tabaw\.ssh\config diva-sbc "grep -hEo 'https://[-a-zA-Z0-9.]+\.trycloudflare\.com' ~/trace-logo-cloudflared.log | tail -1"
```

## Data backup and restore

The project JSON is deliberately excluded from Git. Back it up before data repair
or host migration:

```powershell
scp.exe -F C:\Users\tabaw\.ssh\config diva-sbc:/home/orangepi/trace-logo-editor/data/shared-project.json .
```

To restore, stop the editor container, copy the JSON, then start it again. Do not
replace the file while users are actively editing.

```powershell
ssh.exe -F C:\Users\tabaw\.ssh\config diva-sbc "cd ~/trace-logo-editor && docker compose stop"
scp.exe -F C:\Users\tabaw\.ssh\config shared-project.json diva-sbc:/home/orangepi/trace-logo-editor/data/shared-project.json
ssh.exe -F C:\Users\tabaw\.ssh\config diva-sbc "cd ~/trace-logo-editor && docker compose up -d"
```

## Boot behavior

Docker uses `restart: unless-stopped`. The tunnel is a user systemd service. Since
linger is disabled on this SBC, crontab also starts the tunnel service after boot.
The service updates the editor's own Cloudflare KV whenever its Quick Tunnel URL
changes, so the fixed Pages URL remains unchanged.
