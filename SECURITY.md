# Security Policy

## Supported versions

The latest version deployed from `main` is the supported version.

## Reporting a vulnerability

Please report security vulnerabilities privately through the repository's configured GitHub security contact or GitHub Security Advisories. Do not publish exploitable details in a public issue.

## Security architecture

CloudDrop uses private S3 buckets, presigned URLs, Cognito authentication for protected operations, least-privilege Lambda execution roles, API Gateway throttling, SQS-backed asynchronous processing, and CloudWatch logging.

The frontend bucket is accessed through CloudFront Origin Access Control. Upload objects are written directly to S3 using short-lived presigned URLs; Lambda does not proxy user file bytes.

## Operational notes

- Configure GitHub Actions with AWS OIDC rather than long-lived IAM user access keys.
- Keep the SES sender address verified and restricted to the intended AWS account/region.
- Review API Gateway, Lambda, S3, DynamoDB, and SES metrics for abuse or unexpected spend.
- Treat presigned URLs as bearer credentials and never log or publish them.
