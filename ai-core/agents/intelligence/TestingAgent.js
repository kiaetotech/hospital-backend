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
        { name: 'test_e2e', description: 'Full end-to-end patient journey test', priority: 1, estimatedLatency: 10000, requiresAuth: false },
        { name: 'generate_report', description: 'Generate detailed error report with fixes', priority: 1, estimatedLatency: 500, requiresAuth: false }
      ]
    }, providerManager);

    this.baseURL = 'https://hospital-backend-production-f1b1.up.railway.app';
    this.results = { models: null, routes: null, flows: [], e2e: [], summary: {} };
    this.testToken = null;
  }

       async execute(request) {
    this.setStatus(AgentStatus.BUSY);
    var task = request.task;
    var payload = request.payload || {};

    try {
      var result;
      if (task.includes('models')) result = await this.testModels();
      else if (task.includes('routes')) result = await this.testRoutes();
      else if (task.includes('e2e') || task.includes('journey') || task.includes('patient')) result = await this.testE2EFlows();
      else if (task.includes('production') || task.includes('audit') || task.includes('full scan')) result = await this.productionScan();
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

  async testEndpoint(method, url, data, name, token) {
    try {
      var headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = 'Bearer ' + token;
      var config = { method: method, url: this.baseURL + url, headers: headers, timeout: 10000, validateStatus: function() { return true; } };
      if (data) config.data = data;
      var response = await axios(config);
      var success = response.status >= 200 && response.status < 400;
      return { flow: name, endpoint: method + ' ' + url, status: success ? '✅ PASS' : '⚠️ ' + response.status, responseStatus: response.status, data: response.data, message: success ? 'OK' : (response.data && response.data.message ? response.data.message : 'Error') };
    } catch (e) {
      return { flow: name, endpoint: method + ' ' + url, status: '❌ FAIL', error: e.code === 'ECONNREFUSED' ? 'Server not running' : e.message.substring(0, 80) };
    }
  }

  // FULL END-TO-END PATIENT JOURNEY
  async testE2EFlows() {
    this.results.e2e = [];
    var journeyResults = {};
    var testPhone = '88888' + Math.floor(Math.random() * 100000);
    var testEmail = 'e2e' + Date.now() + '@test.com';
    var testPassword = 'Pass@' + Date.now();

    this.log('🧪 E2E TEST: Patient Registration → Booking → Payment', 'info');

    // Step 1: Send OTP
    var otp = await this.testEndpoint('POST', '/api/otp/send', { phone: testPhone }, '📱 Send OTP');
    this.results.e2e.push(otp);

    // Step 2: Register user
    var register = await this.testEndpoint('POST', '/api/auth/register', {
      name: 'E2E Patient', email: testEmail, phone: testPhone, password: testPassword
    }, '📝 Register');
    this.results.e2e.push(register);

    if (register.data && register.data.token) {
      this.testToken = register.data.token;
    }

    // Step 3: Login
    var login = await this.testEndpoint('POST', '/api/auth/login', {
      email: testEmail, password: testPassword
    }, '🔑 Login');
    this.results.e2e.push(login);
    if (login.data && login.data.token) this.testToken = login.data.token;

    // Step 4: Search Hospitals
    var hospitals = await this.testEndpoint('GET', '/api/hospitals/search?city=Delhi', null, '🏥 Search Hospitals');
    this.results.e2e.push(hospitals);

    // Step 5: Create Booking
    var booking = await this.testEndpoint('POST', '/api/bookings/create', {
      patientName: 'E2E Patient', patientPhone: testPhone, patientAge: 30,
      patientGender: 'Male', bookingType: 'opd', appointmentDate: new Date().toISOString().split('T')[0], slot: '10:00 AM'
    }, '📋 Create Booking', this.testToken);
    this.results.e2e.push(booking);

    // Step 6: Insurance
    var insurance = await this.testEndpoint('GET', '/api/insurance/plans', null, '🛡️ Insurance');
    this.results.e2e.push(insurance);

    // Step 7: Corporate
    var corporate = await this.testEndpoint('GET', '/api/corporate/plans', null, '🏢 Corporate');
    this.results.e2e.push(corporate);

    // Step 8: Ayurveda
    var ayurveda = await this.testEndpoint('GET', '/api/ayurveda/doctors', null, '🧘 Ayurveda');
    this.results.e2e.push(ayurveda);

    // Step 9: Mental Health
    var mental = await this.testEndpoint('GET', '/api/mentalhealth/therapists', null, '🧠 Mental Health');
    this.results.e2e.push(mental);

    // Step 10: Online Doctor
    var onlineDoc = await this.testEndpoint('GET', '/api/online-doctor/search', null, '📱 Online Doctor');
    this.results.e2e.push(onlineDoc);

    // Step 11: Ambulance
    var ambulance = await this.testEndpoint('GET', '/api/ambulance/nearby-ambulances?lat=19.076&lng=72.877', null, '🚑 Ambulance');
    this.results.e2e.push(ambulance);

    // Step 12: Admin
    var admin = await this.testEndpoint('GET', '/api/admin/dashboard', null, '🔧 Admin');
    this.results.e2e.push(admin);

    // Step 13: Payment
    var payment = await this.testEndpoint('POST', '/api/payment/create-order', { amount: 500, bookingType: 'opd', bookingId: '507f1f77bcf86cd799439011' }, '💳 Payment');
    this.results.e2e.push(payment);

    // Step 14: Reviews
    var reviews = await this.testEndpoint('GET', '/api/reviews/provider/test123', null, '⭐ Reviews');
    this.results.e2e.push(reviews);

    // Step 15: Global Search
    var search = await this.testEndpoint('GET', '/api/search?q=hospital', null, '🔍 Global Search');
    this.results.e2e.push(search);

    // Count results
    var e2ePassed = this.results.e2e.filter(function(f) { return f.status.includes('PASS'); }).length;
    var e2eFailed = this.results.e2e.filter(function(f) { return f.status.includes('FAIL'); }).length;
    var e2eWarn = this.results.e2e.filter(function(f) { return f.status.includes('⚠️'); }).length;

    journeyResults = {
      registration: otp.status.includes('PASS') || register.status.includes('PASS') ? '✅' : '❌',
      login: login.status.includes('PASS') ? '✅' : '❌',
      hospitalSearch: hospitals.status.includes('PASS') ? '✅' : '❌',
      booking: booking.status.includes('PASS') ? '✅' : booking.status.includes('⚠️') ? '⚠️' : '❌',
      insurance: insurance.status.includes('PASS') ? '✅' : '❌',
      corporate: corporate.status.includes('PASS') ? '✅' : '❌',
      ayurveda: ayurveda.status.includes('PASS') ? '✅' : '❌',
      mentalHealth: mental.status.includes('PASS') ? '✅' : '❌',
      onlineDoctor: onlineDoc.status.includes('PASS') ? '✅' : '❌',
      ambulance: ambulance.status.includes('PASS') ? '✅' : '❌',
      payment: payment.status.includes('PASS') ? '✅' : '❌',
      admin: admin.status.includes('PASS') ? '✅' : '❌'
    };

    this.results.summary = {
      e2eTotal: this.results.e2e.length,
      e2ePassed: e2ePassed,
      e2eFailed: e2eFailed,
      e2eWarnings: e2eWarn,
      journeys: journeyResults,
      overallStatus: e2eFailed === 0 ? (e2eWarn === 0 ? '✅ PRODUCTION READY' : '⚠️ MINOR ISSUES') : '❌ NEEDS FIXES',
      recommendation: e2eFailed > 0 ? 'Failed flows need fixing before production use' : 'All critical flows working!'
    };

    return this.results;
  }

  async testAllFlows() {
    this.results.flows = [];
    this.results.flows.push(await this.testEndpoint('GET', '/api/hospitals/search?city=Mumbai', null, '🏥 Hospital Search'));
    this.results.flows.push(await this.testEndpoint('GET', '/api/ai/agents', null, '🤖 List AI Agents'));
    this.results.flows.push(await this.testEndpoint('GET', '/api/ai/health', null, '🤖 AI Health'));
    this.results.flows.push(await this.testEndpoint('POST', '/api/bookings/create', { patientName: 'Test', patientPhone: '9876543210', patientAge: 30, patientGender: 'Male' }, '📋 Create Booking'));
    this.results.flows.push(await this.testEndpoint('POST', '/api/payment/create-order', { amount: 500 }, '💳 Create Payment'));
    this.results.flows.push(await this.testEndpoint('GET', '/api/ambulance/nearby-ambulances', null, '🚑 Nearby Ambulances'));
    this.results.flows.push(await this.testEndpoint('GET', '/api/insurance/plans', null, '🛡️ Insurance Plans'));
    this.results.flows.push(await this.testEndpoint('GET', '/api/corporate/plans', null, '🏢 Corporate Plans'));
    this.results.flows.push(await this.testEndpoint('GET', '/api/mentalhealth/therapists', null, '🧠 Mental Health'));
    this.results.flows.push(await this.testEndpoint('GET', '/api/online-doctor/search', null, '📱 Online Doctor'));
    this.results.flows.push(await this.testEndpoint('GET', '/api/ayurveda/doctors', null, '🧘 Ayurveda'));
    this.results.flows.push(await this.testEndpoint('GET', '/api/homeopathy/doctors', null, '🌿 Homeopathy'));
    this.results.flows.push(await this.testEndpoint('GET', '/api/reviews/provider/test123', null, '⭐ Reviews'));
    this.results.flows.push(await this.testEndpoint('GET', '/api/admin/dashboard', null, '🔧 Admin'));
    this.results.flows.push(await this.testEndpoint('GET', '/api/search?q=hospital', null, '🔍 Global Search'));

    var passed = this.results.flows.filter(function(f) { return f.status.includes('PASS'); }).length;
    var failed = this.results.flows.filter(function(f) { return f.status.includes('FAIL'); }).length;
    var warnings = this.results.flows.filter(function(f) { return f.status.includes('⚠️'); }).length;

    this.results.summary = {
      totalFlows: this.results.flows.length, passed: passed, warnings: warnings, failed: failed,
      healthPercentage: Math.round((passed / this.results.flows.length) * 100),
      overallStatus: failed === 0 ? (warnings === 0 ? '✅ HEALTHY' : '⚠️ MINOR ISSUES') : '❌ NEEDS FIXES'
    };
    return this.results;
  }

  async testAll() { await this.testModels(); await this.testRoutes(); await this.testAllFlows(); return this.results; }

  async generateReport() {
    if (!this.results.flows || this.results.flows.length === 0) await this.testAll();
    var prompt = 'Analyze this test report and provide specific fixes:\n' + JSON.stringify(this.results, null, 2);
    var response = await this.providerManager.generate(prompt);
    return { summary: this.results.summary, flows: this.results.flows, aiAnalysis: response.content, provider: response.provider };
  }

  // SCAN FRONTEND FOR MISSING BACKEND ROUTES
  async scanFrontendAPIs() {
    var frontendDir = 'D:\\hospital-frontend\\src';
    if (!fs.existsSync(frontendDir)) {
      return { error: 'Frontend directory not found at ' + frontendDir, tip: 'Set correct path in TestingAgent' };
    }
    
    var apiCalls = [];
    var self = this;
    
    function scanDir(dir) {
      try {
        var files = fs.readdirSync(dir);
        for (var i = 0; i < files.length; i++) {
          var fp = path.join(dir, files[i]);
          if (fs.statSync(fp).isDirectory() && files[i] !== 'node_modules' && files[i] !== '.git') {
            scanDir(fp);
          } else if (files[i].match(/\.(js|jsx|ts|tsx)$/)) {
            var content = fs.readFileSync(fp, 'utf8');
            var matches = content.match(/['"`](\/api\/[^'"`\s?]+)/g);
            if (matches) {
              for (var j = 0; j < matches.length; j++) {
                var url = matches[j].replace(/['"`]/g, '').split('?')[0];
                if (url.startsWith('/api/') && url.length > 8 && apiCalls.indexOf(url) === -1) {
                  apiCalls.push(url);
                }
              }
            }
          }
        }
      } catch (e) {}
    }
    
    this.log('Scanning frontend API calls...', 'info');
    scanDir(frontendDir);
    
    var results = [];
    for (var k = 0; k < apiCalls.length; k++) {
      try {
        var response = await axios({ 
          method: 'GET', 
          url: this.baseURL + apiCalls[k], 
          timeout: 5000, 
          validateStatus: function(s) { return true; } 
        });
        results.push({
          endpoint: apiCalls[k],
          status: response.status,
          state: response.status === 200 ? '✅ OK' : response.status === 404 ? '❌ MISSING' : response.status === 403 ? '🔒 NEEDS AUTH' : '⚠️ ' + response.status
        });
      } catch (e) {
        results.push({ endpoint: apiCalls[k], status: 0, state: '❌ ERROR: ' + e.message.substring(0, 50) });
      }
    }
    
    var missing = results.filter(function(r) { return r.state.includes('MISSING') || r.state.includes('ERROR'); });
    
    return {
      totalFrontendAPIs: apiCalls.length,
      tested: results.length,
      missing: missing.length,
      details: results,
      summary: missing.length === 0 ? '✅ ALL FRONTEND APIs HAVE BACKEND ROUTES' : '❌ ' + missing.length + ' ROUTES MISSING',
      missingRoutes: missing
    };
  }

  // ==========================================
  // 🔥 PRODUCTION READINESS SCANNER
  // Scans for ALL real-world issues
  // ==========================================
  async productionScan() {
    var report = {
      timestamp: new Date().toISOString(),
      overallStatus: 'PENDING',
      sections: {}
    };

    // 1. ROUTE HEALTH CHECK
    this.log('🔍 Checking route health...', 'info');
    var routes = await this.testRoutes();
    report.sections.routes = {
      total: routes.total,
      passed: routes.passed,
      failed: routes.failed,
      status: routes.failed === 0 ? '✅' : '❌'
    };

    // 2. MODEL HEALTH CHECK
    this.log('🔍 Checking model health...', 'info');
    var models = await this.testModels();
    report.sections.models = {
      total: models.total,
      passed: models.passed,
      failed: models.failed,
      status: models.failed === 0 ? '✅' : '❌'
    };

    // 3. E2E FLOW CHECK
    this.log('🔍 Running E2E flows...', 'info');
    var e2e = await this.testE2EFlows();
    report.sections.e2e = e2e.summary;

    // 4. CORS CHECK
    this.log('🔍 Checking CORS...', 'info');
    var corsResult = { status: '✅', details: [] };
    var origins = [
      'https://hospital-frontend-kiaeto.vercel.app',
      'https://hospital-frontend-zeta-rosy.vercel.app',
      'http://localhost:3000'
    ];
    for (var o = 0; o < origins.length; o++) {
      try {
        var corsResp = await axios({ 
          method: 'OPTIONS', 
          url: this.baseURL + '/api/auth/login', 
          headers: { 'Origin': origins[o], 'Access-Control-Request-Method': 'POST' },
          timeout: 5000,
          validateStatus: function(s) { return true; }
        });
        corsResult.details.push({
          origin: origins[o],
          status: corsResp.status === 204 ? '✅' : '❌ ' + corsResp.status,
          allowed: corsResp.headers['access-control-allow-origin'] ? true : false
        });
      } catch (e) {
        corsResult.details.push({ origin: origins[o], status: '❌', error: e.message });
      }
    }
    corsResult.status = corsResult.details.every(function(d) { return d.allowed; }) ? '✅' : '❌';
    report.sections.cors = corsResult;

    // 5. AUTH CHECK
    this.log('🔍 Checking authentication...', 'info');
    var authResult = { status: '⚠️', details: [] };
    var authRoutes = [
      { path: '/api/auth/login', method: 'POST', name: 'Login' },
      { path: '/api/otp/send', method: 'POST', name: 'OTP Send' },
      { path: '/api/bookings', method: 'GET', name: 'Bookings (protected)' },
      { path: '/api/admin/dashboard', method: 'GET', name: 'Admin (protected)' }
    ];
    for (var a = 0; a < authRoutes.length; a++) {
      try {
        var ar = authRoutes[a];
        var resp = await axios({ method: ar.method, url: this.baseURL + ar.path, timeout: 5000, validateStatus: function(s) { return true; } });
        authResult.details.push({
          route: ar.name,
          path: ar.path,
          status: resp.status,
          state: resp.status === 200 ? '✅ Public' : resp.status === 401 ? '✅ Protected' : resp.status === 403 ? '✅ Protected' : resp.status === 404 ? '❌ Missing' : '⚠️ ' + resp.status
        });
      } catch (e) {
        authResult.details.push({ route: ar.name, path: ar.path, status: '❌', error: e.message });
      }
    }
    report.sections.auth = authResult;

    // 6. DATABASE CHECK
    this.log('🔍 Checking database...', 'info');
    var dbResult = { status: '⚠️', details: [] };
    try {
      var mongoCheck = await axios({ method: 'GET', url: this.baseURL + '/api/health', timeout: 5000 });
      dbResult.details.push({ service: 'MongoDB', status: mongoCheck.data && mongoCheck.data.services && mongoCheck.data.services.mongodb === 'connected' ? '✅' : '❌' });
    } catch (e) {
      dbResult.details.push({ service: 'MongoDB', status: '❌', error: 'Cannot connect' });
    }
    try {
      var redisCheck = await axios({ method: 'GET', url: this.baseURL + '/api/health', timeout: 5000 });
      dbResult.details.push({ service: 'Redis', status: redisCheck.data && redisCheck.data.services && redisCheck.data.services.redis === 'connected' ? '✅' : '⚠️ Unavailable' });
    } catch (e) {
      dbResult.details.push({ service: 'Redis', status: '⚠️', error: 'Not available' });
    }
    report.sections.database = dbResult;

    // 7. FRONTEND-BACKEND SYNC CHECK
    this.log('🔍 Checking frontend-backend sync...', 'info');
    var frontendResult = { status: '⚠️', scannedFiles: 0, apisFound: 0, missingRoutes: 0, details: [] };
    var frontendDir = 'D:\\hospital-frontend\\src';
    if (fs.existsSync(frontendDir)) {
      var apiCalls = [];
      var self = this;
      function scanFE(dir) {
        try {
          var files = fs.readdirSync(dir);
          for (var i = 0; i < files.length; i++) {
            var fp = path.join(dir, files[i]);
            if (fs.statSync(fp).isDirectory() && files[i] !== 'node_modules' && files[i] !== '.git') {
              scanFE(fp);
            } else if (files[i].match(/\.(js|jsx|ts|tsx)$/)) {
              var content = fs.readFileSync(fp, 'utf8');
              var matches = content.match(/['"`](\/api\/[^'"`\s?]+)/g);
              if (matches) {
                for (var j = 0; j < matches.length; j++) {
                  var url = matches[j].replace(/['"`]/g, '').split('?')[0];
                  if (url.startsWith('/api/') && url.length > 8 && apiCalls.indexOf(url) === -1) {
                    apiCalls.push(url);
                  }
                }
              }
            }
          }
        } catch (e) {}
      }
      scanFE(frontendDir);
      frontendResult.scannedFiles = 'Multiple';
      frontendResult.apisFound = apiCalls.length;
      
      for (var k = 0; k < apiCalls.length; k++) {
        try {
          var check = await axios({ method: 'GET', url: this.baseURL + apiCalls[k], timeout: 5000, validateStatus: function(s) { return true; } });
          if (check.status === 404) {
            frontendResult.missingRoutes++;
            frontendResult.details.push({ endpoint: apiCalls[k], status: '❌ MISSING' });
          }
        } catch (e) {
          frontendResult.details.push({ endpoint: apiCalls[k], status: '❌ ERROR' });
        }
      }
    }
    frontendResult.status = frontendResult.missingRoutes === 0 ? '✅' : '❌ ' + frontendResult.missingRoutes + ' routes missing';
    report.sections.frontendSync = frontendResult;

    // 8. AI AGENTS CHECK
    this.log('🔍 Checking AI agents...', 'info');
    try {
      var agentsResp = await axios({ method: 'GET', url: this.baseURL + '/api/ai/agents', timeout: 5000 });
      report.sections.aiAgents = {
        status: agentsResp.data && agentsResp.data.count > 0 ? '✅ ' + agentsResp.data.count + ' agents' : '❌',
        count: agentsResp.data ? agentsResp.data.count : 0
      };
    } catch (e) {
      report.sections.aiAgents = { status: '❌', error: e.message };
    }

    // FINAL VERDICT
    var allPassed = true;
    var sections = Object.keys(report.sections);
    for (var s = 0; s < sections.length; s++) {
      if (report.sections[sections[s]].status && report.sections[sections[s]].status.includes('❌')) {
        allPassed = false;
      }
    }
    report.overallStatus = allPassed ? '✅ PRODUCTION READY' : '❌ ISSUES FOUND - Check sections for details';
    report.recommendation = allPassed ? 'System is ready for real users!' : 'Fix the failing sections before going live';

    this.results.summary = report;
    return report;
  }

        getRequiredCapability(task) {
    if (task.includes('models')) return 'test_models';
    if (task.includes('routes')) return 'test_routes';
    if (task.includes('e2e') || task.includes('journey') || task.includes('patient')) return 'test_e2e';
    if (task.includes('frontend') || task.includes('scan')) return 'scan_frontend';
    if (task.includes('flows') || task.includes('all')) return 'test_all_flows';
    if (task.includes('production') || task.includes('scan all') || task.includes('audit')) return 'production_scan';
    return 'generate_report';
  }
}

module.exports = { TestingAgent };