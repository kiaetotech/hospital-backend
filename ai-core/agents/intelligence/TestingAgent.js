// D:\hospital backend\ai-core\agents\intelligence\TestingAgent.js

const { AgentRole, AgentStatus } = require('../../../shared/types/AgentTypes');
const { BaseAgent } = require('../base/BaseAgent');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

class TestingAgent extends BaseAgent {
  constructor(providerManager) {
    super({
      name: 'Testing Agent',
      role: 'testing',
      capabilities: [
        { name: 'test_models', description: 'Test all model files load correctly', priority: 1, estimatedLatency: 300, requiresAuth: false },
        { name: 'test_routes', description: 'Test all route files load correctly', priority: 1, estimatedLatency: 300, requiresAuth: false },
        { name: 'test_all_flows', description: 'Test all 20 business flows end-to-end', priority: 1, estimatedLatency: 5000, requiresAuth: false },
        { name: 'generate_report', description: 'Generate detailed error report with fixes', priority: 1, estimatedLatency: 500, requiresAuth: false }
      ]
    }, providerManager);

    this.baseURL = 'https://hospital-backend-production-f1b1.up.railway.app';
    this.results = { models: null, routes: null, flows: [], summary: {} };
  }

  async execute(request) {
    this.setStatus(AgentStatus.BUSY);
    var task = request.task;
    var payload = request.payload || {};

    try {
      var result;
      if (task.includes('models')) result = await this.testModels();
      else if (task.includes('routes')) result = await this.testRoutes();
      else if (task.includes('flows') || task.includes('all')) result = await this.testAllFlows();
      else if (task.includes('report')) result = await this.generateReport();
      else result = await this.testAll();

      this.setStatus(AgentStatus.IDLE);
      this.setCurrentTask(null);
      return { success: true, data: result, sourceAgent: this.id };
    } catch (error) {
      this.setStatus(AgentStatus.IDLE);
      return { success: false, error: error.message, sourceAgent: this.id };
    }
  }

  async testModels() {
    var modelsDir = path.join(__dirname, '..', '..', '..', 'models');
    var files = fs.readdirSync(modelsDir).filter(function(f) { return f.endsWith('.js'); });
    var results = [];

    for (var i = 0; i < files.length; i++) {
      var file = files[i];
      try {
        require(path.join(modelsDir, file));
        results.push({ file: file, status: '✅ PASS' });
      } catch (e) {
        results.push({ file: file, status: '❌ FAIL', error: e.message.substring(0, 100) });
      }
    }

    this.results.models = results;
    return { type: 'Models', total: results.length, passed: results.filter(function(r) { return r.status.includes('PASS'); }).length, failed: results.filter(function(r) { return r.status.includes('FAIL'); }).length, details: results };
  }

  async testRoutes() {
    var routesDir = path.join(__dirname, '..', '..', '..', 'routes');
    var files = fs.readdirSync(routesDir).filter(function(f) { return f.endsWith('.js'); });
    var results = [];

    for (var i = 0; i < files.length; i++) {
      var file = files[i];
      try {
        require(path.join(routesDir, file));
        results.push({ file: file, status: '✅ PASS' });
      } catch (e) {
        results.push({ file: file, status: '❌ FAIL', error: e.message.substring(0, 100) });
      }
    }

    this.results.routes = results;
    return { type: 'Routes', total: results.length, passed: results.filter(function(r) { return r.status.includes('PASS'); }).length, failed: results.filter(function(r) { return r.status.includes('FAIL'); }).length, details: results };
  }

  async testEndpoint(method, url, data, name) {
    try {
      var config = { method: method, url: this.baseURL + url, timeout: 5000, validateStatus: function() { return true; } };
      if (data) config.data = data;
      var response = await axios(config);
      var success = response.status >= 200 && response.status < 500;
      return { flow: name, endpoint: method + ' ' + url, status: success ? '✅ PASS' : '⚠️ ' + response.status, responseStatus: response.status, message: success ? 'OK' : (response.data && response.data.message ? response.data.message : 'Error') };
    } catch (e) {
      return { flow: name, endpoint: method + ' ' + url, status: '❌ FAIL', error: e.code === 'ECONNREFUSED' ? 'Server not running' : e.message.substring(0, 80) };
    }
  }

  async testAllFlows() {
    this.results.flows = [];
    var self = this;

    // 1. Hospital Search
    this.results.flows.push(await this.testEndpoint('GET', '/api/hospitals/search?city=Mumbai', null, '🏥 Hospital Search'));
    this.results.flows.push(await this.testEndpoint('GET', '/api/hospitals/search?specialty=Cardiology', null, '🏥 Hospital by Specialty'));
    this.results.flows.push(await this.testEndpoint('GET', '/api/hospitals/medical-data', null, '🏥 Medical Data'));

    // 2. AI Agents
    this.results.flows.push(await this.testEndpoint('GET', '/api/ai/agents', null, '🤖 List AI Agents'));
    this.results.flows.push(await this.testEndpoint('GET', '/api/ai/health', null, '🤖 AI Health'));

    // 3. Auth
    this.results.flows.push(await this.testEndpoint('POST', '/api/auth/login', { email: 'test@test.com', password: 'test123' }, '🔑 Login'));
    this.results.flows.push(await this.testEndpoint('POST', '/api/otp/send', { phone: '9876543210' }, '📱 Send OTP'));

    // 4. Bookings
    this.results.flows.push(await this.testEndpoint('POST', '/api/bookings/create', { patientName: 'Test', patientPhone: '9876543210', patientAge: 30, patientGender: 'Male' }, '📋 Create Booking'));

    // 5. Payment
    this.results.flows.push(await this.testEndpoint('POST', '/api/payment/create-order', { amount: 500, bookingType: 'opd', bookingId: 'test123' }, '💳 Create Payment'));

    // 6. Ambulance
    this.results.flows.push(await this.testEndpoint('GET', '/api/ambulance/nearby-ambulances', null, '🚑 Nearby Ambulances'));

    // 7. Diagnostics
    this.results.flows.push(await this.testEndpoint('GET', '/api/diagnostics/search?city=Mumbai', null, '🔬 Diagnostics Search'));

    // 8. Caregivers
    this.results.flows.push(await this.testEndpoint('GET', '/api/caregivers/search?city=Mumbai', null, '🏠 Caregiver Search'));

    // 9. Insurance
    this.results.flows.push(await this.testEndpoint('GET', '/api/insurance/plans', null, '🛡️ Insurance Plans'));

    // 10. Corporate
    this.results.flows.push(await this.testEndpoint('GET', '/api/corporate/plans', null, '🏢 Corporate Plans'));

    // 11. Mental Health
    this.results.flows.push(await this.testEndpoint('GET', '/api/mentalhealth/therapists', null, '🧠 Mental Health Therapists'));

    // 12. Online Doctor
    this.results.flows.push(await this.testEndpoint('GET', '/api/online-doctor/search', null, '📱 Online Doctor Search'));

    // 13. Ayurveda
    this.results.flows.push(await this.testEndpoint('GET', '/api/ayurveda/doctors', null, '🧘 Ayurveda Doctors'));

    // 14. Homeopathy
    this.results.flows.push(await this.testEndpoint('GET', '/api/homeopathy/doctors', null, '🌿 Homeopathy Doctors'));

    // 15. Loans
    this.results.flows.push(await this.testEndpoint('GET', '/api/loan/partners', null, '💰 Loan Partners'));

    // 16. Reviews
    this.results.flows.push(await this.testEndpoint('GET', '/api/reviews/provider/test123', null, '⭐ Provider Reviews'));

    // 17. Global Search
    this.results.flows.push(await this.testEndpoint('GET', '/api/search?q=hospital', null, '🔍 Global Search'));

    // 18. Admin
    this.results.flows.push(await this.testEndpoint('GET', '/api/admin/dashboard', null, '🔧 Admin Dashboard'));

    // 19. Employee Portal
    this.results.flows.push(await this.testEndpoint('GET', '/api/employee/dashboard', null, '👨‍💼 Employee Portal'));

    // 20. Hospital Status
    this.results.flows.push(await this.testEndpoint('GET', '/api/hospital-status', null, '🏥 Hospital Status'));

    var passed = this.results.flows.filter(function(f) { return f.status.includes('PASS'); }).length;
    var failed = this.results.flows.filter(function(f) { return f.status.includes('FAIL'); }).length;
    var warnings = this.results.flows.filter(function(f) { return f.status.includes('⚠️'); }).length;

    this.results.summary = {
      totalFlows: this.results.flows.length,
      passed: passed,
      warnings: warnings,
      failed: failed,
      healthPercentage: Math.round((passed / this.results.flows.length) * 100),
      overallStatus: failed === 0 ? (warnings === 0 ? '✅ HEALTHY' : '⚠️ MINOR ISSUES') : '❌ NEEDS FIXES'
    };

    return this.results;
  }

  async testAll() {
    await this.testModels();
    await this.testRoutes();
    await this.testAllFlows();
    return this.results;
  }

  async generateReport() {
    if (!this.results.flows || this.results.flows.length === 0) {
      await this.testAll();
    }

    var prompt = 'Analyze this test report and provide specific fixes:\n' +
      JSON.stringify(this.results, null, 2) + '\n\n' +
      'For each FAILED test, provide:\n' +
      '1. The exact file that needs fixing\n' +
      '2. The git command to restore it if available\n' +
      '3. Priority (Critical/High/Medium/Low)';

    var response = await this.providerManager.generate(prompt);

    return {
      summary: this.results.summary,
      models: this.results.models ? { passed: this.results.models.filter(function(r) { return r.status.includes('PASS'); }).length, failed: this.results.models.filter(function(r) { return r.status.includes('FAIL'); }) } : null,
      routes: this.results.routes ? { passed: this.results.routes.filter(function(r) { return r.status.includes('PASS'); }).length, failed: this.results.routes.filter(function(r) { return r.status.includes('FAIL'); }) } : null,
      flows: this.results.flows,
      aiAnalysis: response.content,
      provider: response.provider
    };
  }

  getRequiredCapability(task) {
    if (task.includes('models')) return 'test_models';
    if (task.includes('routes')) return 'test_routes';
    if (task.includes('flows') || task.includes('all')) return 'test_all_flows';
    return 'generate_report';
  }
}

module.exports = { TestingAgent };