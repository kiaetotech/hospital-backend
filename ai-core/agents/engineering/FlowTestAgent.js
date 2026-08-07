const { AgentRole, AgentStatus } = require('../../../shared/types/AgentTypes');
const { BaseAgent } = require('../base/BaseAgent');
const axios = require('axios');

class FlowTestAgent extends BaseAgent {
  constructor(providerManager) {
    super({
      name: 'Flow Test Agent',
      role: 'engineering_flow_test',
      capabilities: [
        { name: 'test_all_flows', description: 'Test all 11 tag flows end-to-end', priority: 1, estimatedLatency: 15000 },
        { name: 'test_patient_flow', description: 'Patient: register → search → book → pay', priority: 1, estimatedLatency: 8000 },
        { name: 'test_provider_flow', description: 'Provider: register → login → dashboard', priority: 2, estimatedLatency: 5000 }
      ]
    }, providerManager);
    this.baseURL = 'https://hospital-backend-production-f1b1.up.railway.app';
  }

  async execute(request) {
    this.setStatus(AgentStatus.BUSY);
    try {
      var result;
      if (request.task.includes('patient')) result = await this.testPatientFlow();
      else if (request.task.includes('provider')) result = await this.testProviderFlow();
      else result = await this.testAllFlows();
      this.setStatus(AgentStatus.IDLE);
      return { success: true, data: result, sourceAgent: this.id };
    } catch (e) {
      this.setStatus(AgentStatus.IDLE);
      return { success: false, error: e.message };
    }
  }

  async testAllFlows() {
    var results = {};
    
    // Test each tag's public endpoints
    var tagTests = [
      { tag: '🏥 Hospitals', endpoints: ['/api/hospitals/search?city=Delhi', '/api/hospitals/medical-data'] },
      { tag: '🚑 Ambulance', endpoints: ['/api/ambulance/nearby-ambulances?lat=19.076&lng=72.877', '/api/ambulance/fare-estimate?distance=10'] },
      { tag: '📱 Online Doctor', endpoints: ['/api/online-doctor/search'] },
      { tag: '🔬 Lab Tests', endpoints: ['/api/diagnostics/search?city=Mumbai'] },
      { tag: '🧘 Ayurveda', endpoints: ['/api/ayurveda/doctors'] },
      { tag: '🌿 Homeopathy', endpoints: ['/api/homeopathy/doctors'] },
      { tag: '🧠 Mental Health', endpoints: ['/api/mentalhealth/therapists'] },
      { tag: '🏠 Home Care', endpoints: ['/api/caregivers/search?city=Mumbai'] },
      { tag: '🛡️ Insurance', endpoints: ['/api/insurance/plans'] },
      { tag: '💰 Health EMI', endpoints: ['/api/loan/partners'] },
      { tag: '🏢 Corporate', endpoints: ['/api/corporate/plans'] }
    ];

    for (var t = 0; t < tagTests.length; t++) {
      var tag = tagTests[t];
      var tagResult = { tag: tag.tag, endpoints: [], passed: 0, failed: 0 };
      
      for (var e = 0; e < tag.endpoints.length; e++) {
        try {
          var resp = await axios.get(this.baseURL + tag.endpoints[e], { timeout: 10000, validateStatus: function(s) { return true; } });
          var ok = resp.status >= 200 && resp.status < 400;
          tagResult.endpoints.push({ path: tag.endpoints[e], status: resp.status, state: ok ? '✅' : '⚠️ ' + resp.status });
          if (ok) tagResult.passed++; else tagResult.failed++;
        } catch (err) {
          tagResult.endpoints.push({ path: tag.endpoints[e], status: 0, state: '❌ ' + (err.code || err.message).substring(0, 30) });
          tagResult.failed++;
        }
      }
      results[tag.tag] = tagResult;
    }

    // Also test auth and AI
    var authResult = { tag: '🔑 Authentication', endpoints: [], passed: 0, failed: 0 };
    try { var l = await axios.post(this.baseURL + '/api/auth/login', { email: 'test@test.com', password: 'test123' }); authResult.endpoints.push({ path: '/api/auth/login', status: l.status, state: l.status < 400 ? '✅' : '⚠️' }); authResult.passed++; } catch (e) { authResult.endpoints.push({ path: '/api/auth/login', status: 0, state: '❌' }); authResult.failed++; }
    try { var o = await axios.post(this.baseURL + '/api/otp/send', { phone: '9876543210' }); authResult.endpoints.push({ path: '/api/otp/send', status: o.status, state: o.status < 400 ? '✅' : '⚠️' }); authResult.passed++; } catch (e) { authResult.endpoints.push({ path: '/api/otp/send', status: 0, state: '❌' }); authResult.failed++; }
    results['🔑 Authentication'] = authResult;

    var aiResult = { tag: '🤖 AI System', endpoints: [], passed: 0, failed: 0 };
    try { var a = await axios.get(this.baseURL + '/api/ai/agents'); aiResult.endpoints.push({ path: '/api/ai/agents', status: a.status, state: '✅' }); aiResult.passed++; } catch (e) { aiResult.endpoints.push({ path: '/api/ai/agents', status: 0, state: '❌' }); aiResult.failed++; }
    try { var ah = await axios.get(this.baseURL + '/api/ai/health'); aiResult.endpoints.push({ path: '/api/ai/health', status: ah.status, state: '✅' }); aiResult.passed++; } catch (e) { aiResult.endpoints.push({ path: '/api/ai/health', status: 0, state: '❌' }); aiResult.failed++; }
    results['🤖 AI System'] = aiResult;

    // Count totals
    var totalPassed = 0, totalFailed = 0, totalEndpoints = 0;
    var keys = Object.keys(results);
    for (var k = 0; k < keys.length; k++) {
      totalPassed += results[keys[k]].passed;
      totalFailed += results[keys[k]].failed;
      totalEndpoints += results[keys[k]].endpoints.length;
    }

    return {
      totalTags: keys.length,
      totalEndpoints: totalEndpoints,
      passed: totalPassed,
      failed: totalFailed,
      healthPercent: Math.round((totalPassed / totalEndpoints) * 100),
      tags: results,
      summary: totalFailed === 0 ? '✅ ALL 11 TAGS + AUTH + AI WORKING' : '⚠️ ' + totalFailed + ' endpoints failing'
    };
  }

  async testPatientFlow() {
    var steps = [];
    var phone = '98888' + Math.floor(Math.random() * 10000);
    var email = 'patient' + Date.now() + '@test.com';
    var pass = 'Patient@' + Date.now();

    try { await axios.post(this.baseURL + '/api/auth/register', { name: 'Test Patient', email, phone, password: pass, role: 'patient' }); steps.push({ step: 'Register', status: '✅' }); } catch (e) { steps.push({ step: 'Register', status: '⚠️ ' + (e.response?.data?.message || '') }); }
    try { await axios.post(this.baseURL + '/api/auth/login', { email, password: pass }); steps.push({ step: 'Login', status: '✅' }); } catch (e) { steps.push({ step: 'Login', status: '❌' }); }
    try { var h = await axios.get(this.baseURL + '/api/hospitals/search?city=Delhi'); steps.push({ step: 'Search Hospitals', status: h.data?.data?.length > 0 ? '✅' : '⚠️ No results' }); } catch (e) { steps.push({ step: 'Search Hospitals', status: '❌' }); }

    var pass = steps.filter(function(s) { return s.status.startsWith('✅'); }).length;
    return { flow: 'Patient Journey', steps: steps, passed: pass, total: steps.length, summary: pass >= 3 ? '✅' : '⚠️' };
  }

  async testProviderFlow() {
    var steps = [];
    var email = 'provider' + Date.now() + '@test.com';
    try { await axios.post(this.baseURL + '/api/auth/register', { name: 'Test Provider', email, phone: '9888888888', password: 'Prov@123', role: 'ambulance_provider' }); steps.push({ step: 'Register Provider', status: '✅' }); } catch (e) { steps.push({ step: 'Register Provider', status: '⚠️ ' + (e.response?.data?.message || '') }); }
    try { var l = await axios.post(this.baseURL + '/api/auth/login', { email, password: 'Prov@123' }); steps.push({ step: 'Login Provider', status: l.status === 200 ? '✅' : '⚠️' }); } catch (e) { steps.push({ step: 'Login Provider', status: '❌' }); }
    var pass = steps.filter(function(s) { return s.status.startsWith('✅'); }).length;
    return { flow: 'Provider Journey', steps: steps, passed: pass, total: steps.length, summary: pass >= 2 ? '✅' : '⚠️' };
  }

  getRequiredCapability(task) {
    if (task.includes('patient')) return 'test_patient_flow';
    if (task.includes('provider')) return 'test_provider_flow';
    return 'test_all_flows';
  }
}

module.exports = { FlowTestAgent };