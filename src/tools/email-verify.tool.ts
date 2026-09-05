import { tool } from "ai";
import { z } from "zod";
import { resolve4, resolveMx } from "node:dns/promises";
import { connect } from "node:net";

const EMAIL_RE =
  /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;

type ProbeResult = {
  rcptCode: number | null;
  rcptMsg: string;
  error: string;
};

function syntaxOk(email: string): { valid: boolean; reason: string } {
  if (!email.includes("@")) return { valid: false, reason: "missing @" };
  const domain = email.split("@")[1];
  if (!domain) return { valid: false, reason: "empty domain" };
  if (!EMAIL_RE.test(email)) {
    return { valid: false, reason: "does not match a plausible address format" };
  }
  return { valid: true, reason: "ok" };
}

async function resolveMailHost(domain: string): Promise<{
  exists: boolean;
  mx: Array<{ priority: number; exchange: string }>;
  implicit: boolean;
}> {
  try {
    const mx = await resolveMx(domain);
    if (mx.length > 0) {
      return { exists: true, mx, implicit: false };
    }
  } catch {
    // NXDOMAIN / no MX
  }
  // No MX: fall back to an A record as the implicit mail exchanger (RFC 5321).
  try {
    await resolve4(domain);
    return { exists: true, mx: [], implicit: true };
  } catch {
    return { exists: false, mx: [], implicit: false };
  }
}

function smtpProbe(
  host: string,
  port: number,
  sender: string,
  recipient: string,
  timeout: number,
): Promise<ProbeResult> {
  return new Promise((resolve) => {
    const result: ProbeResult = { rcptCode: null, rcptMsg: "", error: "" };
    const socket = connect({ host, port });

    let buffer = "";
    let stage: "greet" | "ehlo" | "mail" | "rcpt" = "greet";
    const lines: string[] = [];

    const finish = (rcptCode: number | null, rcptMsg: string, error: string) => {
      result.rcptCode = rcptCode;
      result.rcptMsg = rcptMsg;
      result.error = error;
      socket.destroy();
      resolve(result);
    };

    const send = (cmd: string) => {
      socket.write(`${cmd}\r\n`);
    };

    const onResponse = (multiline: string[]) => {
      const first = multiline[0] ?? "";
      const code = parseInt(first.slice(0, 3), 10);
      const text = multiline.map((l) => l.slice(4)).join(" ");
      switch (stage) {
        case "greet":
          if (code >= 400) return finish(null, "", `greeting failed (${code})`);
          stage = "ehlo";
          send("EHLO verify.local");
          break;
        case "ehlo":
          if (code >= 400) {
            // Fall back to HELO.
            send("HELO verify.local");
          } else {
            stage = "mail";
            send(`MAIL FROM:<${sender}>`);
          }
          break;
        case "mail":
          if (code >= 400) {
            return finish(null, "", `MAIL FROM rejected (${code})`);
          }
          stage = "rcpt";
          send(`RCPT TO:<${recipient}>`);
          break;
        case "rcpt":
          finish(code, text, "");
          break;
      }
    };

    const onData = (chunk: Buffer) => {
      buffer += chunk.toString("utf-8");
      let idx;
      while ((idx = buffer.indexOf("\r\n")) !== -1) {
        const line = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        lines.push(line);
        // SMTP multi-line replies use "-" as the 4th char; terminal line uses " ".
        if (line.length >= 4 && line[3] === " ") {
          onResponse(lines.splice(0));
        } else if (line.startsWith("4") || line.startsWith("5")) {
          if (lines.length > 1) onResponse(lines.splice(0));
        }
      }
    };

    socket.setTimeout(timeout * 1000);
    socket.on("data", onData);
    socket.on("timeout", () => finish(null, "", "timed out"));
    socket.on("error", (err) => finish(null, "", err.message));
    socket.on("close", () => {
      if (result.rcptCode === null && !result.error) {
        finish(null, "", "connection closed");
      }
    });
  });
}

export const emailVerifyTool = tool({
  description:
    "Check whether an email address is deliverable. Runs a syntax check, a DNS/MX lookup, a catch-all probe, and an SMTP recipient check (EHLO / MAIL FROM / RCPT TO). Returns a plain-English verdict: deliverable, not_deliverable, catch_all, reject, invalid, or inconclusive.",
  inputSchema: z.object({
    email: z.string().describe("The email address to verify"),
    port: z.number().int().min(1).max(65535).default(25).describe("SMTP port (default 25)"),
    timeout: z.number().min(1).default(10).describe("Per-stage timeout in seconds"),
    sender: z.string().optional().describe("Envelope MAIL FROM (default postmaster@domain)"),
  }),
  execute: async ({ email, port, timeout, sender }) => {
    const syntax = syntaxOk(email);
    if (!syntax.valid) {
      return {
        email,
        verdict: "invalid",
        summary: `Syntax check failed: ${syntax.reason}. Not a valid address, so it cannot be deliverable.`,
      };
    }

    const domain = email.split("@")[1]!;
    const dns = await resolveMailHost(domain);

    if (!dns.exists) {
      return {
        email,
        domain,
        verdict: "reject",
        summary: `'${domain}' has no DNS mail routing (no MX record and no A record), so mail to this address cannot be delivered.`,
      };
    }
    if (!dns.mx.length && !dns.implicit) {
      return {
        email,
        domain,
        verdict: "reject",
        summary: `'${domain}' exists but publishes no mail server, so mail to this address cannot be delivered.`,
      };
    }

    const host = dns.mx.length ? dns.mx[0]!.exchange : domain;
    const from = sender ?? `postmaster@${domain}`;

    // Catch-all detection: probe a random address first.
    const randomAddr = `random-${Math.floor(Math.random() * 900000) + 100000}x@${domain}`;
    const randomProbe = await smtpProbe(host, port, from, randomAddr, timeout);
    const catchAll = randomProbe.rcptCode === 250;

    const probe = await smtpProbe(host, port, from, email, timeout);

    if (probe.error && probe.rcptCode === null) {
      return {
        email,
        domain,
        verdict: "inconclusive",
        summary: `Could not reach the mail server for '${domain}' on port ${port} (${probe.error}). This usually means the port is blocked or the server does not answer; deliverability is unknown.`,
      };
    }

    const code = probe.rcptCode;
    const message = probe.rcptMsg;
    let verdict: string;
    let summary: string;

    if (code === null) {
      verdict = "inconclusive";
      summary = "no RCPT TO response; mail server did not answer.";
    } else if (catchAll) {
      verdict = "catch_all";
      summary =
        "domain accepts arbitrary addresses (catch-all), so SMTP acceptance of this specific address does not confirm the mailbox exists.";
    } else if (code === 250) {
      verdict = "deliverable";
      summary = "recipient accepted (250).";
    } else if (code === 251 || code === 252) {
      verdict = "inconclusive";
      summary = `server cannot confirm the user (${code}); not proof of existence.`;
    } else if (code === 450 || code === 451 || code === 421) {
      verdict = "inconclusive";
      summary = `temporary failure (${code}); likely greylisting or a temporary outage, try again later.`;
    } else if (code >= 500) {
      const senderRejection = /policy|dynamic ip|residential ip|spamhaus|blacklist|rejected by|not accept|from ip|sender/i.test(
        message,
      );
      if (senderRejection || randomProbe.rcptCode === code) {
        verdict = "inconclusive";
        summary = `rejected (${code}) for a sender/IP reason: ${message}. This rejects the connection, not the address, so deliverability is unknown.`;
      } else {
        verdict = "not_deliverable";
        summary = `recipient rejected (${code}): ${message}.`;
      }
    } else {
      verdict = "inconclusive";
      summary = `unexpected response (${code}): ${message}.`;
    }

    return {
      email,
      domain,
      verdict,
      summary,
      catchAll,
      mx: dns.mx,
    };
  },
});
