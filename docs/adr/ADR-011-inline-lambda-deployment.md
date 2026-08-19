# ADR-011: Keep CloudFormation Inline Lambda Handlers for the Current Deployment Model

**Status:** Accepted for the current repository; migration candidate for a future release.

## Decision

CloudDrop currently deploys Lambda handlers inline through CloudFormation while also keeping standalone source under `backend/functions/` for development and inspection.

## Reason

The existing stack and deployment workflow already use inline `ZipFile` handlers. Replacing that model with a full artifact/S3 packaging pipeline would increase deployment complexity and change the infrastructure delivery model without being necessary to preserve the product's core behavior.

## Consequence

There are two representations of backend code today. This is an explicit maintenance constraint, not an accidental architecture claim. Changes to a deployed Lambda must be reflected in both representations until a deliberate packaging migration is completed.

A future migration should make `backend/functions/` the single source of truth, package functions reproducibly in CI, and remove inline handler duplication without changing runtime behavior.
