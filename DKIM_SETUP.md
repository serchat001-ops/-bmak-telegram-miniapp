# DKIM Setup for bmak.finance

This document explains how to activate DKIM signing for outgoing email from contact@bmak.finance so replies don't land in spam.

---

## Step 1 — Add the DKIM TXT record in Namecheap

1. Log in to Namecheap → My Domains → **bmak.finance** → **Advanced DNS**
2. Click **Add New Record** → choose **TXT Record**
3. Fill in:

| Field | Value |
|-------|-------|
| **Host** | `mail2026._domainkey` |
| **Value** | see below |
| **TTL** | Automatic (or 3600) |

**Value to paste (copy the entire line):**

```
v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAotqv3NppHXhBwscqNXryx9NoaPm9mfQYUgU5BF4idRuxHtw0SHxAdHvtpeaq+SfIOU6AZOt+ZoOtSBxeTBJy2P8b4J44dWVpsqHqnEoZh3PdhXKDeHEshDEDwhSUYYdByLjwjPOhWFkCNWnWkgL3el4IMLFkFAzsoIxqOo9jjhzNzbGHJA4fxhzJ8knrNUbwYQHpmqO9LrYTmfajZypzJEP489okaleW62qB9Wt6oTTdNwdy3Fml4AOhxEFvl+49a9yAbnMg99Pmcou/ximKsZJLYCdVVKFRQjeyPYeWDNvK2QmgeSkX8KFpnXr6Qp2Q9sfFRhOpHC3g9nM5MvamkwIDAQAB
```

4. Save the record. DNS propagation takes 15–60 minutes.

---

## Step 2 — Add the DKIM_PRIVATE_KEY Replit Secret

The matching private key must be stored as a **Replit Secret** (not an env var):

1. In your Replit project, open the **Secrets** tab (lock icon in the left sidebar)
2. Create a new secret:
   - **Key**: `DKIM_PRIVATE_KEY`
   - **Value**: the RSA private key provided to you separately by the agent
3. Save

The selector (`mail2026`) and domain (`bmak.finance`) are already stored as environment variables.

---

## Step 3 — Configure ImprovMX for DKIM (outbound SMTP replies)

ImprovMX DKIM signing requires the **Standard plan or higher**.

### If you upgrade ImprovMX:
1. Log in to [improvmx.com](https://improvmx.com) with **ben.makoma98@gmail.com**
2. Go to **bmak.finance** → **Settings** → **DKIM**
3. ImprovMX will generate its own key pair and show you a TXT record — add that record to Namecheap **in addition** to the one above (it uses a different selector)
4. Click **Verify** once the DNS record has propagated

### If you stay on the free ImprovMX plan:
Outbound replies sent via ImprovMX SMTP won't be DKIM-signed by ImprovMX. However, if you send via the site's contact API (SMTP credentials in the app), DKIM signing is already wired in — see Step 4.

---

## Step 4 — App-level DKIM (code already updated)

`server/src/email.js` reads the DKIM credentials automatically and passes them to Nodemailer:

- `DKIM_PRIVATE_KEY` secret — RSA 2048-bit private key
- `DKIM_SELECTOR` env var — `mail2026`
- `DKIM_DOMAIN` env var — `bmak.finance`

Every email sent through the contact form will be DKIM-signed once the DNS record in Step 1 is live and the secret is set.

---

## Step 5 — Verify

After the DNS record propagates and the secret is in place:

1. Go to [mail-tester.com](https://www.mail-tester.com) and copy the test address shown
2. Send a message from your site's contact form to that address
3. Click **Check your score** — you should see **SPF: pass** and **DKIM: pass**

DNS lookup check: `https://mxtoolbox.com/SuperTool.aspx?action=dkim%3abmak.finance%3amail2026&run=toolpage`

---

## Summary of DNS records for bmak.finance

| Type | Host | Purpose |
|------|------|---------|
| MX | @ | ImprovMX inbound forwarding |
| TXT | @ | SPF record (`v=spf1 include:spf.improvmx.com ~all`) |
| TXT | `mail2026._domainkey` | **DKIM public key** (added in Step 1) |
