# Security Policy

OmniServices takes the security of our software products and services seriously. This document outlines our security policy, supported versions, and the process for reporting vulnerabilities responsibly.

---

## Supported Versions

Only the latest active development and release branches receive security updates.

| Branch / Version | Supported |
| ---------------- | --------- |
| `main`           | Yes       |
| `staging`        | Yes       |
| Older releases   | No        |

If you are using an older version, please upgrade to the latest release before reporting a vulnerability.

---

## Reporting a Vulnerability

We strongly encourage responsible disclosure. **Please do not report security vulnerabilities via public GitHub issues, discussions, or pull requests.**

### How to Submit a Vulnerability Report

1. **GitHub Private Vulnerability Reporting (Preferred)**:
   - Navigate to the **Security** tab of the OmniServices repository on GitHub.
   - Click on **Advisories** under the "Reporting" section.
   - Click **Report a vulnerability** to open a confidential report directly with our security maintainers.

2. **Email Disclosure**:
   - If GitHub Advisory is unavailable, send an email to: `security@omniservices.dev` (or the project maintainers).
   - Please use a clear and descriptive subject line, for example: `[Vulnerability Report] Authentication bypass in apps/auth`.

---

## Information to Include

To help us triage and resolve the issue quickly, please provide the following details:

- **Type of Issue**: (e.g., authentication bypass, SQL injection, remote code execution, sensitive data exposure)
- **Affected Component**: Specific service, endpoint, or package (e.g., `apps/gateway`, `apps/auth`, `libs/common`)
- **Step-by-step Reproduction**: Detailed steps, requests, payloads, or proof-of-concept scripts to reproduce the issue
- **Impact Assessment**: Explanation of how an attacker could exploit this vulnerability and the potential impact
- **Proposed Fix**: Any suggested mitigations or patches (optional)

---

## Response Process & SLA

When a security vulnerability is reported, our team follows this process:

1. **Acknowledgment**: We aim to acknowledge receipt of the report within 48 hours.
2. **Investigation & Triage**: We will confirm the vulnerability, determine its severity (CVSS score), and assess affected components.
3. **Remediation**: A fix will be developed and tested in a private repository or private branch.
4. **Disclosure & Release**: We will release a patch and publish a security advisory giving appropriate credit to the reporter (unless you prefer to remain anonymous).

---

## Safe Harbor & Responsible Disclosure

We consider security research conducted under the following terms to be authorized:

- Make a good faith effort to avoid privacy violations, destruction of data, and interruption or degradation of services.
- Only interact with accounts you own or with explicit permission of the account owner.
- Give us reasonable time to resolve the issue before disclosing it publicly.
