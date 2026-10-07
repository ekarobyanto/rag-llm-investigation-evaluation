import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const actions = new Set(['INTERROGATE', 'EXAMINE_EVIDENCE', 'REVIEW_TIMELINE', 'SUBMIT_DEDUCTION', 'INVESTIGATE_LOCATION']);

/** Offline structural checks. Semantic support still requires evidence review. */
export function validateScenarios(scenarios, caseFile) {
  const cases = caseFile.case ? [caseFile] : Object.values(caseFile);
  const prompts = new Set();
  assert(Array.isArray(scenarios) && scenarios.length > 0, 'Expected a nonempty scenario array');
  for (const [position, scenario] of scenarios.entries()) {
    const tag = `Q${String(position + 1).padStart(2, '0')}`;
    const matches = cases.filter(c => c.case?.title === scenario.caseTitle);
    assert.equal(matches.length, 1, `${tag}: case title must resolve uniquely`);
    const source = matches[0];
    for (const field of ['prompt', 'referenceAnswer', 'notes']) {
      assert(typeof scenario[field] === 'string' && scenario[field].trim(), `${tag}: missing ${field}`);
    }
    const promptKey = `${scenario.caseTitle}:${scenario.prompt.trim()}`;
    assert(!prompts.has(promptKey), `${tag}: duplicate prompt`);
    prompts.add(promptKey);
    assert(['easy', 'medium', 'hard'].includes(scenario.difficulty), `${tag}: invalid difficulty`);
    const ids = scenario.requiredEvidenceIndices;
    assert(Array.isArray(ids) && ids.length > 0, `${tag}: no evidence labels`);
    assert.equal(new Set(ids).size, ids.length, `${tag}: duplicate evidence index`);
    for (const id of ids) {
      assert(Number.isInteger(id) && id >= 0 && id < source.evidence.length, `${tag}: invalid evidence index ${id}`);
    }
    assert(Array.isArray(scenario.expectedContradictions), `${tag}: missing contradiction array`);
    for (const pair of scenario.expectedContradictions) {
      const a = pair.evidence_index_a;
      const b = pair.evidence_index_b;
      assert(a !== b && ids.includes(a) && ids.includes(b), `${tag}: contradiction endpoints must be distinct labelled evidence`);
    }
    assert(Array.isArray(scenario.expectedActions) && scenario.expectedActions.length > 0, `${tag}: no actions`);
    for (const action of scenario.expectedActions) {
      assert(actions.has(action.action_type), `${tag}: invalid action ${action.action_type}`);
      assert(source.suspects.some(s => s.name === action.target), `${tag}: unknown target ${action.target}`);
    }
  }
  return scenarios.length;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const scenarios = JSON.parse(readFileSync(resolve('eval-scenarios/scenarios.json'), 'utf8'));
  const caseFile = JSON.parse(readFileSync(resolve('cases-input/case-1.json'), 'utf8'));
  console.log(`Validated ${validateScenarios(scenarios, caseFile)} scenarios (offline; no database or model calls).`);
}
