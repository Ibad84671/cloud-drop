# Security Policy

CloudDrop handles private file-transfer metadata and generates short-lived S3 presigned URLs. Security issues should be reported privately so they can be investigated before public disclosure.

## Supported Versions

| Version | Supported |
| --- | --- |
| `main` / latest deployed version | Yes |
| Older deployments | Best effort |

## Reporting a Vulnerability

Please do **not** open a public GitHub issue for a suspected security vulnerability.

Use GitHub's private security advisory/reporting flow for this repository when available. If private reporting is not enabled, contact the repository owner through their verified GitHub profile and include `CloudDrop security` in the subject.

Please include:

- affected component or route;
- reproducible steps or a minimal proof of concept;
- expected versus actual behavior;
- security impact;
- any relevant logs with secrets, tokens and presigned URLs removed.

Do not include AWS access keys, passwords, private keys, session tokens, or live presigned URLs in a report.

## Security Design

- S3 upload storage is intended to remain private with Block Public Access enabled.
- Browser uploads use short-lived presigned PUT URLs rather than AWS credentials.
- Downloads use short-lived presigned GET URLs.
- Authenticated management operations enforce ownership server-side.
- Transfer expiration is enforced by the application and backed by DynamoDB TTL/S3 lifecycle cleanup.
- Lambda functions should receive only the AWS permissions required by their operation.
- User-controlled filenames and email content are validated/sanitized before use.
- Internal exception details should never be returned to clients.

## Deployment Security

Production deployments should use GitHub Actions OIDC with a dedicated, least-privilege AWS deployment role. Long-lived AWS access keys should not be stored in GitHub Actions secrets.

After any suspected credential exposure, revoke/rotate the affected credential immediately and review CloudTrail activity.

## Scope

CloudDrop is a file-transfer application, not an antivirus or malware-scanning service. Uploading a file does not imply that its contents have been inspected for malware.
