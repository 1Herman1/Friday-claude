import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(dir, "..", "data");

interface CatalogModel {
  id: string;
  meta: {
    promptField?: string;
    imageField?: string;
    required?: string[];
  };
  price?: {
    creditsMin: number;
    creditsMax: number;
  };
}

function auditCatalog() {
  console.log("Auditing catalog...");

  const modelsPath = path.join(dataDir, "models.json");
  const pricesPath = path.join(dataDir, "prices.json");

  if (!fs.existsSync(modelsPath)) {
    console.error("models.json not found");
    process.exit(1);
  }

  const models: CatalogModel[] = JSON.parse(fs.readFileSync(modelsPath, "utf-8")).models || [];

  let issues = 0;

  // Check each model
  for (const model of models) {
    const problems = [];

    // Check required field
    if (!model.meta?.required || model.meta.required.length === 0) {
      problems.push("No required fields defined");
    }

    // Check promptField for image/video
    if (model.meta?.promptField === undefined) {
      problems.push("Missing promptField");
    }

    // Check price
    if (!model.price) {
      problems.push("Missing price");
    }

    if (problems.length > 0) {
      console.log(`❌ ${model.id}:`);
      for (const p of problems) console.log(`   - ${p}`);
      issues++;
    }
  }

  console.log(`\nTotal models: ${models.length}`);
  console.log(`With issues: ${issues}`);

  // Stats
  const withPrompt = models.filter((m) => m.meta?.promptField).length;
  const withPrice = models.filter((m) => m.price).length;

  console.log(`With promptField: ${withPrompt}/${models.length} (${Math.round((withPrompt / models.length) * 100)}%)`);
  console.log(`With price: ${withPrice}/${models.length} (${Math.round((withPrice / models.length) * 100)}%)`);

  if (issues > 0) {
    process.exit(1);
  }
}

auditCatalog();
