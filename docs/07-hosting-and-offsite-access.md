# 07 · Hosting & Offsite Access

How family members reach their L.A.B Hub from outside the house — safely.

## The decision: Cloudflare Tunnel, not port-forwarding

| | Port-forwarding | **Cloudflare Tunnel (chosen)** |
|---|---|---|
| Opens ports on your router | Yes (attack surface) | **No — outbound only** |
| Needs a static/public IP | Usually | **No** |
| Encryption to the edge | You set it up | **Automatic HTTPS** |
| Hides your home IP | No | **Yes** |
| Extra auth (email-gated) | DIY | **Cloudflare Access, built in** |

Port-forwarding exposes the Main Server directly to the internet and leaks your home IP. A Cloudflare Tunnel makes an **outbound** connection from the server to Cloudflare; traffic comes back down that pipe. Nothing on your router changes.

## The safety rule that shapes everything

The Manager is the **control plane** — it can change AI settings, onboard admins, and read telemetry, and today it trusts the LAN (no login on `/` or most `/api/*`). **That must never be exposed to the internet.**

So the tunnel is configured to forward **only the Hub** (`/hub`, which already has account + PIN auth) and the handful of APIs the Hub needs. Everything else — the Manager dashboard, `/admin`, `/install`, `/api/settings`, `/api/devteam`, `/api/admin/*`, `/api/fleet/*` — returns **404 at Cloudflare's edge** and never reaches the server. This is enforced in the tunnel's ingress rules (already staged on the server).

The staged config lives at: `/srv/lab/stack/cloudflared/config.example.yml`

## Why this isn't switched on yet

Going live needs **your Cloudflare account** — a browser login (`cloudflared login`) that authenticates to *your* account and picks *your* domain. That's a credential step the AI must not perform on your behalf. Everything up to that point is done: `cloudflared` **2026.8.3 is installed** and the safe ingress config is staged.

## Go-live (≈10 minutes, needs your Cloudflare login)

You need a domain on Cloudflare (free plan is fine). On the server (`ssh tao@192.168.1.115`):

```bash
# 1) Authenticate to YOUR Cloudflare account (opens a browser link)
cloudflared login

# 2) Create the tunnel and a DNS route
cloudflared tunnel create lab
cloudflared tunnel route dns lab lab.YOURDOMAIN.com

# 3) Drop the tunnel ID + domain into the staged config
sudoedit /srv/lab/stack/cloudflared/config.example.yml   # replace the REPLACE_WITH_* + YOURDOMAIN
sudo cp /srv/lab/stack/cloudflared/config.example.yml /etc/cloudflared/config.yml

# 4) Run it as a service
sudo cloudflared service install
sudo systemctl enable --now cloudflared
```

Family then opens **https://lab.YOURDOMAIN.com/hub/** from anywhere.

### Strongly recommended: put Cloudflare Access in front

In the Cloudflare Zero Trust dashboard → Access → Applications, add `lab.YOURDOMAIN.com` and require a one-time email code (or Google login) for the specific people you invite. Now even the Hub is gated by email before the PIN screen — two layers, and you can revoke anyone instantly.

## Quick test option (no account, not for real use)

To see offsite access working for a few minutes without any setup:

```bash
cloudflared tunnel --url http://localhost:8090
```

This prints a random `https://something.trycloudflare.com` URL. **Caveats:** it forwards the *whole* Manager (control plane included), the URL is random and dies on restart, and there's no Access layer — so use it only for a quick connectivity test on a network you trust, then Ctrl-C it. It is **not** a way to run the platform.

## Roadmap hardening (before opening the Hub widely)

- Add real login sessions to the Manager `/api/*` control routes (so LAN-only is defense-in-depth, not the only wall).
- Rate-limit `/api/accounts` (signup) or gate new accounts behind an admin invite.
- Move the Hub's PIN to a salted hash (currently stored plainly for Beta).

## Status

- [x] `cloudflared` installed on lab-main-01 (2026.8.3)
- [x] Safe ingress config staged (Hub-only exposure)
- [x] Documented go-live + Access hardening
- [ ] Tunnel activated — **waiting on your Cloudflare login + domain**
