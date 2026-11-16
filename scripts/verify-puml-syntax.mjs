import fs from 'fs';
import path from 'path';

const pumlDir = path.resolve('specs/diagrams/puml');

const expectedFiles = [
  'aws-theme.puml',
  'D1-master-infrastructure.puml',
  'D2-auth-sequence.puml',
  'D3-erd-data-model.puml',
  'D4-concurrency-timeline.puml',
  'D5-csv-integrity-pipeline.puml',
  'D6-trust-boundaries.puml',
  'D7-telemetry-multiplexing.puml',
  'D8-delivery-pipeline.puml',
  'D9-availability-heartbeat.puml',
  'README.md'
];

console.log('--- Verifying PlantUML Files in specs/diagrams/puml ---');

let hasError = false;

for (const file of expectedFiles) {
  const filePath = path.join(pumlDir, file);
  let content;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch {
    console.error(`[FAIL] Missing or unreadable expected file: ${file}`);
    hasError = true;
    continue;
  }

  const byteSize = Buffer.byteLength(content, 'utf8');
  if (byteSize === 0) {
    console.error(`[FAIL] File is empty: ${file}`);
    hasError = true;
    continue;
  }

  if (file.endsWith('.puml') && file !== 'aws-theme.puml') {
    const startCount = (content.match(/@startuml/g) || []).length;
    const endCount = (content.match(/@enduml/g) || []).length;

    if (startCount !== 1 || endCount !== 1) {
      console.error(`[FAIL] ${file} invalid @startuml/@enduml block (starts: ${startCount}, ends: ${endCount})`);
      hasError = true;
      continue;
    }

    if (!content.includes('!include aws-theme.puml')) {
      console.error(`[FAIL] ${file} is missing '!include aws-theme.puml'`);
      hasError = true;
      continue;
    }

    console.log(`[PASS] ${file} (${byteSize} bytes) - Valid PUML structure & AWS theme inclusion.`);
  } else {
    console.log(`[PASS] ${file} (${byteSize} bytes)`);
  }
}

if (hasError) {
  console.error('\nVerification FAILED with errors.');
  process.exit(1);
} else {
  console.log('\nAll 9 PUML diagrams + Theme + README passed verification successfully!');
}
