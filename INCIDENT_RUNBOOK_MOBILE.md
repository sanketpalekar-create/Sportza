# Mobile Incident Runbook

## Purpose
This runbook defines how to detect, triage, mitigate, and recover from mobile production incidents during migration.

## Incident Severity
- SEV-1: Widespread outage or critical path broken (auth/payment/app launch).
- SEV-2: Major degradation with partial workaround.
- SEV-3: Limited impact, non-critical degradation.

## Trigger Conditions
- Crash spike above alert threshold.
- Login or payment success rate falls below acceptable baseline.
- Push notifications fail at significant rate.
- Store release introduces severe regression.

## First 15 Minutes (Stabilization)
1. Assign Incident Commander (IC).
2. Open incident channel and incident ticket.
3. Confirm severity and affected platforms (Android/iOS/both).
4. Freeze active releases and promotions.
5. Capture current metrics snapshot and timeline.

## Triage Checklist
- Determine affected area:
  - Authentication
  - Payments
  - Push
  - Startup/navigation
- Determine blast radius:
  - Platform-specific or global
  - Regional or provider-specific
  - Version-specific
- Validate recent changes:
  - App release version
  - Feature flag changes
  - Backend deploys
  - Third-party provider status

## Mitigation Actions
Apply lowest-risk actions first:
- Disable related feature flags.
- Pause rollout or stop new installs if possible.
- Route traffic to known-good backend path (if available).
- Roll back to last stable app version/track when required.
- Provide temporary user-facing guidance if impact is visible.

## Rollback Decision Checklist
- Is a P0/P1 critical path broken?
- Is metric degradation sustained > 15 minutes?
- Is there no safe hotfix within SLA?
- Is last stable version available and verified?

If yes to the above, execute rollback immediately via `RELEASE_RUNBOOK_MOBILE.md`.

## Recovery Verification
After mitigation/rollback:
- Re-check critical flows on Android and iOS:
  - Login and session restore
  - Payment success path
  - Push receipt and deep-link
- Verify key metrics trend back to baseline:
  - Crash-free sessions
  - Login success rate
  - Payment success rate
  - Push delivery success rate
  - API error rate/latency

## Communication Cadence
- Every 15 minutes during active SEV-1/SEV-2:
  - Current impact
  - Actions taken
  - Next decision time
- Stakeholders:
  - Engineering, QA, support, product, release owner.

## Post-Incident Review (within 48 hours)
- Timeline with key events and decisions.
- Root cause and contributing factors.
- Detection and response gaps.
- Preventive actions with owners and due dates.
- Runbook updates required.

## Incident Record Template
- Incident ID:
- Severity:
- Start time / End time:
- Affected platform(s):
- Affected feature(s):
- Customer impact summary:
- Trigger metric(s):
- Mitigation steps:
- Rollback performed (yes/no):
- Root cause:
- Follow-up actions:
