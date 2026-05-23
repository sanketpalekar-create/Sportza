# Mobile Release Runbook

## Purpose
This runbook standardizes mobile releases during migration to reduce regressions and improve recovery speed.

## Release Cadence
- Recommended cadence: 2-3 releases per week.
- Freeze window: 24 hours before production promotion (only P0/P1 fixes allowed).
- Required participants:
  - Release manager
  - QA owner
  - Mobile engineer on duty
  - Backend representative (on-call)

## Pre-Release Checklist (T-24h to T-2h)
- Confirm changelog and feature flags are up to date.
- Confirm dependency/services health (auth, payments, push providers).
- Ensure `MOBILE_TEST_PLAN.md` critical matrix is complete for RC build.
- Validate no open P0 defects; review any P1 risk acceptance.
- Confirm rollback package/version is available and tested.
- Confirm on-call roster and communication channel are active.

## Go/No-Go Gate (T-30m)
- Mandatory checks:
  - Android and iOS smoke tests pass in staging.
  - Auth, payment, and push critical paths pass.
  - Crash-free sessions baseline from prior stable build is known.
  - Monitoring dashboards and alerts are active.
- Decision outcomes:
  - Go: proceed with phased rollout.
  - No-Go: stop, document reason, reschedule release.

## Rollout Plan
1. Publish build to store/internal channel.
2. Start phased rollout:
   - Stage 1: 5%
   - Stage 2: 25%
   - Stage 3: 50%
   - Stage 4: 100%
3. Hold 30-60 minutes between stages, based on error trend.
4. Do not proceed to next stage if alert thresholds are breached.

## Monitoring During Rollout
Check each stage before promotion:
- Crash-free sessions by platform.
- ANR rate (Android), critical termination signals (iOS).
- Login success/error rates.
- Payment success/failure/timeout rates.
- Push delivery and open-through rates.
- Backend auth/payment/push endpoint error rates and latency.

## Alert Threshold Examples (Tune As Needed)
- Crash-free sessions drop > 1.5% from baseline.
- Payment success rate drops > 2%.
- Login error rate increases > 2x baseline.
- Push delivery failure exceeds 5%.
- API p95 latency for critical endpoints exceeds agreed SLO.

## Rollback Checklist
Execute if thresholds breach or P0 incident is confirmed:
- Halt rollout immediately.
- Notify release channel and on-call.
- Revert to last known stable mobile version/track.
- Disable risky feature flags if available.
- Validate recovery with production smoke tests:
  - Login
  - Payment
  - Push open/deep link
- Confirm metrics recover toward baseline for at least 30 minutes.
- Publish incident note and customer impact summary.

## Post-Release Checklist (T+0 to T+24h)
- Perform production smoke test on Android and iOS.
- Monitor metrics every 15 minutes for 1 hour, hourly until 24 hours.
- Log issues, mitigations, and decisions in release ticket.
- Close release only when no active P0/P1 regression remains.

## Communication Template
- Release start: build number, scope, owner, stage.
- Stage updates: current %, health status, blockers.
- Rollback notice: trigger condition, actions taken, current impact.
- Release close: final status, key metrics, follow-ups.
