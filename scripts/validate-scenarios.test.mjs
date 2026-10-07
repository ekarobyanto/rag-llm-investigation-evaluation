import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { validateScenarios } from './validate-scenarios.mjs';

const scenarios = JSON.parse(readFileSync(new URL('../eval-scenarios/scenarios.json', import.meta.url), 'utf8'));
const cases = JSON.parse(readFileSync(new URL('../cases-input/case-1.json', import.meta.url), 'utf8'));

test('all 30 scenarios resolve against the source corpus with the original difficulty distribution', () => {
  assert.equal(validateScenarios(scenarios, cases), 30);
  assert.equal(cases.nexus_data_breach.evidence.length, 150);
  for (const [difficulty, count] of [['easy', 10], ['medium', 12], ['hard', 8]]) {
    assert.equal(scenarios.filter(s => s.difficulty === difficulty).length, count);
  }
});

test('rejects bad labels before the importer can silently filter them out', () => {
  for (const index of [-1, 150, 1.5, '1']) {
    const broken = structuredClone(scenarios);
    broken[0].requiredEvidenceIndices.push(index);
    assert.throws(() => validateScenarios(broken, cases), /invalid evidence index/);
  }
  const duplicate = structuredClone(scenarios);
  duplicate[0].requiredEvidenceIndices.push(duplicate[0].requiredEvidenceIndices[0]);
  assert.throws(() => validateScenarios(duplicate, cases), /duplicate evidence index/);
});

test('rejects the old Q30 missing contradiction endpoint', () => {
  const broken = structuredClone(scenarios);
  broken[29].requiredEvidenceIndices = broken[29].requiredEvidenceIndices.filter(i => i !== 2);
  broken[29].expectedContradictions = [{ evidence_index_a: 2, evidence_index_b: 3 }];
  assert.throws(() => validateScenarios(broken, cases), /contradiction endpoints/);
});

test('rejects unsupported actions, targets, and empty reference answers', () => {
  const action = structuredClone(scenarios);
  action[0].expectedActions[0].action_type = 'ARREST';
  assert.throws(() => validateScenarios(action, cases), /invalid action/);
  const target = structuredClone(scenarios);
  target[0].expectedActions[0].target = 'Unknown suspect';
  assert.throws(() => validateScenarios(target, cases), /unknown target/);
  const answer = structuredClone(scenarios);
  answer[0].referenceAnswer = ' ';
  assert.throws(() => validateScenarios(answer, cases), /missing referenceAnswer/);
});

test('regressions: supplementary answer claims have their supporting evidence', () => {
  for (const [question, indices] of [[8, [122]], [9, [19]], [10, [6, 15]], [12, [0, 39]], [19, [65, 66]], [26, [0, 17]], [27, [2]], [30, [2, 5, 8, 16]]]) {
    for (const index of indices) assert(scenarios[question - 1].requiredEvidenceIndices.includes(index), `Q${question}: missing ${index}`);
  }
});

test('regressions: reference facts agree with the source chronology and expose the quantity conflict', () => {
  assert.match(cases.nexus_data_breach.evidence[3].content, /05:35/);
  for (const s of scenarios) assert(!s.referenceAnswer.includes('05:30'), 'Incorrect occupancy end time');
  assert.match(scenarios[18].referenceAnswer, /bar visit ended before the breach window/);
  assert.match(scenarios[21].referenceAnswer, /142 Mbps/);
  assert.match(scenarios[21].referenceAnswer, /160 GB/);
  assert.match(scenarios[21].referenceAnswer, /2.3 TB/);
  assert.match(scenarios[21].referenceAnswer, /conflict/);
  // Uncertainty in the reference must not require submitting a definitive accusation.
  for (const question of [24, 27, 29, 30]) {
    assert(!scenarios[question - 1].expectedActions.some(a => a.action_type === 'SUBMIT_DEDUCTION'));
  }
});
