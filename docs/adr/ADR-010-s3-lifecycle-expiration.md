# ADR-010: S3 Lifecycle Expiration

**Status:** Accepted

## Decision

Use native S3 Lifecycle rules to expire transfer objects after 30 days, with non-current versions retained only briefly.

## Reason

CloudDrop's application transfer lifetime is shorter (seven days), but S3 cleanup is intentionally eventual. A 30-day lifecycle rule provides a simple, low-maintenance safety net for objects that outlive their metadata or are orphaned by an interrupted transfer.

## Consequence

Application-level expiry is the security boundary: expired transfers are rejected immediately by Lambda. S3 Lifecycle is the storage cleanup mechanism, not the mechanism that grants or revokes download access.
