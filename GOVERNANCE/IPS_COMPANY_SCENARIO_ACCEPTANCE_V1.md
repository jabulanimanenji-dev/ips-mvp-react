# IPS Academic Services — Company scenario acceptance authority

This file is a **coverage register, not a release approval**. The scenarios are business requirements across the entire IPS company. Their default status is NOT_INDIVIDUALLY_ADMITTED until source-bound positive and negative tests, genuine external provider witnesses when required, and owner inspection are attached. Payment scenarios remain PAYMENT_DEFERRED. An earlier green aggregate suite never makes all rows green. Prepayment workflows may use fictional isolated settlement, clearly labeled; never misstate collected money.

## How to close a scenario
Record the scenario ID, immutable source SHA, exact test result, environment, user role, case state, authorized/forbidden behavior, screenshots or actual file/DB checksums where appropriate, external-provider receipt when required, and the reviewer/date. Only then change its status. Reopen a passing scenario if later design changes invalidate its evidence.

The machine-readable coverage below is intentionally conservative. It enumerates **all 409 scenarios** in the owner’s 22 November operating register, and prevents blanket claims that thousands of edge states passed because one automated browser test was green.

## Audit boundaries
- **Synthetic free review**: fictional users and documents; workflows are inspectable but no external provider or real payment proof.
- **Production-provider staging**: true Resend/Telegram/ClamAV witnesses and negative states; separate data and separate Telegram bot.
- **Production**: source-bound release acceptance, genuine backup/restore, actual role journeys and owner approval.
- **Payment final phase**: real charging, refunds, payouts, accounting and tax proof only after explicit authorization.

See the sibling CSV for individual case IDs, acceptance class, owner and honest status.