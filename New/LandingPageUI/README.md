# LandingPageUI

Public landing page for **https://www.service-tokens.com**.

Plain static HTML — no build step, no npm. Styles are inline in `index.html` on purpose:
nginx serves `index.html` with `no-cache`, so edits appear immediately after upload.

| File | Purpose |
|---|---|
| `index.html` | The whole page |
| `favicon.svg`, `icon-192x192.png`, `icon-512x512.png` | Browser / phone icons |
| `../../configs/api.conf` | Nginx config (kept in the platform `configs` folder) for `service-tokens.com` + `www` |

## Routing

| URL | Result |
|---|---|
| `https://www.service-tokens.com/` | Landing page (`/var/www/ServiceTokenUI/Landing`) |
| `https://service-tokens.com/` | 301 → `https://www.service-tokens.com/` |
| `https://service-tokens.com/api/…`, `/hubs/…`, `/swagger/…` | Unchanged — .NET API on port 5001 |

The Angular apps call `https://service-tokens.com/api`, so the API must stay on the bare domain.
The `service-tokens.com` certificate already covers `www`, so no new certificate is needed.

## Preview locally

```bash
python -m http.server 8099 --directory "Web Apps/LandingPageUI"
```

Then open http://localhost:8099.

## Deploy

1. Copy the folder and the Nginx configs to the server (from Windows, run from the platform folder):

   ```bash
   scp -i "C:\path\to\your-key.pem" -r "Web Apps\LandingPageUI" ec2-user@52.58.195.158:~/
   scp -i "C:\path\to\your-key.pem" -r "configs" ec2-user@52.58.195.158:~/
   ```

2. On the server:

   ```bash
   sudo mkdir -p /var/www/ServiceTokenUI/Landing
   sudo cp ~/LandingPageUI/index.html ~/LandingPageUI/favicon.svg ~/LandingPageUI/icon-*.png /var/www/ServiceTokenUI/Landing/
   CONF=$(sudo grep -l "server_name service-tokens.com" /etc/nginx/conf.d/*.conf); echo "$CONF"
   sudo cp "$CONF" ~/api.conf.backup
   sudo cp ~/configs/api.conf "$CONF"
   sudo nginx -t && sudo systemctl reload nginx
   ```

### Roll back

```bash
sudo cp ~/api.conf.backup "$CONF" && sudo nginx -t && sudo systemctl reload nginx
```

### Updating the page later

Only `index.html` usually changes — upload it and copy it into `/var/www/ServiceTokenUI/Landing/`.
No nginx reload needed.
