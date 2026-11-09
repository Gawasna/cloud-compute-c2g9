import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { inspectRequestWaf } from "../../src/lib/security/waf.ts";

describe("Security: Edge Web Application Firewall (WAF) & Virtual Patching", () => {
  it("allows standard legitimate web traffic", () => {
    const legitimateRequests = [
      {
        url: "https://cloudstock.example.com/api/products?page=1&limit=10&search=Laptop",
        headers: { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
      },
      {
        url: "https://cloudstock.example.com/api/categories",
        headers: { "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)" },
      },
      {
        url: "https://cloudstock.example.com/api/reports/export?from=2026-01-01&to=2026-11-01",
        headers: { "user-agent": "CloudStock-Client/1.0" },
      },
      {
        url: "https://cloudstock.example.com/api/auth/login",
        headers: { "user-agent": "Mozilla/5.0" },
      },
      {
        url: "https://cloudstock.example.com/api/health",
        headers: { "user-agent": "Uptime-Kuma/2.0" },
      },
    ];

    for (const req of legitimateRequests) {
      const res = inspectRequestWaf(req);
      assert.equal(res.allowed, true, `Failed on url: ${req.url}`);
    }
  });

  it("blocks path traversal and LFI probes", () => {
    const malicious = [
      "https://example.com/api/products?file=../../etc/passwd",
      "https://example.com/api/products?doc=..\\..\\windows\\win.ini",
      "https://example.com/api/products/%2e%2e/%2e%2e/etc/shadow",
      "https://example.com/api/products?p=%252e%252e/secrets",
    ];

    for (const url of malicious) {
      const res = inspectRequestWaf({ url, headers: {} });
      assert.equal(res.allowed, false, `Should block: ${url}`);
      assert.equal(res.rule, "PATH_TRAVERSAL");
    }
  });

  it("blocks null byte injection", () => {
    const res = inspectRequestWaf({
      url: "https://example.com/api/products?file=document.pdf%00.exe",
      headers: {},
    });
    assert.equal(res.allowed, false);
    assert.equal(res.rule, "NULL_BYTE");
  });

  it("blocks automated vulnerability scanner User-Agents", () => {
    const scanners = [
      "sqlmap/1.7#stable",
      "Nikto/2.1.6",
      "Acunetix-Web-Vulnerability-Scanner",
      "nmap-scripting-engine",
      "masscan/1.3.2",
      "WPScan v3.8.22",
      "dirbuster/1.0",
      "gobuster 3.1.0",
      "Mozilla/5.0 (compatible; Nessus SOAP)",
    ];

    for (const ua of scanners) {
      const res = inspectRequestWaf({
        url: "https://example.com/api/products",
        headers: { "user-agent": ua },
      });
      assert.equal(res.allowed, false, `Should block scanner UA: ${ua}`);
      assert.equal(res.rule, "SCANNER_USER_AGENT");
    }
  });

  it("blocks sensitive system resource probes", () => {
    const sensitive = [
      "https://example.com/.env",
      "https://example.com/.env.local",
      "https://example.com/.git/config",
      "https://example.com/wp-admin/index.php",
      "https://example.com/phpmyadmin/setup",
      "https://example.com/.aws/credentials",
    ];

    for (const url of sensitive) {
      const res = inspectRequestWaf({ url, headers: {} });
      assert.equal(res.allowed, false, `Should block sensitive path: ${url}`);
      assert.equal(res.rule, "SENSITIVE_PROBE");
    }
  });

  it("blocks common SQL injection signatures in query parameters", () => {
    const sqli = [
      "https://example.com/api/products?id=1%20UNION%20SELECT%20null,table_name%20FROM%20information_schema.tables",
      "https://example.com/api/products?id=1%20UNION%20ALL%20SELECT%20username,password%20FROM%20users",
      "https://example.com/api/products?search=%27%20OR%201=1--",
      "https://example.com/api/products?q=item%27%20OR%20%27a%27=%27a",
      "https://example.com/api/products?id=1;%20SELECT%20pg_sleep(5)",
    ];

    for (const url of sqli) {
      const res = inspectRequestWaf({ url, headers: {} });
      assert.equal(res.allowed, false, `Should block SQLi: ${url}`);
      assert.equal(res.rule, "SQL_INJECTION");
    }
  });

  it("blocks XSS and script injection patterns in query string", () => {
    const xss = [
      "https://example.com/api/products?q=%3Cscript%3Ealert(1)%3C/script%3E",
      "https://example.com/api/products?q=%3CSCRIPT%20SRC=http://evil.com/xss.js%3E%3C/SCRIPT%3E",
      "https://example.com/api/products?redirect=javascript:alert(document.cookie)",
      "https://example.com/api/products?img=%22%3E%3Cimg%20src=x%20onerror=alert(1)%3E",
      "https://example.com/api/products?calc=eval(atob('YWxlcnQoMSk='))",
    ];

    for (const url of xss) {
      const res = inspectRequestWaf({ url, headers: {} });
      assert.equal(res.allowed, false, `Should block XSS: ${url}`);
      assert.equal(res.rule, "XSS_INJECTION");
    }
  });

  it("proxy wires Edge WAF inspection and responds with 403 on attack", () => {
    const proxyPath = new URL("../../src/proxy.ts", import.meta.url);
    const proxyContent = readFileSync(proxyPath, "utf8");
    assert.ok(proxyContent.includes("inspectRequestWaf"), "proxy must import and call inspectRequestWaf");
    assert.ok(proxyContent.includes("X-WAF-Block"), "proxy must set X-WAF-Block response header");
    assert.ok(proxyContent.includes("403"), "proxy must reject attacks with 403 status");
  });
});
