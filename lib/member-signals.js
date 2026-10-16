// Member signals for 127's member-ops jobs.
//
// Pure functions: no database, no network and no clock (callers pass `now`),
// so the same file runs inside the app (the ops feed and /admin/ops) and in the
// scheduled members heartbeat (engine/pulse.js), and both read members the same way.
//
// Input is one member as the ops feed describes it (see ../README.md, "Feed").
// Missing fields are fine: every rule checks for what it needs and skips otherwise.
//
// What comes out:
// - stage:    signed_up -> onboarded -> active / drifting / stalled / dormant, roadmap_done, or paused
// - risk:     a 0-100 churn score with reasons, for paying members only (heuristic; the
//             weekly review checks it against real cancellations so the weights can be tuned)
// - checkin:  the personal note from Eli this member is due, if any (drafted by the job,
//             approved by Eli, never sent on its own)
// - heldOut:  the rescue note a member in the comparison group would have had (logged, not drafted)
// - nudge:    the one in-app card the dashboard can show (no email)

const DAY = 24 * 60 * 60 * 1000;

const DEFAULTS = {
  caps: { drafts_per_day: 12, per_member_cooldown_days: 7, cooldown_exempt_priority: 85 },
  activity: { drifting_days: 7, stalled_days: 14, dormant_days: 30 },
  risk: {
    watch: 30,
    high: 50,
    weights: {
      idle_drifting: 20, idle_stalled: 35, idle_dormant: 50, velocity_drop: 15, never_activated_paid: 25,
      payment_issue: 30, downgraded_30d: 20, complaint_14d: 15, cancel_page_14d: 20, pause_scheduled: 15, paused_recently: 15,
      roadmap_done_no_next: 10, early_tenure: 5,
      milestone_14d: -15, win_14d: -10, circle_attended_last2: -20,
    },
    early_tenure_days: 45,
    never_activated_after_days: 7,
    roadmap_done_grace_days: 7,
    paused_recently_days: 60,
  },
  checkins: {
    circle_welcome: { enabled: true, priority: 95, window_days: 5 },
    payment_issue: { enabled: true, priority: 90, tiers: ['circle'], after_days: 2, cooldown_days: 7 },
    milestone: { enabled: true, priority: 80, window_days: 7, milestones: ['first_sale', 'repeat_customer', 'revenue_1k', 'repeatable', 'registered'] },
    roadmap_done: { enabled: true, priority: 78, window_days: 7 },
    cancel_scheduled: { enabled: true, priority: 75, builder_min_tenure_days: 60, builder_min_steps: 6 },
    circle_missed: { enabled: true, priority: 72, missed_in_a_row: 2, cooldown_days: 21 },
    at_risk: { enabled: true, priority: 70, cooldown_days: 30, max_total: 3 },
    first_win: { enabled: true, priority: 65, window_days: 2 },
    stuck_paid: { enabled: true, priority: 60, cooldown_days: 21, max_total: 3 },
    builder_day3: { enabled: true, priority: 50, days_after_paid: 3, window_days: 4 },
    winback: { enabled: true, priority: 40, tiers: ['circle'], after_days: 45, window_days: 14, min_paid_days: 28, offer: null, commercial: true },
    circle_fit: { enabled: true, priority: 30, per_run: 1, min_milestones: 2, needs_open_seat: true, commercial: true },
  },
  // A fixed share of members never gets the "rescue" notes, so the weekly review can tell
  // whether those notes change anything. Set pct to 0 to turn the comparison off.
  holdout: { pct: 15, kinds: ['at_risk', 'stuck_paid', 'builder_day3'], salt: '127-members-v1' },
  // Notes that sell something (a Circle invitation, a win-back) only go to members who said yes to marketing email.
  consent: { commercial_needs_optin: true },
};

const MILESTONE_LABELS = {
  idea_test: 'Idea passes the Idea Test',
  conversations: '10 customer conversations',
  offer: 'Offer written',
  registered: 'Business registered',
  page_live: 'Landing page live',
  first_lead: 'First lead',
  first_sale: 'First sale',
  revenue_1k: 'First repeat customer', // old app id, renamed Oct 16; notes never restate income figures (voice §15, Legal L12)
  repeat_customer: 'First repeat customer',
  repeatable: 'First repeatable month',
};

// Touch statuses that mean nothing reached the member.
const NOT_CONTACT = new Set(['discarded', 'holdout']);

// ---------- small helpers ----------

function isObj(v) {
  return v && typeof v === 'object' && !Array.isArray(v);
}

// Deep merge for config: arrays and scalars from `over` replace the defaults.
function merge(base, over) {
  if (!isObj(over)) return base;
  const out = { ...base };
  for (const [k, v] of Object.entries(over)) {
    if (k.startsWith('_')) continue;
    out[k] = isObj(v) && isObj(base[k]) ? merge(base[k], v) : v;
  }
  return out;
}

function config(over) {
  return merge(DEFAULTS, over || {});
}

function ms(v) {
  if (v == null || v === '') return null;
  const t = typeof v === 'number' ? v : Date.parse(v);
  return Number.isFinite(t) ? t : null;
}

function days(fromMs, toMs) {
  if (fromMs == null || toMs == null) return null;
  return Math.floor((toMs - fromMs) / DAY);
}

function iso(t) {
  return t == null ? null : new Date(t).toISOString();
}

function day(t) {
  return iso(t).slice(0, 10);
}

function n(count, word) {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

function firstName(m) {
  return (m.firstName || (m.name || '').split(' ')[0] || '').trim() || null;
}

function isPaid(m) {
  return m.tier === 'builder' || m.tier === 'circle';
}

function list(v) {
  return Array.isArray(v) ? v : [];
}

function values(obj) {
  return isObj(obj) ? Object.values(obj) : [];
}

// FNV-1a, so a member lands in the same comparison group on every run and in every process.
function bucket(id, salt) {
  let h = 0x811c9dc5;
  const s = `${salt}:${id}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h % 100;
}

function inHoldout(m, cfg) {
  const h = cfg.holdout || {};
  return Number(h.pct) > 0 && m.id != null && bucket(m.id, h.salt || '') < Number(h.pct);
}

function challengeFinisher(m) {
  return !!((m.challenge && m.challenge.finisher) || list(m.badges).includes('day_one'));
}

// ---------- billing facts ----------

function billing(m) {
  return m.billing || {};
}

// A member can pause Builder for a month (Offer and conversion, O6). No outreach while paused.
function pauseInfo(m, now) {
  const p = billing(m).pause;
  if (!isObj(p)) return null;
  const start = ms(p.startedAt);
  const end = ms(p.resumesAt);
  return { start, end, active: end != null && end > now && (start == null || start <= now) };
}

function isPaused(m, now) {
  const p = pauseInfo(m, now);
  return !!(p && p.active);
}

// When the member first started paying (for "day 3" notes, tenure and win-back).
function paidSinceMs(m) {
  const b = billing(m);
  if (b.paidSince) return ms(b.paidSince);
  if (b.firstPaidAt) return ms(b.firstPaidAt);
  const firstPaid = list(b.planHistory).find((h) => h && (h.to === 'builder' || h.to === 'circle'));
  if (firstPaid) return ms(firstPaid.at);
  return null;
}

// When the member moved to their current paid tier (circle welcome).
function tierSinceMs(m) {
  const b = billing(m);
  const hist = list(b.planHistory).filter((h) => h && h.to === m.tier);
  if (hist.length) return ms(hist[hist.length - 1].at);
  if (b.tierSince) return ms(b.tierSince);
  return paidSinceMs(m);
}

function downgradedWithin(m, now, d) {
  const RANK = { free: 0, builder: 1, circle: 2 };
  return list(billing(m).planHistory).some((h) => {
    const at = ms(h && h.at);
    return at != null && now - at <= d * DAY && RANK[h.to] < RANK[h.from] && h.to !== 'free';
  });
}

// The last time a paying member went back to free, and which plan they left.
function lastExit(m) {
  const b = billing(m);
  const hist = list(b.planHistory);
  for (let i = hist.length - 1; i >= 0; i--) {
    const h = hist[i];
    if (h && h.to === 'free' && h.from && h.from !== 'free') return { at: ms(b.canceledAt) || ms(h.at), from: h.from };
  }
  if (b.canceledAt) return { at: ms(b.canceledAt), from: b.canceledFrom || null };
  return null;
}

function canceledAtMs(m) {
  const e = lastExit(m);
  return e ? e.at : null;
}

// Paid days before the last cancellation (used to decide who gets a personal win-back note).
function paidDaysBeforeCancel(m) {
  const start = paidSinceMs(m);
  const end = canceledAtMs(m);
  return start != null && end != null ? days(start, end) : null;
}

// ---------- activity ----------

// Every timestamp that shows the member did something on purpose.
// (Billing webhooks also update a member record, so updatedAt is deliberately not used.)
function activityTimes(m) {
  const t = [
    ...list(m.completedAt),
    ...list(m.resourcesDoneAt),
    ...values(m.milestones),
    ...list(m.wins).map((w) => w && (w.at || w.createdAt)),
    ...list(m.circle && m.circle.questions).map((q) => q && q.at),
    m.ai && m.ai.lastAt,
    m.lastSeenAt,
  ]
    .map(ms)
    .filter((x) => x != null);
  return t.sort((a, b) => a - b);
}

function lastActiveMs(m) {
  const t = activityTimes(m);
  if (t.length) return t[t.length - 1];
  return ms(m.onboardedAt) || ms(m.createdAt);
}

// Quiet time starts again when a pause ends, so a member isn't "30 days quiet" the day they come back.
function effectiveLastActiveMs(m, now) {
  const last = lastActiveMs(m);
  const p = pauseInfo(m, now);
  if (p && p.end != null && p.end <= now && (last == null || p.end > last)) return p.end;
  return last;
}

function countBetween(times, from, to) {
  return times.filter((t) => t >= from && t < to).length;
}

function stepTimes(m) {
  return list(m.completedAt).map(ms).filter((x) => x != null).sort((a, b) => a - b);
}

function roadmapProgress(m) {
  const r = m.roadmap || {};
  const done = Number.isFinite(r.done) ? r.done : list(m.completedAt).length;
  const total = Number.isFinite(r.total) ? r.total : 0;
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0, next: r.nextTask || null };
}

function stage(m, now, cfg) {
  const c = cfg.activity;
  const p = roadmapProgress(m);
  if (isPaused(m, now)) return 'paused';
  if (!m.onboardedAt && !(m.roadmap && p.total)) return 'signed_up';
  if (p.total && p.done >= p.total) return 'roadmap_done';
  if (!m.activatedAt && !stepTimes(m).length) return 'onboarded';
  const idle = days(effectiveLastActiveMs(m, now), now);
  if (idle == null || idle < c.drifting_days) return 'active';
  if (idle < c.stalled_days) return 'drifting';
  if (idle < c.dormant_days) return 'stalled';
  return 'dormant';
}

// ---------- risk ----------

// An unhappy ticket, or a ticket asking for a refund or how to cancel.
function recentComplaint(m, now) {
  return list(m.tickets).some((t) => t && (t.sentiment === 'negative' || t.category === 'refund' || t.category === 'cancel') && ms(t.at) != null && now - ms(t.at) <= 14 * DAY);
}

function circleAttendedLast2(m) {
  const att = list(m.circle && m.circle.attendance).slice(-2);
  return att.length === 2 && att.every((a) => a && a.attended);
}

function risk(m, now, cfg) {
  if (!isPaid(m)) return null;
  const w = cfg.risk.weights;
  const reasons = [];
  const add = (code, points, label) => {
    if (!points) return;
    reasons.push({ code, points, label });
  };
  const b = billing(m);
  if (b.cancelAtPeriodEnd) {
    return { score: 100, level: 'leaving', reasons: [{ code: 'cancel_scheduled', points: 100, label: `Cancels on ${(b.currentPeriodEnd || '').slice(0, 10) || 'period end'}` }] };
  }
  const pause = pauseInfo(m, now);
  if (pause && pause.active) {
    return { score: 0, level: 'paused', reasons: [{ code: 'paused', points: 0, label: `Paused until ${day(pause.end)}` }] };
  }
  const idle = days(effectiveLastActiveMs(m, now), now);
  const a = cfg.activity;
  if (idle != null && idle >= a.dormant_days) add('idle', w.idle_dormant, `No activity for ${n(idle, 'day')}`);
  else if (idle != null && idle >= a.stalled_days) add('idle', w.idle_stalled, `No activity for ${n(idle, 'day')}`);
  else if (idle != null && idle >= a.drifting_days) add('idle', w.idle_drifting, `No activity for ${n(idle, 'day')}`);

  const resumedDaysAgo = pause && pause.end != null ? days(pause.end, now) : null;
  const steps = stepTimes(m);
  const last14 = countBetween(steps, now - 14 * DAY, now + 1);
  const prev14 = countBetween(steps, now - 28 * DAY, now - 14 * DAY);
  if (last14 === 0 && prev14 >= 2 && !(resumedDaysAgo != null && resumedDaysAgo < 28)) add('velocity_drop', w.velocity_drop, `Steps fell from ${prev14} to 0 in two weeks`);

  const paidDays = days(paidSinceMs(m), now);
  if (!steps.length && paidDays != null && paidDays >= cfg.risk.never_activated_after_days) {
    add('never_activated', w.never_activated_paid, `Paying ${n(paidDays, 'day')}, no roadmap step yet`);
  }
  if (b.paymentIssue) add('payment_issue', w.payment_issue, 'Card declined; Stripe is retrying');
  if (downgradedWithin(m, now, 30)) add('downgraded', w.downgraded_30d, 'Downgraded in the last 30 days');
  if (recentComplaint(m, now)) add('complaint', w.complaint_14d, 'Unhappy, refund or cancel ticket in the last 14 days');
  const cancelView = ms(b.cancelPageViewedAt);
  if (cancelView != null && now - cancelView <= 14 * DAY) add('cancel_page', w.cancel_page_14d, `Opened the cancel screen ${n(days(cancelView, now), 'day')} ago`);
  if (pause && pause.start != null && pause.start > now) add('pause_scheduled', w.pause_scheduled, `Asked to pause from ${day(pause.start)}`);
  if (resumedDaysAgo != null && resumedDaysAgo >= 0 && resumedDaysAgo <= cfg.risk.paused_recently_days) add('paused_recently', w.paused_recently, `Came back from a pause ${n(resumedDaysAgo, 'day')} ago`);

  const p = roadmapProgress(m);
  if (p.total && p.done >= p.total) {
    const lastStep = steps.length ? steps[steps.length - 1] : null;
    if (lastStep != null && now - lastStep >= cfg.risk.roadmap_done_grace_days * DAY) {
      add('roadmap_done_no_next', w.roadmap_done_no_next, 'Finished the 30-day roadmap, nothing planned next');
    }
  }
  if (paidDays != null && paidDays < cfg.risk.early_tenure_days) add('early_tenure', w.early_tenure, 'First weeks of paying (highest churn period)');

  const recentMilestone = values(m.milestones).some((t) => ms(t) != null && now - ms(t) <= 14 * DAY);
  if (recentMilestone) add('milestone', w.milestone_14d, 'Hit a milestone in the last 14 days');
  const recentWin = list(m.wins).some((x) => ms(x && (x.at || x.createdAt)) != null && now - ms(x.at || x.createdAt) <= 14 * DAY);
  if (recentWin) add('win', w.win_14d, 'Posted a win in the last 14 days');
  if (m.tier === 'circle' && circleAttendedLast2(m)) add('circle_attended', w.circle_attended_last2, 'Attended the last two Circle calls');

  const score = Math.max(0, Math.min(100, reasons.reduce((s, r) => s + r.points, 0)));
  const level = score >= cfg.risk.high ? 'high' : score >= cfg.risk.watch ? 'watch' : 'ok';
  return { score, level, reasons: reasons.sort((x, y) => y.points - x.points) };
}

// ---------- personal check-ins ----------

// Each kind maps to a template in ops/members/templates/checkins.md.
// `key` makes one-off notes one-off (a member gets one first-sale note, ever); kinds that may
// repeat carry a date in the key and a cooldown.
function touchesOf(m) {
  return list(m.touches).filter((t) => t && t.kind);
}

function isContact(t) {
  return !NOT_CONTACT.has(t.status);
}

function lastTouchMs(m, predicate) {
  const t = touchesOf(m).filter(predicate).map((x) => ms(x.at)).filter((x) => x != null);
  return t.length ? Math.max(...t) : null;
}

function alreadyTouched(m, key) {
  return touchesOf(m).some((t) => (t.key || t.kind) === key);
}

function candidateCheckins(m, now, cfg, ctx) {
  const C = cfg.checkins;
  const out = [];
  const name = firstName(m);
  const b = billing(m);
  const holdout = inHoldout(m, cfg);
  const holdoutKinds = list(cfg.holdout && cfg.holdout.kinds);
  const add = (kind, key, reason, context = {}) => {
    const c = C[kind];
    if (!c || !c.enabled) return;
    if (alreadyTouched(m, key)) return;
    if (c.cooldown_days) {
      // Any earlier note of this kind counts here, even one Eli discarded or one held out.
      const last = lastTouchMs(m, (t) => t.kind === kind);
      if (last != null && now - last < c.cooldown_days * DAY) return;
    }
    if (c.max_total && touchesOf(m).filter((t) => t.kind === kind && isContact(t)).length >= c.max_total) return;
    if (c.commercial && cfg.consent && cfg.consent.commercial_needs_optin && (m.marketingOptIn !== true || m.unsubscribed === true)) return;
    out.push({
      kind,
      key,
      priority: c.priority,
      reason,
      commercial: !!c.commercial,
      holdout: holdout && holdoutKinds.includes(kind),
      context: { firstName: name, challengeFinisher: challengeFinisher(m), ...context },
    });
  };

  const paidSince = paidSinceMs(m);
  const tierSince = tierSinceMs(m);
  const steps = stepTimes(m);
  const p = roadmapProgress(m);
  const st = stage(m, now, cfg);
  const paused = st === 'paused';
  // A pause starts when the paid month ends (Legal). Once a member has asked for one, no rescue notes.
  const pi = pauseInfo(m, now);
  const pauseSoon = !!(pi && pi.start != null && pi.start > now);
  const today = day(now);

  // Circle welcome: within a few days of taking a seat.
  if (m.tier === 'circle' && tierSince != null && now - tierSince <= C.circle_welcome.window_days * DAY) {
    add('circle_welcome', `circle_welcome:${day(tierSince)}`, "New Founder's Circle member", { since: iso(tierSince) });
  }

  // Failed payment, personal note for the tiers in config (Builders already get the app's email).
  if (b.paymentIssue && list(C.payment_issue.tiers).includes(m.tier)) {
    const since = ms(b.paymentIssue.at);
    if (since != null && now - since >= C.payment_issue.after_days * DAY) {
      add('payment_issue', `payment_issue:${(b.paymentIssue.at || '').slice(0, 10)}`, `Card declined ${n(days(since, now), 'day')} ago`, { attempt: b.paymentIssue.attempt || 1 });
    }
  }

  // Real-world milestones, each celebrated once, while it is fresh.
  for (const [id, at] of Object.entries(isObj(m.milestones) ? m.milestones : {})) {
    if (!list(C.milestone.milestones).includes(id)) continue;
    const t = ms(at);
    if (t == null || now - t > C.milestone.window_days * DAY) continue;
    add('milestone', `milestone:${id}`, `Checked off: ${MILESTONE_LABELS[id] || id}`, { milestone: id, label: MILESTONE_LABELS[id] || id, at });
  }

  // Finished the 30-day roadmap: celebrate and point at the next 30 days.
  if (p.total && p.done >= p.total && steps.length) {
    const lastStep = steps[steps.length - 1];
    if (now - lastStep <= C.roadmap_done.window_days * DAY) add('roadmap_done', `roadmap_done:${(m.roadmap && m.roadmap.generatedAt) || day(lastStep)}`, 'Finished the whole 30-day roadmap', { track: m.trackName || m.track || null });
  }

  // Scheduled cancellation: one honest note, never a step in the way of cancelling.
  if (b.cancelAtPeriodEnd && isPaid(m)) {
    const tenure = days(paidSince, now);
    const builderWorthIt = m.tier === 'builder' && tenure != null && tenure >= C.cancel_scheduled.builder_min_tenure_days && steps.length >= C.cancel_scheduled.builder_min_steps;
    if (m.tier === 'circle' || builderWorthIt) {
      add('cancel_scheduled', `cancel_scheduled:${(b.currentPeriodEnd || '').slice(0, 10)}`, `Cancels on ${(b.currentPeriodEnd || '').slice(0, 10) || 'period end'}`, { periodEnd: b.currentPeriodEnd || null, tenureDays: tenure, cancelReason: b.cancelReason || null });
    }
  }

  // Circle attendance: missed the last N calls in a row.
  if (m.tier === 'circle' && !paused) {
    const n = C.circle_missed.missed_in_a_row;
    const att = list(m.circle && m.circle.attendance).slice(-n);
    if (att.length === n && att.every((a) => a && a.attended === false)) {
      add('circle_missed', `circle_missed:${att[att.length - 1].date || today}`, `Missed the last ${n} Circle calls`, { dates: att.map((a) => a.date) });
    }
  }

  // Paying and at risk (not leaving, paused or in payment trouble, which have their own handling).
  const r = ctx.risk;
  if (!paused && !pauseSoon && r && r.level === 'high' && !b.cancelAtPeriodEnd && !b.paymentIssue) {
    add('at_risk', `at_risk:${today}`, `Churn risk ${r.score}: ${r.reasons.slice(0, 2).map((x) => x.label).join('; ')}`, { score: r.score, reasons: r.reasons.map((x) => x.label), next: p.next });
  } else if (!paused && !pauseSoon && isPaid(m) && (st === 'drifting' || st === 'stalled') && !b.cancelAtPeriodEnd) {
    // Paying and drifting but not yet high risk: a lighter "what's in the way" note.
    add('stuck_paid', `stuck_paid:${today}`, `Paying member, ${st} (${n(days(effectiveLastActiveMs(m, now), now), 'day')} quiet)`, { next: p.next });
  }

  // First win ever posted: a reply from Eli while it is fresh.
  const wins = list(m.wins)
    .filter((x) => x && ms(x.at || x.createdAt) != null)
    .sort((x, y) => ms(x.at || x.createdAt) - ms(y.at || y.createdAt));
  const firstWin = wins[0];
  if (firstWin && (firstWin.status == null || firstWin.status === 'live')) {
    const t = ms(firstWin.at || firstWin.createdAt);
    if (now - t <= C.first_win.window_days * DAY) add('first_win', `first_win:${firstWin.id || day(t)}`, 'Posted their first win', { winId: firstWin.id || null, at: iso(t) });
  }

  // Day-3 note for new Builders (founder hello while the decision is fresh).
  if (m.tier === 'builder' && paidSince != null && !paused) {
    const d = days(paidSince, now);
    if (d >= C.builder_day3.days_after_paid && d < C.builder_day3.days_after_paid + C.builder_day3.window_days) {
      add('builder_day3', 'builder_day3', `Builder for ${n(d, 'day')}`, { stepsDone: p.done, next: p.next });
    }
  }

  // Win-back: Builders get Flow J's offer (Offer and conversion O7). Eli's own note goes only to the
  // plans in config (default: former Circle members), well after that, and never to anyone refunded.
  if (!isPaid(m) && !b.refundedAt) {
    const exit = lastExit(m);
    const paidDays = paidDaysBeforeCancel(m);
    const tiers = list(C.winback.tiers);
    if (exit && exit.at != null && paidDays != null && paidDays >= C.winback.min_paid_days && (!tiers.length || tiers.includes(exit.from))) {
      const since = days(exit.at, now);
      if (since >= C.winback.after_days && since < C.winback.after_days + C.winback.window_days) {
        add('winback', `winback:${day(exit.at)}`, `Left the ${exit.from || 'paid'} plan ${n(since, 'day')} ago after ${n(paidDays, 'paid day')}`, { offer: C.winback.offer, paidDays, formerTier: exit.from });
      }
    }
  }

  // Circle fit: engaged, said yes to a weekly call, real progress, and a seat is open.
  if (m.tier !== 'circle' && !paused && (!C.circle_fit.needs_open_seat || ctx.circleSeatsLeft > 0)) {
    const wants = m.answers && m.answers.circle_interest === 'yes';
    const applied = m.circle && m.circle.application;
    const milestones = values(m.milestones).length;
    if (wants && !applied && milestones >= C.circle_fit.min_milestones && st === 'active') {
      add('circle_fit', 'circle_fit', `Said yes to a weekly call, ${milestones} milestones, active`, { milestones });
    }
  }

  return out.sort((a, b2) => b2.priority - a.priority);
}

// Only one note per member per run, and a quiet period between notes,
// except for the urgent kinds (priority at or above cooldown_exempt_priority).
// Notes that never reached the member (discarded, held out) don't start the quiet period.
function pickCheckin(m, now, cfg, candidates) {
  if (!candidates.length) return null;
  const top = candidates[0];
  if (top.priority >= cfg.caps.cooldown_exempt_priority) return top;
  const last = lastTouchMs(m, isContact);
  if (last != null && now - last < cfg.caps.per_member_cooldown_days * DAY) return null;
  return top;
}

// ---------- in-app nudge (dashboard card, no email) ----------

function nudge(m, now, cfg) {
  const st = stage(m, now, cfg);
  const p = roadmapProgress(m);
  const next = p.next;
  const nextLine = next ? `Next step: ${next.title}${next.week ? ` (week ${next.week})` : ''}.` : null;
  if (st === 'paused') {
    const pause = pauseInfo(m, now);
    return { kind: 'paused', title: `Paused until ${day(pause.end)}`, body: 'Your roadmap and progress are saved. When you are back, you start at your next step.', cta: { label: 'See my roadmap', href: '/app#roadmap' } };
  }
  if (st === 'signed_up') return { kind: 'build_roadmap', title: 'Your roadmap takes two minutes', body: 'Answer a few taps and get your 30-day plan.', cta: { label: 'Build my roadmap', href: '/start' } };
  if (st === 'onboarded') return { kind: 'first_step', title: 'Do step one today', body: nextLine || 'Your first step is small on purpose.', cta: { label: 'Start step one', href: '/app#roadmap' } };
  if (st === 'drifting' || st === 'stalled' || st === 'dormant') {
    const idle = days(effectiveLastActiveMs(m, now), now);
    return { kind: 'come_back', title: `Welcome back. ${idle} days is fine.`, body: `${nextLine || 'Pick up where you left off.'} One step, then stop if you want.`, cta: { label: 'Do one step', href: '/app#roadmap' } };
  }
  if (st === 'roadmap_done') return { kind: 'next_30', title: 'You finished the 30 days', body: 'Retake the assessment to plan your next 30, and post the win.', cta: { label: 'Plan my next 30 days', href: '/app/assessment' } };
  // Active: close to a weekly finish line?
  const w = m.roadmap && list(m.roadmap.weeks).find((x) => x && x.done < x.total);
  if (w && w.total - w.done === 1) return { kind: 'finish_week', title: `One step from finishing week ${w.week}`, body: nextLine || '', cta: { label: 'Finish the week', href: '/app#roadmap' } };
  return null;
}

// ---------- one member ----------

function analyzeMember(m, opts = {}) {
  const cfg = opts.cfg || config(opts.config);
  const now = ms(opts.now) || Date.now();
  const r = risk(m, now, cfg);
  const st = stage(m, now, cfg);
  const candidates = candidateCheckins(m, now, cfg, { risk: r, circleSeatsLeft: opts.circleSeatsLeft == null ? 1 : opts.circleSeatsLeft });
  // The comparison group gets nothing where the rest would get a rescue note; the note is logged instead.
  const due = pickCheckin(m, now, cfg, candidates);
  const steps = stepTimes(m);
  const last = effectiveLastActiveMs(m, now);
  const b = billing(m);
  return {
    id: m.id,
    email: m.email,
    firstName: firstName(m),
    tier: m.tier || 'free',
    track: m.trackName || m.track || null,
    stage: st,
    lastActiveAt: iso(last),
    daysQuiet: days(last, now),
    daysSinceSignup: days(ms(m.createdAt), now),
    paidDays: isPaid(m) ? days(paidSinceMs(m), now) : null,
    progress: roadmapProgress(m),
    steps7: countBetween(steps, now - 7 * DAY, now + 1),
    steps14: countBetween(steps, now - 14 * DAY, now + 1),
    milestones: Object.keys(isObj(m.milestones) ? m.milestones : {}),
    foundingMember: !!m.foundingMember,
    challengeFinisher: challengeFinisher(m),
    paymentIssue: !!b.paymentIssue,
    cancelAtPeriodEnd: !!b.cancelAtPeriodEnd,
    paused: st === 'paused',
    refunded: !!b.refundedAt,
    holdoutGroup: inHoldout(m, cfg),
    risk: r,
    checkin: due && !due.holdout ? due : null,
    heldOut: due && due.holdout ? due : null,
    otherCheckins: candidates.filter((c) => c !== due).map((c) => c.kind),
    nudge: nudge(m, now, cfg),
  };
}

// ---------- activation (research change R09) ----------

// A paying member counts as activated with 3 roadmap steps done by day 7 of paying
// (steps carried over from the Day One Challenge or done before upgrading count too).
// Null until the member has paid for 7 days.
function activatedBy7(m, now) {
  const paid = paidSinceMs(m);
  if (paid == null || now - paid < 7 * DAY) return null;
  return stepTimes(m).filter((t) => t <= paid + 7 * DAY).length >= 3;
}

// ---------- the whole feed ----------

function buildQueues(feed, opts = {}) {
  const cfg = config(opts.config);
  const now = ms(opts.now) || Date.now();
  const members = list(feed && feed.members);
  const app = (feed && feed.app) || {};
  const seats = app.circleSeatsLeft == null ? 0 : app.circleSeatsLeft; // unknown seat count: invite nobody
  const analyzed = members.map((m) => analyzeMember(m, { cfg, now, circleSeatsLeft: seats }));

  // Personal notes: highest priority first, at most drafts_per_day,
  // and at most `per_run` of the low-priority "apply to the Circle" invitations.
  const due = analyzed.filter((a) => a.checkin).sort((a, b) => b.checkin.priority - a.checkin.priority || (b.risk ? b.risk.score : 0) - (a.risk ? a.risk.score : 0));
  const checkins = [];
  const deferred = [];
  let fit = 0;
  for (const a of due) {
    if (a.checkin.kind === 'circle_fit' && fit >= cfg.checkins.circle_fit.per_run) {
      deferred.push(a);
      continue;
    }
    if (checkins.length >= cfg.caps.drafts_per_day) {
      deferred.push(a);
      continue;
    }
    if (a.checkin.kind === 'circle_fit') fit++;
    checkins.push(a);
  }

  const paid = analyzed.filter((a) => a.tier !== 'free');
  const byStage = {};
  for (const a of analyzed) byStage[a.stage] = (byStage[a.stage] || 0) + 1;
  const tiers = { free: 0, builder: 0, circle: 0 };
  for (const a of analyzed) tiers[a.tier] = (tiers[a.tier] || 0) + 1;
  const onboarded = analyzed.filter((a) => a.stage !== 'signed_up').length;
  const activated = members.filter((m) => m.activatedAt || stepTimes(m).length).length;
  const scored = (a) => a.risk && (a.risk.level === 'high' || a.risk.level === 'watch');
  // Activation for members who started paying in the last 60 days and have had 7 days to get going.
  const recentPayers = members.filter((m) => {
    const p = paidSinceMs(m);
    return p != null && now - p >= 7 * DAY && now - p <= 60 * DAY;
  });
  const activatedRecent = recentPayers.filter((m) => activatedBy7(m, now)).length;

  const wins = list(feed && feed.wins);
  const tickets = list(feed && feed.tickets);
  const heldOut = analyzed.filter((a) => a.heldOut);
  return {
    generatedAt: iso(now),
    counts: {
      members: analyzed.length,
      tiers,
      stages: byStage,
      onboardedPct: analyzed.length ? Math.round((onboarded / analyzed.length) * 100) : 0,
      activatedPct: onboarded ? Math.round((activated / onboarded) * 100) : 0,
      paidAtRisk: paid.filter(scored).length,
      paidLeaving: paid.filter((a) => a.cancelAtPeriodEnd).length,
      paidPaused: paid.filter((a) => a.paused).length,
      paymentIssues: paid.filter((a) => a.paymentIssue).length,
      challengeFinishers: analyzed.filter((a) => a.challengeFinisher).length,
      activation7d: { eligible: recentPayers.length, activated: activatedRecent, pct: recentPayers.length ? Math.round((activatedRecent / recentPayers.length) * 100) : null },
      checkinsDue: due.length,
      checkinsDeferred: deferred.length,
      heldOut: heldOut.length,
      winsToReview: wins.filter((w) => w.status === 'held' || w.status === 'reported').length,
      ticketsOpen: tickets.filter((t) => t.status === 'open' || t.status === 'new').length,
    },
    checkins: checkins.map((a) => ({ ...a.checkin, member: pick(a) })),
    deferred: deferred.map((a) => ({ kind: a.checkin.kind, memberId: a.id, priority: a.checkin.priority })),
    heldOut: heldOut.map((a) => ({ kind: a.heldOut.kind, key: a.heldOut.key, memberId: a.id, reason: a.heldOut.reason })),
    atRisk: paid.filter(scored).sort((a, b) => b.risk.score - a.risk.score).map((a) => ({ ...pick(a), risk: a.risk })),
    paymentIssues: paid.filter((a) => a.paymentIssue).map(pick),
    leaving: paid.filter((a) => a.cancelAtPeriodEnd).map(pick),
    paused: paid.filter((a) => a.paused).map(pick),
    moderation: wins.filter((w) => w.status === 'held' || w.status === 'reported'),
    tickets: tickets.filter((t) => t.status === 'open' || t.status === 'new'),
    nudges: analyzed.filter((a) => a.nudge).reduce((acc, a) => ((acc[a.nudge.kind] = (acc[a.nudge.kind] || 0) + 1), acc), {}),
  };
}

// The member facts a drafting agent needs, and nothing else.
function pick(a) {
  return {
    id: a.id, email: a.email, firstName: a.firstName, tier: a.tier, track: a.track, stage: a.stage,
    daysQuiet: a.daysQuiet, paidDays: a.paidDays, progress: a.progress, steps14: a.steps14,
    milestones: a.milestones, foundingMember: a.foundingMember, challengeFinisher: a.challengeFinisher,
    holdoutGroup: a.holdoutGroup,
  };
}

module.exports = {
  DEFAULTS, MILESTONE_LABELS, config, analyzeMember, buildQueues, stage, risk, nudge,
  activityTimes, lastActiveMs, paidSinceMs, canceledAtMs, candidateCheckins, inHoldout, bucket, activatedBy7,
};
