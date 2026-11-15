import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const baseDir = path.dirname(fileURLToPath(import.meta.url));
const modelDir = path.join(baseDir, "modelo-web");
const model = JSON.parse(fs.readFileSync(path.join(modelDir, "model.json"), "utf8"));
const labels = JSON.parse(fs.readFileSync(path.join(baseDir, "model-labels.json"), "utf8"));
const weightSpecs = [];
const weightParts = [];

for (const group of model.weightsManifest) {
  weightSpecs.push(...group.weights);
  for (const relativePath of group.paths) {
    weightParts.push(fs.readFileSync(path.join(modelDir, relativePath)));
  }
}

const bundle = {
  format: model.format,
  generatedBy: model.generatedBy,
  convertedBy: model.convertedBy,
  modelTopology: model.modelTopology,
  signature: model.signature,
  modelInitializer: model.modelInitializer,
  weightSpecs,
  weightDataBase64: Buffer.concat(weightParts).toString("base64"),
  labels: labels.classes,
};

const output = `globalThis.POTATO_MODEL_BUNDLE=${JSON.stringify(bundle)};\n`;
fs.writeFileSync(path.join(modelDir, "model-embedded.js"), output, "utf8");
console.log(`Modelo integrado generado: ${(Buffer.byteLength(output) / 1024 / 1024).toFixed(2)} MB`);
