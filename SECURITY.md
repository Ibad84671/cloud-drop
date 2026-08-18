# Security Policy

## Supported Versions

We actively support the latest deployed version of CloudDrop. Security updates are applied automatically via IaC.

## Reporting a Vulnerability

If you discover a security vulnerability, please **do not** open a public issue.

Email: [your-email@example.com] (Replace with your actual email)

We will respond within 48 hours and work to resolve the issue.

## Security Best Practices

- The application uses **least-privilege IAM** policies.
- All S3 buckets are **private** and accessed via **CloudFront OAI**.
- File uploads use **presigned URLs** (valid for 15 minutes).
- User authentication is handled via **AWS Cognito** (not custom).