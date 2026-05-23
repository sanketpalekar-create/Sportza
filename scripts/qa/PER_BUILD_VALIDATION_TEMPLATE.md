# Per-Build Mobile Validation Checklist

Use this template for every QA build and release candidate.

## Build Metadata
- Build ID:
- Date:
- Tester:
- Branch/commit:
- Backend environment:
- Release type (QA/RC/Prod):

## Platform Matrix
| Platform | Device | OS Version | Install/Launch | Notes |
| --- | --- | --- | --- | --- |
| Android |  |  | Pass/Fail |  |
| Android |  |  | Pass/Fail |  |
| iOS |  |  | Pass/Fail |  |
| iOS |  |  | Pass/Fail |  |

## Critical Path Validation
Mark each item Pass/Fail/Blocked with defect ID if failed.

### Authentication
- [ ] New user sign-up and verification
- [ ] Existing user login/logout
- [ ] Session restore after app restart
- [ ] Password reset flow

### Payments
- [ ] Add/update payment method
- [ ] Successful payment transaction
- [ ] Failed payment error handling
- [ ] Transaction status reflected in UI

### Push Notifications
- [ ] Permission prompt behavior
- [ ] Token registration succeeds
- [ ] Foreground push received and handled
- [ ] Background push opens correct destination

## Stability and Performance Checks
- [ ] No launch crash on Android test devices
- [ ] No launch crash on iOS test devices
- [ ] App start time within acceptable threshold
- [ ] No severe UI hangs/ANR/watchdog termination observed

## Metrics Snapshot (Before/After Build)
- Crash-free sessions:
- Login success rate:
- Payment success rate:
- Push delivery success rate:
- API error rate (auth/payment/push):
- p95 latency for critical endpoints:

## Defects Logged
| Defect ID | Severity | Area | Platform | Status | Owner |
| --- | --- | --- | --- | --- | --- |
|  |  |  |  |  |  |

## Release Recommendation
- [ ] Go
- [ ] No-Go
- [ ] Go with accepted risk

Risk notes:

## Rollback Readiness Checklist
- [ ] Last stable mobile version identified
- [ ] Rollback owner assigned
- [ ] Rollback steps verified in `RELEASE_RUNBOOK_MOBILE.md`
- [ ] Feature flags and kill switches reviewed
- [ ] Stakeholder communication draft prepared
