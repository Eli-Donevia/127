// The ad accounts (BUILD-PLAN W11): Meta Ads, Google Ads and TikTok Ads, signed in through oauth.js.
// Reads: spend and results by ad or campaign, as numbers. Writes: a campaign created PAUSED, with no
// ads and nothing spending; the member turns it on in the ad platform, with a daily cap they set there.
// A write runs only from an `act` step the member approved (index.js), and lands in the Activity log.
//
// Google Ads also needs 127's developer token (GOOGLE_ADS_DEV_TOKEN), which Eli applies for.

const { AppError } = require('./apps');
const { META_V } = require('./oauth');

const GOOGLE_ADS_V = 'v21';
const TIKTOK_BASE = 'https://business-api.tiktok.com/open_api/v1.3';

const n = (v) => {
  const x = Number(v);
  return Number.isFinite(x) ? Math.round(x * 100) / 100 : 0;
};
const clip = (s, max) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, max);
const ymd = (d) => new Date(d).toISOString().slice(0, 10);
const range = (days) => ({ since: ymd(Date.now() - days * 864e5), until: ymd(Date.now() - 864e5) });

// One row per ad or campaign, the same shape for every platform, so the optimizer reads them alike.
const row = (r) => ({ id: String(r.id), name: clip(r.name, 200), campaign: clip(r.campaign || '', 200), spend: n(r.spend), impressions: Math.round(Number(r.impressions) || 0), clicks: Math.round(Number(r.clicks) || 0), results: n(r.results), frequency: r.frequency == null ? null : n(r.frequency), ctr: Number(r.impressions) > 0 ? n((100 * Number(r.clicks || 0)) / Number(r.impressions)) : 0, cpc: Number(r.clicks) > 0 ? n(Number(r.spend || 0) / Number(r.clicks)) : null, costPerResult: Number(r.results) > 0 ? n(Number(r.spend || 0) / Number(r.results)) : null });

// ---------- Meta Marketing API ----------

const META_OBJECTIVES = { traffic: 'OUTCOME_TRAFFIC', leads: 'OUTCOME_LEADS', sales: 'OUTCOME_SALES', awareness: 'OUTCOME_AWARENESS', engagement: 'OUTCOME_ENGAGEMENT' };
const actId = (id) => `act_${String(id || '').replace(/^act_/, '').replace(/\D/g, '')}`;

function metaAds(token, http) {
  const g = (path, opts = {}) => http('Meta', { url: `https://graph.facebook.com/${META_V}${path}`, ...opts, headers: { authorization: `Bearer ${token}` } });
  return {
    async accounts() {
      const out = await g('/me/adaccounts?fields=id,name,currency,account_status&limit=50');
      return (out.data || []).map((a) => ({ id: a.id, name: a.name, currency: a.currency, active: a.account_status === 1 }));
    },
    async insights(accountId, { days = 7 } = {}) {
      const q = new URLSearchParams({ level: 'ad', fields: 'ad_id,ad_name,campaign_name,spend,impressions,clicks,frequency,actions', time_range: JSON.stringify(range(days)), limit: '200' });
      const out = await g(`/${actId(accountId)}/insights?${q.toString()}`);
      return (out.data || []).map((r) => {
        const results = (r.actions || []).filter((a) => /purchase|lead|complete_registration/.test(a.action_type)).reduce((s, a) => s + Number(a.value || 0), 0);
        return row({ id: r.ad_id, name: r.ad_name, campaign: r.campaign_name, spend: r.spend, impressions: r.impressions, clicks: r.clicks, frequency: r.frequency, results });
      });
    },
    writes: {
      async draftCampaign({ accountId, name, objective = 'traffic' }) {
        const out = await g(`/${actId(accountId)}/campaigns`, { method: 'POST', form: { name: clip(name, 200), objective: META_OBJECTIVES[objective] || META_OBJECTIVES.traffic, status: 'PAUSED', special_ad_categories: '[]' } });
        return { id: String(out.id), status: 'PAUSED', url: `https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${actId(accountId).slice(4)}` };
      },
    },
  };
}

// ---------- Google Ads API ----------

function googleAds(token, http) {
  const dev = process.env.GOOGLE_ADS_DEV_TOKEN ? String(process.env.GOOGLE_ADS_DEV_TOKEN) : '';
  const cid = (id) => String(id || '').replace(/\D/g, '');
  const g = (path, opts = {}) => {
    if (!dev) throw new AppError("Google Ads isn't switched on yet (127 is waiting on Google's developer access).", 503);
    return http('Google Ads', { url: `https://googleads.googleapis.com/${GOOGLE_ADS_V}${path}`, ...opts, headers: { authorization: `Bearer ${token}`, 'developer-token': dev, ...(opts.loginId ? { 'login-customer-id': cid(opts.loginId) } : {}) } });
  };
  return {
    async accounts() {
      const out = await g('/customers:listAccessibleCustomers');
      return (out.resourceNames || []).map((r) => ({ id: r.split('/')[1], name: r.split('/')[1] }));
    },
    async insights(customerId, { days = 7 } = {}) {
      const { since, until } = range(days);
      const query = `SELECT campaign.id, campaign.name, metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions FROM campaign WHERE segments.date BETWEEN '${since}' AND '${until}'`;
      const out = await g(`/customers/${cid(customerId)}/googleAds:search`, { method: 'POST', body: { query } });
      return (out.results || []).map((r) => row({ id: r.campaign.id, name: r.campaign.name, campaign: r.campaign.name, spend: Number(r.metrics.costMicros || 0) / 1e6, impressions: r.metrics.impressions, clicks: r.metrics.clicks, results: r.metrics.conversions }));
    },
    writes: {
      // A small budget and a Search campaign, both created PAUSED in one call.
      async draftCampaign({ accountId, name, dailyBudget = 10 }) {
        const c = cid(accountId);
        const out = await g(`/customers/${c}/googleAds:mutate`, {
          method: 'POST',
          body: {
            mutateOperations: [
              { campaignBudgetOperation: { create: { resourceName: `customers/${c}/campaignBudgets/-1`, name: clip(`${name} budget`, 200), amountMicros: String(Math.round(Math.max(1, Number(dailyBudget) || 10) * 1e6)), deliveryMethod: 'STANDARD', explicitlyShared: false } } },
              { campaignOperation: { create: { name: clip(name, 200), status: 'PAUSED', advertisingChannelType: 'SEARCH', campaignBudget: `customers/${c}/campaignBudgets/-1`, manualCpc: {}, networkSettings: { targetGoogleSearch: true, targetSearchNetwork: false, targetContentNetwork: false } } } },
            ],
          },
        });
        const res = (out.mutateOperationResponses || []).find((r) => r.campaignResult);
        return { id: res ? res.campaignResult.resourceName.split('/').pop() : null, status: 'PAUSED', url: 'https://ads.google.com/aw/campaigns' };
      },
    },
  };
}

// ---------- TikTok Business API ----------

function tiktokAds(token, http, { accounts: known = [] } = {}) {
  const t = async (path, opts = {}) => {
    const out = await http('TikTok', { url: `${TIKTOK_BASE}${path}`, ...opts, headers: { 'access-token': token } });
    if (out && out.code !== 0) throw new AppError(`TikTok answered: ${clip(out.message || 'an error', 120)}.`, out.code === 40105 ? 401 : 400);
    return out.data || {};
  };
  return {
    async accounts() {
      return known.map((id) => ({ id, name: id }));
    },
    async insights(advertiserId, { days = 7 } = {}) {
      const { since, until } = range(days);
      const q = new URLSearchParams({ advertiser_id: String(advertiserId), report_type: 'BASIC', data_level: 'AUCTION_AD', dimensions: JSON.stringify(['ad_id']), metrics: JSON.stringify(['ad_name', 'campaign_name', 'spend', 'impressions', 'clicks', 'frequency', 'conversion']), start_date: since, end_date: until, page_size: '200' });
      const data = await t(`/report/integrated/get/?${q.toString()}`);
      return (data.list || []).map((r) => row({ id: r.dimensions.ad_id, name: r.metrics.ad_name, campaign: r.metrics.campaign_name, spend: r.metrics.spend, impressions: r.metrics.impressions, clicks: r.metrics.clicks, frequency: r.metrics.frequency, results: r.metrics.conversion }));
    },
    writes: {
      // DISABLE is TikTok's word for paused.
      async draftCampaign({ accountId, name, objective = 'TRAFFIC' }) {
        const data = await t('/campaign/create/', { method: 'POST', body: { advertiser_id: String(accountId), campaign_name: clip(name, 200), objective_type: String(objective).toUpperCase(), budget_mode: 'BUDGET_MODE_INFINITE', operation_status: 'DISABLE' } });
        return { id: String(data.campaign_id), status: 'PAUSED', url: 'https://ads.tiktok.com/i18n/perf/campaign' };
      },
    },
  };
}

const ADS = { meta_ads: metaAds, google_ads: googleAds, tiktok_ads: tiktokAds };

module.exports = { ADS, row, META_OBJECTIVES, GOOGLE_ADS_V };
