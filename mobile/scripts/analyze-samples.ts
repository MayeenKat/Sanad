import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { aggregate, analyzeDocument } from "../src/lib/analysis/engine";

async function main() {
  const root = process.argv[2] ?? join(__dirname, "..", "..", "samples");
  let failures = 0;
  for (const group of ["real", "fake"] as const) {
    for (const name of readdirSync(join(root, group)).sort()) {
      const data = new Uint8Array(readFileSync(join(root, group, name)));
      const report = await analyzeDocument(data, name, null);
      const result = aggregate([report]);
      const expected = group === "real" ? "authentic" : "fraud";
      const ok = result.verdict === expected;
      if (!ok) failures++;
      console.log(
        `${ok ? "ok  " : "FAIL"} ${group}/${name.padEnd(32)} ${result.verdict.padEnd(9)} ${String(result.risk_score).padStart(3)}  ${result.findings.map((f) => f.code).join(",")}`,
      );
      if (
        result.business.licence_numbers.length ||
        result.business.tax_registration_numbers.length ||
        result.business.trade_name
      ) {
        console.log(`     business: ${JSON.stringify(result.business)}`);
      }
    }
  }
  process.exit(failures ? 1 : 0);
}

void main();
