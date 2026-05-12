import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const transport = new StdioClientTransport({
  command: process.execPath,
  args: ['dist/index.js'],
});

const client = new Client(
  {
    name: 'ultrabrain-smoke',
    version: '0.0.0',
  },
  {
    capabilities: {},
  },
);

await client.connect(transport);

try {
  const listed = await client.listTools();
  const names = listed.tools.map((tool) => tool.name);
  for (const expected of [
    'ultrabrain_start',
    'ultrabrain_think',
    'ultrabrain_update',
    'ultrabrain_branch',
    'ultrabrain_merge',
    'ultrabrain_validate',
    'ultrabrain_analyze',
    'ultrabrain_review',
    'ultrabrain_status',
    'ultrabrain_history',
    'ultrabrain_export',
    'ultrabrain_metrics',
    'ultrabrain_templates',
    'ultrabrain_reset',
  ]) {
    assert.ok(names.includes(expected), `missing tool ${expected}`);
  }
  const forbiddenPublicNames = ['code' + '-reasoning', 'sequential' + '-thinking' + '-ultra'];
  for (const forbidden of forbiddenPublicNames) {
    assert.ok(!names.includes(forbidden), 'legacy public tool name must not be exposed');
  }

  const started = await client.callTool({
    name: 'ultrabrain_start',
    arguments: {
      session_id: 'smoke',
      problem: 'Verify that the LCV Ultrabrain public MCP surface is branded and operational.',
      context: 'Smoke test for package runtime.',
      template: 'architecture_decision',
      tags: ['smoke', 'brand'],
      initial_thought: 'Map the runtime surface, inspect tool names, and validate one branch path.',
      total_thoughts: 4,
      response_format: 'json',
    },
  });
  const startedPayload = JSON.parse(started.content?.[0]?.text);
  assert.equal(startedPayload.status, 'started');
  assert.equal(startedPayload.session_id, 'smoke');

  const canonical = await client.callTool({
    name: 'ultrabrain_think',
    arguments: {
      session_id: 'smoke',
      thought: 'Record evidence that the canonical tool accepts quality, confidence, alternatives, risks, and next actions.',
      thought_number: 2,
      total_thoughts: 4,
      next_thought_needed: true,
      mode: 'hybrid',
      step_type: 'verification',
      evidence: ['tools/list exposed only ultrabrain_* tool names'],
      alternatives: ['fallback review remains outside this package'],
      risks: ['host reload still required after package installation'],
      next_actions: ['run validation', 'run package install verification'],
      confidence: 0.82,
      quality_metrics: {
        logical_consistency: 5,
        completeness: 4,
        objectivity: 4,
        practicality: 5,
        clarity: 5,
      },
      response_format: 'json',
    },
  });
  const canonicalPayload = JSON.parse(canonical.content?.[0]?.text);
  assert.equal(canonicalPayload.status, 'processed');
  assert.equal(canonicalPayload.session_id, 'smoke');
  assert.equal(canonicalPayload.thought_number, 2);

  const branch = await client.callTool({
    name: 'ultrabrain_branch',
    arguments: {
      session_id: 'smoke',
      thought: 'Branch through installation mechanics: global install must be a real directory, not a development junction.',
      thought_number: 3,
      total_thoughts: 4,
      next_thought_needed: true,
      branch_from_thought: 2,
      branch_id: 'install-real-package',
      mode: 'root_cause',
      step_type: 'analysis',
      evidence: ['npm link creates a reparse point and is not acceptable for this repository policy'],
      response_format: 'json',
    },
  });
  const branchPayload = JSON.parse(branch.content?.[0]?.text);
  assert.equal(branchPayload.status, 'processed');

  const merged = await client.callTool({
    name: 'ultrabrain_merge',
    arguments: {
      session_id: 'smoke',
      branch_ids: ['install-real-package'],
      strategy: 'decision',
      create_thought: true,
      response_format: 'json',
    },
  });
  const mergedPayload = JSON.parse(merged.content?.[0]?.text);
  assert.equal(mergedPayload.status, 'merged');

  const validation = await client.callTool({
    name: 'ultrabrain_validate',
    arguments: { session_id: 'smoke', response_format: 'json' },
  });
  const validationPayload = JSON.parse(validation.content?.[0]?.text);
  assert.match(validationPayload.status, /valid|needs_work/);

  const status = await client.callTool({
    name: 'ultrabrain_status',
    arguments: { session_id: 'smoke' },
  });
  const statusPayload = JSON.parse(status.content?.[0]?.text);
  assert.ok(statusPayload.thought_count >= 4);

  const exported = await client.callTool({
    name: 'ultrabrain_export',
    arguments: { session_id: 'smoke', format: 'markdown' },
  });
  assert.match(exported.content?.[0]?.text, /Ultrabrain Session smoke/);

  const prompts = await client.listPrompts();
  assert.ok(prompts.prompts.some((prompt) => prompt.name === 'ultrabrain_problem_breakdown'));

  const resourceList = await client.listResources();
  assert.ok(resourceList.resources.some((resource) => resource.uri === 'ultrabrain://sessions'));
} finally {
  await client.close();
}

console.log('ultrabrain smoke ok');
