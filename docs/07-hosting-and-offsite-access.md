# 07 · Hosting & Offsite Access

How family reach their L.A.B Hub from outside the house, safely.

## The decision: Tailscale (live), Cloudflare Tunnel (staged, off)

| | **Tailscale (chosen)** | Cloudflare Tunnel + Access |
|---|---|---|
| What a family member installs | The Tailscale app, plus a share invite | Nothing: a browser and an emailed code |
| Who can reach the server | Only devices you let into (or share with on) the tailnet | Anyone with the URL gets as far as the Access login |
| Who can read the traffic | Nobody: encrypted end to end | Cloudflare decrypts it at its edge |
| Needs | Nothing else | A domain on Cloudflare, Access, and the hardening below |
| Covers your own SSH / Nextcloud | Yes, if you allow it | No — Hub only |

Tailscale keeps the whole platform off the public internet. Nothing is published, nothing on the router changes, no domain is needed. The cost is that each family device runs the Tailscale app.

## The safety rule that shapes everything

The Manager is the **control plane**. It can change AI settings, onboard admins and read telemetry, and on the home network it trusts the caller. **It must never be reachable from outside the house.**

The **off-network guard** in `server.js` enforces that by *address*:

- **Home** means a private LAN address (10/8, 172.16/12, 192.168/16, link-local) or the box itself, talking to the Manager directly.
- **Everything else is off-network**: a Tailscale device (100.64.0.0/10, fd7a:115c:a1e0::/48), anything that came through a proxy (`X-Forwarded-For`, Cloudflare's `cf-*` headers, Tailscale Serve's identity headers), any public address.
- Off-network callers get the **family surface only**: the Hub, shared lists and calendar, the Sauce, the store, the kiosk, and listing/running scenes — and since 1.8, **only with a family sign-in**. A tailnet can hold devices that aren't family (work machines, a friend's laptop), so away from home every family API call carries a session (`Authorization: Bearer`, from `POST /api/accounts/login`); account-scoped calls must be about the signed-in account; sign-up is home-only (family join by invite); phone calendar subscriptions use a separate read-only feed key.
- The Manager dashboard `/`, `/admin`, `/install`, `/showcase` and every control API (settings, dev team, ledgers, Conductor config, fleet, audit, house, engines, tailscale…) return **403** off-network unless valid admin key headers are sent.
- **At home too**, the admin tier needs the Admin Portal's session (unlock with the USB key file). Only the box itself is exempt — which is what makes the SSH tunnel below work.

Deciding by address rather than by the absence of a header means any new way in starts locked. `scripts/smoke.sh` checks all of this every run: proxied requests must get 403 on the control plane and 401 on family calls without a sign-in, and LAN requests must get 401 on admin calls without the key.

## Tailscale: how it is set up

Installed on lab-main-01 from Tailscale's signed apt repository and brought up as:

```bash
sudo tailscale up --operator=tao --accept-dns=false
```

- `--operator=tao` lets the Manager (which runs as `tao`) switch access on and off, and fetch a new sign-in link, without root.
- `--accept-dns=false` leaves the server's own DNS alone.

**Admin → Off-site access** is the day-to-day control. It shows:
- state, the server's tailnet address and the family link, with copy buttons
- every device that can reach the server, grouped by owner, with guests (people it was shared with) marked, and when each one last used the Hub
- a live sign-in link if the server is ever signed out, and the switch to cut or restore off-site access

## Letting someone in

1. In the Tailscale admin console, open lab-main-01 and choose **Share**. Send the invite.
2. They install Tailscale, sign in with their own account, and accept.
3. They open the family link from Admin → Off-site access (`http://<server's 100.x address>:8090/hub/`).

Sharing is quarantined: they can reach this server and nothing else of yours, and the server can't start connections to them. To limit what shared users can reach on the server to the Hub alone, add this to the tailnet policy:

```json
{ "src": ["autogroup:shared"], "dst": ["*"], "ip": ["tcp:8090"] }
```

Two more one-time steps:
- **Disable key expiry** for lab-main-01 in the admin console, so the server doesn't sign itself out after 180 days.
- **SSH key-only.** Once the server is on a tailnet, port 22 is reachable from it. Turn off password logins:
  `echo 'PasswordAuthentication no' | sudo tee /etc/ssh/sshd_config.d/00-keys-only.conf && sudo sshd -t && sudo systemctl reload ssh`

Running the Admin portal from away: tunnel over SSH (`ssh -L 8090:localhost:8090 tao@<server>`), then open `http://localhost:8090/admin/`. That arrives as the box itself, so it counts as home.

## Cloudflare Tunnel (staged, not active)

`cloudflared` is installed on the server and an example ingress config is staged at `/srv/lab/stack/cloudflared/config.example.yml`. It is **not safe to switch on as it stands**. Before it ever goes live:

1. **Cloudflare Access is mandatory.** Use an emailed one-time code, restricted to named people. Without it, anyone with the URL can list accounts, sign up (it's open), flip kiosk lights and run the Sauce. PINs are short and stored in plain text.
2. **Rewrite the staged ingress.** It predates shared lists, calendar, the Sauce, scenes and `/ws`, so most of today's Hub would 404 through it.
3. **Verify the Access JWT at the Manager** for tunnel traffic, so that switching Access off by mistake fails closed.
4. **Key the PIN limiter on `cf-connecting-ip`.** Through the tunnel every visitor arrives from 127.0.0.1, so one person's wrong PINs would lock out everyone.

Going live then needs a domain on Cloudflare, `cloudflared tunnel login` (run it yourself, while you're at the browser), `cloudflared tunnel create lab`, `cloudflared tunnel route dns lab lab.<domain>`, the config at `/etc/cloudflared/config.yml`, and `cloudflared service install`.

## Status

- [x] Off-network guard decides by address; Tailscale and proxied traffic see the family surface only (M-000029)
- [x] Tailscale installed on lab-main-01; operator `tao`; Admin → Off-site access panel
- [x] Server signed in to Tailscale; SSH key-only (2026-09-28)
- [x] Family sign-in required away from home; admin key required for the control plane at home (V1.8, M-000032/33)
- [ ] Shared with family; key expiry off (needs Tao)
- [ ] Cloudflare Tunnel: staged only, see the four items above before ever enabling it (sessions now cover item 1's worry about an open family surface, but Access is still the right front door for a public hostname)
