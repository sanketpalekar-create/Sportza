# Mobile Migration Test Plan

## Purpose
This plan defines the minimum QA coverage required for each mobile build during migration. It prioritizes critical user journeys and release reliability over broad exploratory testing.

## Scope
- Platforms: Android and iOS.
- Build types: Internal QA build, release candidate (RC), production build.
- Critical domains: Authentication, payments, and push notifications.

## Roles and Responsibilities
- QA owner: Executes the checklist, logs defects, and signs off on build readiness.
- Mobile engineer on duty: Triages blockers and provides fix ETA.
- Release manager: Decides go/no-go based on severity and risk.
- Incident commander (if needed): Coordinates during live issues.

## Environments
- QA/Staging: Primary validation environment before RC.
- Production: Post-release smoke validation only.
- Test accounts:
  - New user account (never logged in)
  - Existing user account with payment method
  - Existing user account without payment method

## Entry Criteria
- Build is installable on both Android and iOS test devices.
- Release notes and known issues are documented.
- Backend dependencies used by the build are available and healthy.
- Crash reporting and analytics are enabled for the build channel.

## Exit Criteria
- All P0 and P1 defects are fixed or explicitly waived by release manager.
- Critical path tests pass on both platforms.
- No increase in crash-free session regression beyond threshold.
- Rollback package/version and owner are confirmed before release.

## Device Matrix (Minimum)
| Platform | OS Range | Device Tier | Network | Required |
| --- | --- | --- | --- | --- |
| Android | Latest - 2 major versions | Low, mid, high | Wi-Fi and cellular | Yes |
| iOS | Latest - 2 major versions | One older device, one current device | Wi-Fi and cellular | Yes |

## Core Test Matrix
| Area | Test Scenario | Android | iOS | Priority |
| --- | --- | --- | --- | --- |
| Auth | New user sign-up and verification flow | Required | Required | P0 |
| Auth | Existing user login/logout/session restore | Required | Required | P0 |
| Auth | Password reset and re-login | Required | Required | P1 |
| Payment | Add payment method | Required | Required | P0 |
| Payment | Successful transaction confirmation | Required | Required | P0 |
| Payment | Failed payment and recovery messaging | Required | Required | P1 |
| Push | Opt-in prompt and token registration | Required | Required | P0 |
| Push | Receive foreground push and deep link route | Required | Required | P1 |
| Push | Receive background push and open app target screen | Required | Required | P1 |

## Build Validation Checklist
For every build, execute the per-build template in `scripts/qa/PER_BUILD_VALIDATION_TEMPLATE.md`.

## Defect Severity Policy
- P0: Data loss, security issue, app crash on launch, payments blocked.
- P1: Critical path degraded with no workaround.
- P2: Non-critical function issue with workaround.
- P3: Cosmetic or low impact issue.

Release rule:
- Block release for any open P0.
- Open P1 requires explicit risk acceptance by release manager.

## Observability and Metrics to Monitor
Track during RC and first 24 hours after release:
- Crash-free sessions (%), split by Android/iOS.
- App start latency (p50 and p95).
- Login success rate and login error rate.
- Payment success rate, payment failure rate, and timeout rate.
- Push delivery success rate and open-through rate.
- API error rate for auth/payment/push endpoints.
- ANR rate (Android) and watchdog termination signals (iOS).

## Post-Release Verification
- 15-minute smoke check on production for Android and iOS:
  - Login works with test account.
  - One low-value payment test succeeds (if allowed in production policy).
  - Push notification received and opens expected destination.
- Monitor metrics every 15 minutes for first hour, then hourly for 24 hours.

## Reporting
- Store results in release ticket:
  - Build number, platform versions tested, pass/fail by area.
  - Defects filed with severity.
  - Final QA recommendation: Go / No-Go / Go with risk.
