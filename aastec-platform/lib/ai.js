// ===================================================================
//  AI services — AI Learning Coach, lesson summariser, quiz generator,
//  pitch review, report drafting and handbook help centre.
//  Uses Claude through the official Anthropic SDK when credentials are
//  configured (ANTHROPIC_API_KEY); otherwise a transparent offline mode
//  produces rule-based results from platform data so every feature works.
// ===================================================================
import Anthropic from '@anthropic-ai/sdk';
import { all, run, nowISO } from '../db/database.js';

export const AI_MODEL = process.env.AI_MODEL || 'claude-opus-5-5';
export const aiEnabled = () => !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
let client = null;
const claude = () => (client ??= new Anthropic());

const HOUSE_STYLE = 'You are part of the AASTEC Digital Platform of the AAST Entrepreneurship Center (Rally Society ecosystem). Write in clear, formal, encouraging English. Be concise and practical. Use short paragraphs or bullet points. Never invent facts about specific people, Societies or statistics that are not provided in the context.';

async function callClaude(system, messages, effort = 'medium') {
  const response = await claude().beta.messages.create({
    model: AI_MODEL,
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort },
    system: `${HOUSE_STYLE}\n\n${system}`,
    messages,
  });
  if (response.stop_reason === 'refusal') return 'This request cannot be completed by the assistant. Please rephrase it or contact the AASTEC team.';
  return response.content.filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
}

function log(userId, tool, prompt, response, mode) {
  run('INSERT INTO ai_logs(user_id, tool, prompt, response, mode, created_at) VALUES(?,?,?,?,?,?)', userId, tool, String(prompt).slice(0, 4000), String(response).slice(0, 8000), mode, nowISO());
}

// Run with Claude when configured; fall back to the offline implementation on any API error.
async function runTool(userId, tool, { system, messages, effort, prompt }, offline) {
  if (aiEnabled()) {
    try {
      const text = await callClaude(system, messages, effort);
      log(userId, tool, prompt, text, 'claude');
      return { text, mode: 'claude', model: AI_MODEL };
    } catch (e) {
      const status = e instanceof Anthropic.APIError ? e.status : null;
      console.error(`[ai] ${tool} failed${status ? ` (HTTP ${status})` : ''}: ${e.message}`);
      const text = offline();
      log(userId, tool, prompt, text, 'offline-fallback');
      return { text, mode: 'offline', notice: 'The AI service is temporarily unavailable — showing an offline result.' };
    }
  }
  const text = offline();
  log(userId, tool, prompt, text, 'offline');
  return { text, mode: 'offline' };
}

// ---------------- offline helpers ----------------
const sentences = (t = '') => t.replace(/\s+/g, ' ').split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(s => s.length > 20);
const STOP = new Set('the a an and or of to in for with on at by from is are be as that this it its their your our you we they can will should into than then also more most such these those which who what when where how about over under after before only each every'.split(' '));
const keywords = (t = '') => [...new Set(t.toLowerCase().match(/[a-z][a-z-]{3,}/g) || [])].filter(w => !STOP.has(w));

const COACH_TOPICS = [
  [/pitch|investor|deck|present/i, 'Strengthen your pitch', ['Open with a real customer story and quantify the pain.', 'Show evidence of traction — interviews, pilots, sign-ups or revenue.', 'Close with a specific ask: amount, use of funds and milestones.', 'Rehearse a two-minute version and time yourself.'], ['Pitching & Storytelling That Converts', 'Financial Literacy for Entrepreneurs']],
  [/lead|president|committee|team|delegat/i, 'Develop your leadership', ['Give each committee a clear mandate and weekly rhythm.', 'Delegate outcomes, not tasks, and agree deadlines in writing.', 'Use the approval workflows so decisions are transparent and recorded.', 'Recognise contributors publicly in the community feed.'], ['Society Leadership & Governance', 'Event Management & Reporting']],
  [/financ|money|budget|price|cost|cash/i, 'Build financial confidence', ['Separate fixed and variable costs and calculate your contribution margin.', 'Compute break-even volume before setting targets.', 'Keep a rolling thirteen-week cash forecast.'], ['Financial Literacy for Entrepreneurs']],
  [/market|brand|social|growth|content/i, 'Grow your audience', ['Define one ideal audience and a single clear value proposition.', 'Plan content pillars and a consistent publishing calendar.', 'Run small growth experiments and track engagement rate weekly.'], ['Digital Marketing & Growth Hacking']],
  [/idea|validat|customer|problem|mvp/i, 'Validate your idea', ['Interview at least twenty potential customers about past behaviour.', 'Write down your riskiest assumption and design a cheap test for it.', 'Build the smallest prototype that tests that assumption.'], ['Entrepreneurship Fundamentals', 'Design Thinking & Innovation']],
  [/\bai\b|artificial|data|automation/i, 'Use AI responsibly', ['Give the assistant context, a clear task, constraints and a format.', 'Verify facts and never upload personal or confidential data.', 'Keep a human accountable for every decision.'], ['AI for Entrepreneurs', 'Cybersecurity & Digital Safety Essentials']],
  [/resume|cv|career|intern|job/i, 'Prepare for opportunities', ['Lead each experience with a measurable result.', 'Highlight Society leadership, events delivered and certificates earned.', 'Share your verified AASTEC certificates on LinkedIn.'], ['Pitching & Storytelling That Converts', 'Digital Marketing & Growth Hacking']],
];

// ---------------- public tools ----------------
export function coach(user, history, context) {
  const last = [...history].reverse().find(m => m.role === 'user')?.content || '';
  const system = `You are the AI Learning Coach. Personalise advice to this learner and recommend specific courses from the catalogue when relevant.\nLearner context (JSON): ${JSON.stringify(context)}`;
  const messages = history.slice(-12).map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content).slice(0, 4000) }));
  return runTool(user.id, 'coach', { system, messages, prompt: last }, () => {
    const topic = COACH_TOPICS.find(([re]) => re.test(last)) || COACH_TOPICS[4];
    const [, title, steps, courses] = topic;
    const gaps = (context.skill_gaps || []).slice(0, 2).map(g => g.skill).join(' and ');
    return `**${title}**\n\n${steps.map(s => `• ${s}`).join('\n')}\n\n**Recommended next:** ${courses.join(', ')}.` +
      (gaps ? `\n\nBased on your learning record, your biggest growth areas are ${gaps}.` : '') +
      '\n\n_Offline coach mode — connect the AI service for fully personalised answers._';
  });
}

export function summarizeLesson(user, lesson) {
  const system = 'Summarise the lesson for a student: 4–6 key points as bullets, then one line beginning "Key takeaway:".';
  return runTool(user.id, 'summarize', { system, messages: [{ role: 'user', content: `Lesson: ${lesson.title}\n\n${lesson.content}` }], effort: 'low', prompt: lesson.title }, () => {
    const s = sentences(lesson.content);
    return `${s.slice(0, 5).map(x => `• ${x}`).join('\n')}\n\nKey takeaway: ${s[0] || lesson.title}`;
  });
}

export function generateQuiz(user, lesson) {
  const system = 'Write 3 multiple-choice practice questions about the lesson. Format each as: "Q1. question" then options "A) … B) … C) … D) …" then "Answer: X — short explanation". Plain text only.';
  return runTool(user.id, 'quiz', { system, messages: [{ role: 'user', content: `Lesson: ${lesson.title}\n\n${lesson.content}` }], effort: 'low', prompt: lesson.title }, () => {
    const ss = sentences(lesson.content).slice(0, 3);
    const pool = keywords(lesson.content).filter(w => w.length > 6);
    return ss.map((s, i) => {
      const words = keywords(s).filter(w => w.length > 6);
      const answer = words.sort((a, b) => b.length - a.length)[0] || pool[0] || 'entrepreneurship';
      const distract = pool.filter(w => w !== answer).slice(i * 3, i * 3 + 3);
      while (distract.length < 3) distract.push(['strategy', 'innovation', 'governance', 'marketing'][distract.length]);
      const opts = [answer, ...distract].sort();
      const letter = 'ABCD'[opts.indexOf(answer)];
      return `Q${i + 1}. Complete the statement: "${s.replace(new RegExp(answer, 'i'), '_____')}"\n${opts.map((o, k) => `${'ABCD'[k]}) ${o}`).join('   ')}\nAnswer: ${letter} — ${answer}`;
    }).join('\n\n');
  });
}

export function pitchReview(user, pitch, venture) {
  const system = 'You are the AI Pitch Assistant for student founders. Review the pitch and reply with sections: "Score: N/100", "Strengths", "Gaps", "Suggested improvements" (each a short bullet list) and "Investor question to prepare for".';
  const content = `Venture: ${venture ? JSON.stringify({ name: venture.name, sector: venture.sector, stage: venture.stage, tagline: venture.tagline }) : 'n/a'}\n\nPitch:\n${pitch}`;
  return runTool(user.id, 'pitch', { system, messages: [{ role: 'user', content }], prompt: pitch.slice(0, 500) }, () => {
    const t = pitch.toLowerCase();
    const parts = [['problem', /problem|pain|challenge/], ['solution', /solution|we (build|offer|provide)|product/], ['market', /market|customers|segment|tam|size/], ['traction', /traction|users|revenue|pilot|customers signed|growth/], ['business model', /revenue|pricing|subscription|fee|model/], ['team', /team|founder|experience|cto|ceo/], ['ask', /raise|ask|seeking|investment|funding/]];
    const has = parts.filter(([, re]) => re.test(t)).map(([n]) => n);
    const missing = parts.map(([n]) => n).filter(n => !has.includes(n));
    const len = pitch.split(/\s+/).length;
    const score = Math.min(95, Math.round(30 + has.length * 9 + (len > 80 && len < 400 ? 5 : 0)));
    return `Score: ${score}/100\n\nStrengths\n${(has.length ? has : ['clear intent']).map(h => `• Covers the ${h}`).join('\n')}\n\nGaps\n${(missing.length ? missing : ['none detected']).map(m => `• ${m === 'none detected' ? 'No major gaps detected' : `Add a clear ${m} section`}`).join('\n')}\n\nSuggested improvements\n• Quantify the problem with one striking statistic from your interviews.\n• Show evidence of traction — even early pilots or waiting-list sign-ups.\n• End with a specific ask and the milestones it unlocks.\n\nInvestor question to prepare for\n• "What is your unfair advantage, and why will customers switch from today's alternative?"\n\n_Offline review — connect the AI service for a detailed, context-aware critique._`;
  });
}

export function draftReport(user, data) {
  const system = 'Draft a monthly Society activity report for the Faculty Advisor using ONLY the recorded data provided. Sections: Summary, Activities delivered, Engagement & learning, Governance & compliance, Next month priorities. Mark any assumption clearly as "[to confirm]". The leader will review before submission.';
  return runTool(user.id, 'report', { system, messages: [{ role: 'user', content: JSON.stringify(data) }], prompt: `${data.society} ${data.period}` }, () => {
    const ev = data.events || [];
    return `Summary\nIn ${data.period_label}, Rally Society ${data.society} delivered ${ev.length} recorded activities with ${data.training_hours} training hours and ${data.checkins} check-ins. ${data.posts} posts were published and ${data.new_members} new members joined.\n\nActivities delivered\n${ev.map(e => `• ${e.title} (${e.date}) — ${e.attendance ?? 0} attendees`).join('\n') || '• No completed activities were recorded this month.'}\n\nEngagement & learning\n• ${data.course_completions} course completions and ${data.certificates} certificates issued to members.\n• Community activity: ${data.posts} posts and ${data.comments} comments.\n\nGovernance & compliance\n• Handbook acknowledgement: ${data.handbook_pct}% of active members.\n• Open escalations: ${data.open_escalations}.\n\nNext month priorities\n• [to confirm] Confirm the upcoming event schedule and committee deliverables.\n• [to confirm] Follow up on pending authorization requests.`;
  });
}

export function handbookAnswer(user, question) {
  const sections = all('SELECT code, title, body FROM handbook_sections ORDER BY sort');
  const system = `Answer questions about the Rally Society Handbook using ONLY the sections below. Cite section codes like (Section 4.2). If the handbook does not cover the question, say so and suggest contacting the Programme Manager.\n\n${sections.map(s => `Section ${s.code} — ${s.title}: ${s.body}`).join('\n\n')}`;
  return runTool(user.id, 'handbook', { system, messages: [{ role: 'user', content: question }], effort: 'low', prompt: question }, () => {
    const q = keywords(question);
    const ranked = sections.map(s => ({ s, score: q.reduce((n, w) => n + (`${s.title} ${s.body}`.toLowerCase().includes(w) ? (s.title.toLowerCase().includes(w) ? 3 : 1) : 0), 0) })).sort((a, b) => b.score - a.score);
    if (!ranked[0] || ranked[0].score === 0) return 'The handbook does not appear to cover this question directly. Please contact your Rally Societies Programme Manager for guidance.';
    return ranked.slice(0, 2).filter(r => r.score > 0).map(r => `**Section ${r.s.code} — ${r.s.title}**\n${r.s.body}`).join('\n\n');
  });
}
