const { GoogleGenerativeAI } = require('@google/generative-ai');
const config = require('../../../config/config');

/**
 * Gemini AI Service
 * Powers all AI agent features: overview analysis, cost optimization, migration advice, and chat.
 */

let genAI = null;

function getModel(systemInstruction) {
  if (!config.gemini.apiKey || config.gemini.apiKey === 'your_gemini_api_key_here') {
    return null; // Will use placeholder responses
  }
  if (!genAI) {
    genAI = new GoogleGenerativeAI(config.gemini.apiKey);
  }
  const modelConfig = { model: 'gemini-2.5-flash' };
  if (systemInstruction) {
    modelConfig.systemInstruction = systemInstruction;
  }
  return genAI.getGenerativeModel(modelConfig);
}

// Placeholder when no API key
function placeholderResponse(type) {
  const responses = {
    overview: `🤖 **AI Cost Overview** (Demo Mode — Add GEMINI_API_KEY in .env for live AI)

**Top Cost Drivers:**
• Amazon EC2 / VMs are consuming the largest portion (~38-42%) of your cloud budget
• Database services (RDS/SQL) represent your second biggest expense at ~16-20%
• Storage costs are steadily growing — consider lifecycle policies

**Immediate Actions:**
1. 🔴 **Idle Resources**: Dev instances running 24/7 with <10% CPU — stop or schedule downtime
2. 🟡 **Storage Optimization**: Enable lifecycle policies on S3/Blob buckets for stale data
3. 🟢 **Right-sizing**: 2 instances flagged for right-sizing — potential savings of $80-120/month

**Projected Savings Potential**: $200-350/month with recommended optimizations`,

    instance: `🤖 **Instance Analysis** (Demo Mode)

This resource is consuming a significant portion of your budget. Key observations:
- CPU utilization suggests possible right-sizing opportunity
- Network egress contributes to data transfer costs
- Consider Reserved Instances for 1-3 year commitments to save 30-60% vs on-demand pricing`,

    migration: `🤖 **Cloud Migration Analysis** (Demo Mode)

Based on your current service usage:
- **Stay**: If your workloads are already optimized for your current cloud
- **Consider AWS**: Best for extensive managed services, largest ecosystem
- **Consider GCP**: Best if using BigQuery, ML/AI workloads (competitive pricing)
- **Consider Azure**: Best for Microsoft/Windows workloads, enterprise agreements

Add your GEMINI_API_KEY for personalized migration recommendations.`,

    chat: `I'm your Cloud Cost AI assistant (Demo Mode). To enable real AI responses, add your GEMINI_API_KEY to the .env file. Get a free API key at https://aistudio.google.com`
  };
  return responses[type] || responses.chat;
}

// ─── DASHBOARD OVERVIEW ANALYSIS ─────────────────────────────────────────────
async function generateOverview(cloudData, cloudProvider) {
  const m = getModel();
  if (!m) return placeholderResponse('overview');

  const summary = {
    cloud: cloudProvider,
    total_cost: cloudData.summary?.total_monthly_cost,
    top_services: cloudData.top_cost_services?.slice(0, 5),
    alerts: cloudData.alerts,
    services: Object.keys(cloudData.services || {}).map(key => ({
      name: cloudData.services[key].service_name,
      cost: cloudData.services[key].monthly_cost,
      trend: cloudData.services[key].trend,
      trend_percent: cloudData.services[key].trend_percent,
    })),
  };

  const prompt = `You are a cloud cost optimization expert AI. Analyze this ${cloudProvider.toUpperCase()} cloud account data and provide a concise, actionable overview.

Cloud Account Data:
${JSON.stringify(summary, null, 2)}

Provide:
1. **Top Cost Drivers** - which services are costing the most and why
2. **Cost Anomalies** - anything unusual or growing unexpectedly  
3. **Immediate Actions** - 3-5 specific cost-saving recommendations with estimated savings
4. **Risk Areas** - resources that could cause billing spikes

Format using markdown with emojis. Be specific with dollar amounts. Keep it under 400 words.`;

  try {
    const result = await m.generateContent(prompt);
    return result.response.text();
  } catch (err) {
    console.error('[Gemini] Overview generation failed:', err.message);
    return `Error from Google Gemini API: ${err.message}. Please check your API key validity and quota.`;
  }
}

// ─── INSTANCE DETAIL ANALYSIS ─────────────────────────────────────────────────
async function generateInstanceAnalysis(instanceData, cloudProvider) {
  const m = getModel();
  if (!m) return placeholderResponse('instance');

  const prompt = `You are a cloud cost optimization expert. Analyze this specific cloud resource and provide detailed optimization advice.

Cloud Provider: ${cloudProvider.toUpperCase()}
Resource Data:
${JSON.stringify(instanceData, null, 2)}

Provide:
1. **Cost Analysis** - breakdown of what's driving costs for this resource
2. **Utilization Assessment** - is it over/under utilized?
3. **Optimization Recommendations** - specific, actionable steps with estimated savings
4. **Alternatives** - better service types or configurations for this use case
5. **Risk Assessment** - any reliability or performance concerns

Be specific, use actual numbers from the data. Format with markdown and emojis. Under 350 words.`;

  try {
    const result = await m.generateContent(prompt);
    return result.response.text();
  } catch (err) {
    console.error('[Gemini] Instance analysis failed:', err.message);
    return `Error from Google Gemini API: ${err.message}`;
  }
}

// ─── MIGRATION RECOMMENDATION ────────────────────────────────────────────────
async function generateMigrationAdvice(currentCloudData, currentCloud, targetCloud) {
  const m = getModel();
  if (!m) return placeholderResponse('migration');

  const services = Object.values(currentCloudData.services || {}).map(s => ({
    name: s.service_name,
    cost: s.monthly_cost,
    trend: s.trend,
  }));

  const prompt = `You are a cloud migration expert. A customer is considering migrating from ${currentCloud.toUpperCase()} to ${targetCloud ? targetCloud.toUpperCase() : 'another cloud provider'}.

Current Cloud: ${currentCloud.toUpperCase()}
Current Monthly Spend: $${currentCloudData.summary?.total_monthly_cost}
Services Used:
${JSON.stringify(services, null, 2)}

Provide:
1. **Migration Feasibility** - is it a good idea based on their usage?
2. **Cost Comparison** - estimated costs on ${targetCloud || 'alternative clouds'}
3. **Service Mapping** - equivalent services on the target cloud
4. **Migration Risks** - potential challenges and mitigation strategies
5. **Recommendation** - clear go/no-go recommendation with reasoning

Be specific with cost comparisons. Use markdown with emojis. Under 500 words.`;

  try {
    const result = await m.generateContent(prompt);
    return result.response.text();
  } catch (err) {
    console.error('[Gemini] Migration advice failed:', err.message);
    return `Error from Google Gemini API: ${err.message}`;
  }
}

// ─── INTERACTIVE CHAT ────────────────────────────────────────────────────────
async function chat(userMessage, cloudData, chatHistory = []) {
  const systemContext = cloudData ? `
You are a Cloud Cost Optimization AI assistant. The user is asking about their cloud infrastructure.
Current Cloud Summary: ${JSON.stringify({
    cloud: cloudData.meta?.cloud,
    total_cost: cloudData.summary?.total_monthly_cost,
    top_services: cloudData.top_cost_services?.slice(0, 3),
    alerts: cloudData.alerts?.length,
  })}

Answer questions about their cloud costs, optimization strategies, and best practices. Be helpful, specific, and concise.
` : `You are a Cloud Cost Optimization AI assistant. Answer questions about cloud costs, optimization strategies, and best practices across AWS, Azure, and GCP. Be helpful and specific.`;

  const m = getModel(systemContext);
  if (!m) return placeholderResponse('chat');

  try {
    const chat = m.startChat({
      history: chatHistory.map(h => ({
        role: h.role,
        parts: [{ text: h.content }],
      }))
    });

    const result = await chat.sendMessage(userMessage);
    return result.response.text();
  } catch (err) {
    console.error('[Gemini] Chat failed:', err.message);
    return `I encountered an error processing your request. Please try again. (Error: ${err.message})`;
  }
}

// ─── BEST CLOUD RECOMMENDER ───────────────────────────────────────────────────
async function recommendBestCloud(multiCloudData) {
  const m = getModel();
  if (!m) return placeholderResponse('migration');

  const summary = Object.entries(multiCloudData).map(([cloud, data]) => ({
    cloud,
    total_cost: data.summary?.total_monthly_cost || 0,
    services: Object.keys(data.services || {}).length,
    alerts: data.alerts?.length || 0,
    top_services: data.top_cost_services?.slice(0, 3) || [],
  }));

  const prompt = `You are a multi-cloud expert. Analyze these cloud accounts and recommend the best cloud platform for their workloads.

Cloud Accounts Data:
${JSON.stringify(summary, null, 2)}

Provide:
1. **Cost Comparison Table** (markdown table)
2. **Best Cloud for Current Workloads** with reasoning
3. **Optimization Opportunities** on current clouds vs migrating
4. **Hybrid Strategy** if applicable

Be data-driven and specific. Use markdown. Under 400 words.`;

  try {
    const result = await m.generateContent(prompt);
    return result.response.text();
  } catch (err) {
    console.error('[Gemini] Best cloud recommendation failed:', err.message);
    return `Error from Google Gemini API: ${err.message}`;
  }
}

module.exports = { generateOverview, generateInstanceAnalysis, generateMigrationAdvice, chat, recommendBestCloud };
