# Sipurai public quality pilot

Proposed owner is Elad. The staged unit is a user service for the Elad server, scheduled at **06:15 Asia/Jerusalem**. All installation, enabling and test requests against the real public site remain separate operator decisions.

The probe issues one HTTPS HEAD request for each fixed public target. It follows no redirects and sends no authentication, credentials or cookies. It does not execute page scripts or consume an application response body.

| Snapshot key | Target on `https://www.sipurai.ai` | Expected MIME type |
| --- | --- | --- |
| `home` | `/` | `text/html` |
| `sample` | `/samples/demo-dragons-garden` | `text/html` |
| `storybookArt` | `/images/spx/styles/storybook.webp` | `image/webp` |

A result includes the numeric HTTP status, whether the response MIME matches and a reachable boolean based only on HTTP 200 and MIME. An unavailable response yields null status and a fixed diagnostic for timeout, oversized headers or other transport failures. Responses can prove host-level route availability only. A SPA can return the same HTML for multiple routes, so this probe does not establish reader behavior, browser smoke results, funnel performance or loading speed. The standard daily snapshot fields stay null. No issue proposal is inferred from a single public HEAD check.

The collector imports the same snapshot builder as the offline fixture CLI. It limits each response header to 8 KiB and each request to five seconds. Three requests are sequential. The unit applies a 30-second deadline, 20% CPU quota, 128 MiB memory cap and an exclusive `flock`. An atomic per-day claim prevents repeating collection on the same Israel date and remains if transport or writing fails. The snapshot is a mode-0600 file of at most 8 KiB, linked into place only after closing and syncing a staged file. No credentials, redirects, URLs from responses, raw errors, bodies or timing estimates are retained. Fixed local diagnostics go to stderr. No mail, messaging, paid model or remote writes are configured.

## Staged layout for an approved installation

- Put `daily-quality.mjs`, `public-quality-pilot.mjs` and `public-quality-pilot-cli.mjs` in a private checkout copy at `~/.local/share/sipurai-quality-pilot/` under Elad's intended account. Verify the Node executable selected in the unit before installation. Node 22.23.4 was used for local checks.
- Provision the private, owner-only directory `%S/sipurai-quality-daily` (normally `~/.local/state/sipurai-quality-daily` for a user manager), mode 0700. The CLI rejects state directories accessible by group or other users.
- Review the staged service and timer under `systemd/` before copying them into the intended user manager's unit directory. Check the effects of `CPUQuota`, `MemoryMax` and `TasksMax` under the account's cgroup delegation. Confirm `systemd-analyze calendar '*-*-* 06:15:00 Asia/Jerusalem'` shows the expected next occurrence.
- The unit defaults to `SIPURAI_QUALITY_DAILY_ENABLED=false`. An optional private `~/.config/sipurai-quality-daily.env` can contain the single switch variable. Only the exact value `true` permits any reads or reservations. A timer alone does not enable collection. Recheck outputs and unit limits under the intended account before the first enabled run.
- Update the environment file to `false` to gate future runs. A running service keeps the environment it started with, so stop it as well for an immediate halt. Keep claim files when stopping so the ordinary invocation cannot retry the same day.
- For removal after authorization, disable and stop `sipurai-quality-daily.timer`, then stop `sipurai-quality-daily.service`, using the intended account's `systemctl --user`. Remove only the two installed unit files and reload the user manager. Preserve the private snapshots, claim files, interrupted staging files and diagnostic logs unless their owner explicitly approves a retention action.

The fixture CLI and public pilot are independent entry points. Source and aggregate counters remain separate from the public reachability check. Designed PDF, brief message and archive link can be derived from the daily snapshot in a later phase once a private destination and permissions are selected. No deployment or routing step is implied by publishing a local JSON sample.
