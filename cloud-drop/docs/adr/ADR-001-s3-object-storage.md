# ADR-001: Why S3 is used for object storage

**Context**: Need to store uploaded files with high durability and availability.

**Decision**: Use Amazon S3.

**Alternatives**: EFS, EBS.

**Trade-offs**: S3 is serverless, pay-per-use, integrates with presigned URLs. EFS requires EC2 and VPC.

**Consequences**: Cost is $0.023/GB-month; free tier covers 5GB.
