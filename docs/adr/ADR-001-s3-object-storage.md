# ADR-001: Why S3 for Object Storage

**Context**: Need durable, scalable, and cost-effective storage for uploaded files.

**Decision**: Use Amazon S3.

**Alternatives**: EFS, EBS, on-premise.

**Trade-offs**: S3 is serverless, pay-per-use, integrates with presigned URLs. EFS requires EC2 and VPC.

**Consequences**: Storage cost is $0.023/GB-month; free tier covers 5GB.