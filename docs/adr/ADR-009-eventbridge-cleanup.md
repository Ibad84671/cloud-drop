# ADR-009: Prefer Native Lifecycle Cleanup

**Status:** Accepted

## Decision

CloudDrop does **not** require an EventBridge cleanup Lambda for the normal transfer lifecycle. DynamoDB TTL handles metadata expiration and S3 Lifecycle rules handle physical object expiration.

## Reason

The application already has explicit transfer expiry checks. Adding a scheduled cleanup function would introduce another moving part and additional invocation/maintenance cost without materially improving the core product for the current scale.

## Consequence

Cleanup is eventually consistent by design. Expired transfers are rejected by the application before background cleanup necessarily finishes. S3 Lifecycle and DynamoDB TTL perform the eventual physical/metadata cleanup without an always-running scheduler.
