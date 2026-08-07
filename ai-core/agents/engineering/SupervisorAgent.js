const { AgentRole, AgentStatus } = require('../../../shared/types/AgentTypes');
const { BaseAgent } = require('../base/BaseAgent');
const axios = require('axios');

class SupervisorAgent extends BaseAgent {
  constructor(providerManager) {
    super({
      name: 'Supervisor Agent',
      role: 'engineering_supervisor',
      capabilities: [
        { name: 'run_all_tests', description: 'Run all engineering agents and produce unified report', priority: 1, estimatedLatency: 30000 },
        { name: 'quick_health_check', description: 'Fast 30-second health check', priority: 1, estimatedLatency: 5000 },
        { name: 'nightly_audit', description: 'Complete system audit with recommendations', priority: 2, estimatedLatency: 60000 }
      ]
    }, providerManager);
    this.baseURL = 'https://hospital-backend-production-f1b1.up.railway.app';
  }

  async execute(request) {
    this.setStatus(AgentStatus.BUSY);
    try {
      var result;
      if (request.task.includes('quick')) result = await this.quickHealthCheck();
      else if (request.task.includes('nightly')) result = await this.nightlyAudit();
      else result = await this.runAllTests();
      this.setStatus(AgentStatus.IDLE);
      return { success: true, data: result, sourceAgent: this.id };
    } catch (e) {
      this.setStatus(AgentStatus.IDLE);
      return { success: false, error: e.message };
    }
  }

  async runAllTests() {
    this.log('🔍 SUPERVISOR: Starting full system audit...', 'info');
    var report = { timestamp: new Date().toISOString(), sections: {}, overallScore: 0, maxScore: 0 };

    // 1. API Tests
    this.log('📡 Running API tests...', 'info');
    try {
      var apiResp = await axios.post(this.baseURL + '/api/ai/apitest', { task: 'test_all_apis' });
      report.sections.api = apiResp.data?.data || { error: 'API test failed' };
    } catch (e) { report.sections.api = { error: e.message }; }

    // 2. Flow Tests (all 11 tags)
    this.log('🔄 Running flow tests...', 'info');
    try {
      var flowResp = await axios.post(this.baseURL + '/api/ai/flowtest', { task: 'test_all_flows' });
      report.sections.flows = flowResp.data?.data || { error: 'Flow test failed' };
    } catch (e) { report.sections.flows = { error: e.message }; }

    // 3. Auth Tests
    this.log('🔑 Running auth tests...', 'info');
    try {
      var authResp = await axios.post(this.baseURL + '/api/ai/authtest', { task: 'test_all_auth' });
      report.sections.auth = authResp.data?.data || { error: 'Auth test failed' };
    } catch (e) { report.sections.auth = { error: e.message }; }

    // 4. Frontend Sync
    this.log('🔗 Checking frontend-backend sync...', 'info');
    try {
      var syncResp = await axios.post(this.baseURL + '/api/ai/synctest', { task: 'scan_all_apis' });
      report.sections.frontendSync = syncResp.data?.data || { error: 'Sync test failed' };
    } catch (e) { report.sections.frontendSync = { error: e.message }; }

    // 5. Quick route check
    this.log('📋 Checking routes...', 'info');
    try {
      var routeResp = await axios.post(this.baseURL + '/api/ai/test', { task: 'test routes' });
      report.sections.routes = { passed: routeResp.data?.data?.passed, total: routeResp.data?.data?.total };
    } catch (e) { report.sections.routes = { error: e.message }; }

    // 6. Quick model check
    try {
      var modelResp = await axios.post(this.baseURL + '/api/ai/test', { task: 'test models' });
      report.sections.models = { passed: modelResp.data?.data?.passed, total: modelResp.data?.data?.total };
    } catch (e) { report.sections.models = { error: e.message }; }

    // Calculate overall score
    var scores = [];
    if (report.sections.routes?.passed) scores.push({ name: 'Routes', score: report.sections.routes.passed, max: report.sections.routes.total });
    if (report.sections.models?.passed) scores.push({ name: 'Models', score: report.sections.models.passed, max: report.sections.models.total });
    if (report.sections.api?.passed) scores.push({ name: 'APIs', score: report.sections.api.passed, max: report.sections.api.total });
    if (report.sections.flows?.passed) scores.push({ name: 'Flows', score: report.sections.flows.passed, max: report.sections.flows.totalEndpoints || report.sections.flows.total });
    if (report.sections.auth?.tested) scores.push({ name: 'Auth', score: report.sections.auth.tested, max: report.sections.auth.totalRoles });

    for (var i = 0; i < scores.length; i++) { report.overallScore += scores[i].score; report.maxScore += scores[i].max; }

    var healthPercent = report.maxScore > 0 ? Math.round((report.overallScore / report.maxScore) * 100) : 0;
    
    report.status = healthPercent >= 95 ? '✅ PRODUCTION READY' : healthPercent >= 80 ? '⚠️ MINOR ISSUES' : healthPercent >= 60 ? '⚠️ NEEDS ATTENTION' : '❌ CRITICAL ISSUES';
    report.healthPercent = healthPercent;
    report.recommendation = healthPercent >= 95 ? 'System is ready for production deployment!' : 'Fix the failing sections before launch';

    this.log('✅ SUPERVISOR: Audit complete - ' + healthPercent + '% healthy', 'info');
    return report;
  }

  async quickHealthCheck() {
    var results = [];
    var endpoints = ['/api/hospitals', '/api/ai/health', '/api/auth/login', '/api/insurance/plans'];
    
    for (var i = 0; i < endpoints.length; i++) {
      try {
        var r = await axios({ method: i === 2 ? 'POST' : 'GET', url: this.baseURL + endpoints[i], timeout: 5000, data: i === 2 ? { email: 'test@test.com', password: 'test123' } : null, validateStatus: function(s) { return true; } });
        results.push({ endpoint: endpoints[i], status: r.status, healthy: r.status < 500 });
      } catch (e) { results.push({ endpoint: endpoints[i], status: 0, healthy: false }); }
    }
    
    var healthy = results.filter(function(r) { return r.healthy; }).length;
    return { checked: results.length, healthy: healthy, details: results, status: healthy === results.length ? '✅ Healthy' : '⚠️ Issues' };
  }

  async nightlyAudit() {
    return await this.runAllTests();
  }

  getRequiredCapability(task) {
    if (task.includes('quick')) return 'quick_health_check';
    if (task.includes('nightly')) return 'nightly_audit';
    return 'run_all_tests';
  }
}

module.exports = { SupervisorAgent };