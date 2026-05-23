# Feature Flag Catalog for Mobile Migration

## Purpose
Define mandatory migration feature flags, their rollout policy, and rollback actions to protect quality during web-to-mobile expansion.

## Flag Governance
- Every flag must have: owner, default state, rollout stages, monitoring metric, rollback trigger.
- Flags are environment-scoped (`dev`, `staging`, `prod`) and cohort-scoped (internal, closed-group, public).
- Flags controlling payment/auth are `critical` and require explicit release sign-off.
- Removing a flag requires documenting outcome and replacing with a permanent behavior decision.

## Status Values
- `Planned`: defined, not yet wired.
- `Active`: available and used in rollout.
- `Paused`: temporarily disabled due to risk.
- `Retired`: rollout complete and flag no longer needed.

## Catalog
| Flag Key | Domain | Status | Default | Scope | Rollout Strategy | Rollback Strategy | Owner | Dependencies | Primary KPI |
|---|---|---|---|---|---|---|---|---|---|
| `mobile.auth.native_session_v1` | Auth | Planned | Off | user cohort | Internal -> closed-group (10%, 30%, 60%, 100%) | Disable flag and force stable token/session flow | Auth + Mobile | `/api/auth`, secure storage adapter | login success rate, refresh failure rate |
| `mobile.auth.passwordless_magiclink_v1` | Auth | Planned | Off | user cohort | Closed-group only after baseline auth is stable | Revert to OTP/password entry paths | Auth | `/api/auth/send-magic-link`, deep-link router | magic-link completion rate |
| `mobile.payments.razorpay_native_checkout_v1` | Payments | Planned | Off | user cohort + platform | Internal test cards -> closed-group paid users -> staged expansion | Disable native checkout; route to web payment fallback | Payments | `/api/payments`, webhook verification | order->verify conversion, payment failure rate |
| `mobile.payments.wallet_checkout_v1` | Payments | Planned | Off | user cohort | Enable for high-confidence cohorts after reconciliation audits pass | Disable wallet checkout path; use existing booking payment flow | Payments + Backend | `/api/wallet`, `/api/bookings` | wallet payment success, reconciliation mismatch |
| `mobile.push.registration_v1` | Push | Planned | Off | device + user cohort | Internal devices -> closed-group opt-in users -> all users | Disable registration and halt new subscriptions | Growth + Platform | `/api/push-subscriptions`, permission prompts | push subscription success |
| `mobile.push.transactional_notifications_v1` | Push | Planned | Off | event type + cohort | Start with booking reminders only, then expand to payment/training/tournament events | Disable event sends by type and revert to in-app notifications | Growth + Backend | `/api/notifications`, notification preferences | delivery success, notification open rate |
| `mobile.maps.provider_google_v1` | Maps | Planned | Off | region + platform | Enable by region/device profile with fallback to plain list/location text | Disable maps rendering and keep location text + external map links | Mobile | map SDK key, `/api/places` | map load success, place selection completion |
| `mobile.maps.provider_mappls_v1` | Maps | Planned | Off | region + platform | Roll out to India-first cohorts where Mappls is preferred | Switch to Google provider or text fallback | Mobile | mappls SDK key, `/api/places` | map interaction latency, crash-free sessions |
| `mobile.deeplinks.navigation_router_v1` | Deeplinks | Planned | Off | app install cohort | Internal -> closed-group invite links -> public campaign links | Disable deep-link routing and open safe default screen | Mobile + Growth | deep-link parser, auth guard rules | deep-link open success, wrong-route rate |
| `mobile.deeplinks.magiclink_auth_v1` | Deeplinks/Auth | Planned | Off | auth flow cohort | Enable only after deep-link router and auth session metrics are green | Disable auth deep-links and require manual auth | Auth + Mobile | `mobile.deeplinks.navigation_router_v1` | auth completion via deep-link |

## Rollout Playbook (Required for Every Active Flag)
1. Validate staging with synthetic and real-device checks.
2. Enable for internal users and monitor for one full business cycle.
3. Expand to closed-group users in controlled percentages.
4. Promote only if KPI and error thresholds stay within acceptance limits.
5. Record decisions in release log and update this catalog status.

## Rollback Playbook (Required for Every Critical Flag)
1. Trigger when rollback condition is met (KPI breach, P1 defect, integrity risk).
2. Disable the flag in production for affected cohorts first.
3. Confirm fallback behavior is functional (auth, payment, navigation, notifications).
4. Announce incident, owner, and ETA for mitigation.
5. Run post-incident review and capture required contract/document updates.

## Monitoring and Alert Threshold Guidance
- Auth flags: alert on sudden increase in refresh failures or forced re-login events.
- Payment flags: alert on order creation errors, verification failures, and drop in successful completions.
- Push flags: alert on subscription failures and abnormal unsubscribe spikes.
- Maps/deeplink flags: alert on route resolution failures, app startup crashes from malformed intents, and elevated abandonment.
