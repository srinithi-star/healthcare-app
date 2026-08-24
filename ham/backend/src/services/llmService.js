const logger = require('../config/logger');

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';

// Every LLM call in this service follows the same contract:
//   { ok: true, data: {...} }  on success
//   { ok: false, error: 'reason' }  on any failure
// Callers NEVER throw on an LLM failure — appointments must still be
// bookable and visits must still be completable even if the model is down,
// rate-limited, or returns malformed JSON. See ARCHITECTURE.md ("LLM failure
// handling") for the reasoning.

async function callClaude(systemPrompt, userPrompt, { maxTokens = 600 } = {}) {
  if (!process.env.ANTHROPIC_API_KEY) {
    logger.warn('ANTHROPIC_API_KEY not set — skipping LLM call');
    return { ok: false, error: 'LLM not configured' };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000); // hard timeout so a hung LLM call never blocks a booking

  try {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      logger.error(`Anthropic API error ${response.status}: ${text}`);
      return { ok: false, error: `LLM API returned ${response.status}` };
    }

    const data = await response.json();
    const textBlock = (data.content || []).find((b) => b.type === 'text');
    if (!textBlock) return { ok: false, error: 'LLM returned no text content' };

    return { ok: true, raw: data, text: textBlock.text };
  } catch (err) {
    logger.error('LLM call failed', { message: err.message });
    return { ok: false, error: err.name === 'AbortError' ? 'LLM request timed out' : err.message };
  } finally {
    clearTimeout(timeout);
  }
}

function extractJson(text) {
  // Models sometimes wrap JSON in prose or code fences despite instructions —
  // pull out the first {...} block defensively rather than trusting raw parse.
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No JSON object found in LLM response');
  return JSON.parse(match[0]);
}

/**
 * Pre-visit summary: urgency level, chief complaint, 3 suggested questions.
 * Spec prompt: "Analyse these symptoms and return: urgency level (Low / Medium /
 * High), chief complaint, and three suggested questions for the doctor."
 */
async function generatePreVisitSummary(symptomText) {
  const system =
    'You are a clinical triage assistant helping a doctor prepare for a patient visit. ' +
    'You do not diagnose. Respond ONLY with a single JSON object, no prose, no markdown fences, ' +
    'in exactly this shape: {"urgency": "Low"|"Medium"|"High", "chiefComplaint": string, ' +
    '"suggestedQuestions": [string, string, string]}.';

  const user = `Analyse these symptoms and return: urgency level (Low / Medium / High), chief complaint, and three suggested questions for the doctor.\n\nSymptoms: ${symptomText}`;

  const result = await callClaude(system, user, { maxTokens: 400 });
  if (!result.ok) return result;

  try {
    const parsed = extractJson(result.text);
    if (!parsed.urgency || !parsed.chiefComplaint || !Array.isArray(parsed.suggestedQuestions)) {
      throw new Error('Malformed LLM JSON shape');
    }
    const urgency = String(parsed.urgency).toUpperCase();
    if (!['LOW', 'MEDIUM', 'HIGH'].includes(urgency)) throw new Error('Invalid urgency value');

    return {
      ok: true,
      data: {
        urgency,
        chiefComplaint: parsed.chiefComplaint,
        suggestedQuestions: parsed.suggestedQuestions.slice(0, 3),
      },
      raw: result.raw,
    };
  } catch (err) {
    logger.error('Failed to parse pre-visit LLM response', { message: err.message, text: result.text });
    return { ok: false, error: 'Could not parse LLM response', raw: result.raw };
  }
}

/**
 * Post-visit summary: patient-friendly version of clinical notes + prescription.
 * Spec prompt: "Convert these clinical notes into a patient-friendly summary
 * with medication schedule and follow-up steps."
 */
async function generatePostVisitSummary(clinicalNotes, prescription) {
  const system =
    'You are a patient communication assistant. Rewrite clinical notes in plain, ' +
    'warm, non-alarming language a patient without medical training can understand. ' +
    'Respond ONLY with a single JSON object, no prose, no markdown fences, in exactly ' +
    'this shape: {"summary": string, "medicationSchedule": string, "followUpSteps": string}.';

  const prescriptionText = Array.isArray(prescription) && prescription.length
    ? prescription.map((p) => `${p.drug} ${p.dose}, ${p.frequency}, for ${p.durationDays} days`).join('; ')
    : 'No medication prescribed';

  const user = `Convert these clinical notes into a patient-friendly summary with medication schedule and follow-up steps.\n\nClinical notes: ${clinicalNotes}\n\nPrescription: ${prescriptionText}`;

  const result = await callClaude(system, user, { maxTokens: 600 });
  if (!result.ok) return result;

  try {
    const parsed = extractJson(result.text);
    if (!parsed.summary) throw new Error('Malformed LLM JSON shape');
    return {
      ok: true,
      data: {
        summary: parsed.summary,
        medicationSchedule: parsed.medicationSchedule || '',
        followUpSteps: parsed.followUpSteps || '',
      },
      raw: result.raw,
    };
  } catch (err) {
    logger.error('Failed to parse post-visit LLM response', { message: err.message, text: result.text });
    return { ok: false, error: 'Could not parse LLM response', raw: result.raw };
  }
}

module.exports = { generatePreVisitSummary, generatePostVisitSummary };
