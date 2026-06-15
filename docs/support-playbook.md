# TrustAI Support Playbook

One-page guide for handling billing questions and disputes.

## User says: "Why was I charged?"

1. Ask for their **email** or **request ID** (shown on the receipt).
2. Open **Admin → Support** and search.
3. Check:
   - **Credits charged** on the generation row
   - **Prompt + response** text (what they actually ran)
   - **Token count** (prompt + completion)
4. Open **Billing → Credit statement** as the user (or quote the Support lookup data).
5. Explain: *"You were charged X credits for Y tokens on [date]. Here's what the model returned."*

## User says: "The charge is wrong"

1. Find the receipt in **Support Console** or user-reported dispute.
2. Verify the charge is recorded:
   - Receipt page → **Verify** should show batch/signature OK
   - Or run server verify via receipt detail
3. If refund is warranted:
   - Click **Refund** on the generation row, OR
   - **Adjust credits** on Admin → Users with a reason (appears in user's statement)
4. Update dispute status to **Resolved (refund)** with a short note.

## User filed a dispute (Report billing issue)

1. **Admin → Support** → **Open disputes** section
2. Read the user's reason
3. Click **Investigate** when you start reviewing
4. Open **Receipt** to see full context
5. Resolve:
   - **Resolve + refund** — issue credits, add resolution note
   - **Deny** — explain why charge was correct

## Escalation checklist

| Check | Where |
|-------|--------|
| Charge amount | Support lookup / `generation_requests.credit_cost` |
| User balance | Support lookup / `users.credit_balance` |
| Audit trail | `credit_transactions` table (Navicat) |
| Crypto proof | Receipt → Technical proof tab |
| Dispute history | `disputes` table / Support Console |

## Default admin (change before pilot)

- Email: `admin@trustai.local`
- Password: set via `TRUSTAI_ADMIN_PASSWORD` in `.env`

## Smoke test after deploy

```powershell
npm run smoke-test
```
