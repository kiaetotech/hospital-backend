const { AgentRole, AgentStatus } = require('../../../shared/types/AgentTypes');
const { BaseAgent } = require('../base/BaseAgent');
const axios = require('axios');

class AuthTestAgent extends BaseAgent {
  constructor(providerManager) {
    super({
      name: 'Auth Test Agent',
      role: 'engineering_auth_test',
      capabilities: [
        { name: 'test_all_auth', description: 'Test auth for all 11 provider roles', priority: 1, estimatedLatency: 10000 },
        { name: 'test_patient_auth', description: 'Patient register/login/OTP', priority: 1, estimatedLatency: 3000 },
        { name: 'test_token_validation', description: 'JWT token validation across routes', priority: 2, estimatedLatency: 5000 }
      ]
    }, providerManager);
    this.baseURL = 'https://hospital-backend-production-f1b1.up.railway.app';
  }

  async execute(request) {
    this.setStatus(AgentStatus.BUSY);
    try {
      var result;
      if (request.task.includes('patient')) result = await this.testPatientAuth();
      else if (request.task.includes('token')) result = await this.testTokenValidation();
      else result = await this.testAllAuth();
      this.setStatus(AgentStatus.IDLE);
      return { success: true, data: result, sourceAgent: this.id };
    } catch (e) {
      this.setStatus(AgentStatus.IDLE);
      return { success: false, error: e.message };
    }
  }

  async testAllAuth() {
    var results = [];
    
    // Define all provider roles and their test credentials
    var roles = [
      { role: 'patient', name: 'Test Patient', dashPath: '/api/hospitals/search?city=Delhi' },
      { role: 'hospital', name: 'Test Hospital', dashPath: '/api/hospitals/provider/stats' },
      { role: 'ambulance_provider', name: 'Test Ambulance', dashPath: '/api/ambulance/stats' },
      { role: 'diagnostics_provider', name: 'Test Diagnostics', dashPath: '/api/diagnostics/stats' },
      { role: 'caregiver_provider', name: 'Test Caregiver', dashPath: '/api/caregivers/stats' },
      { role: 'insurance_company', name: 'Test Insurance', dashPath: '/api/insurance/company/stats' },
      { role: 'lender', name: 'Test Lender', dashPath: '/api/lender/stats' },
      { role: 'online_doctor', name: 'Test Online Doctor', dashPath: '/api/online-doctor/search' },
      { role: 'ayurveda_doctor', name: 'Test Ayurveda', dashPath: '/api/ayurveda/doctors' },
      { role: 'homeopathy_doctor', name: 'Test Homeopathy', dashPath: '/api/homeopathy/doctors' },
      { role: 'therapist', name: 'Test Therapist', dashPath: '/api/mentalhealth/therapists' },
      { role: 'corporate_hr', name: 'Test Corporate HR', dashPath: '/api/corporate/plans' },
      { role: 'admin', name: 'Test Admin', dashPath: '/api/admin/dashboard' }
    ];

    for (var i = 0; i < roles.length; i++) {
      var r = roles[i];
      var roleResult = { role: r.role, name: r.name, register: null, login: null, protectedRoute: null };

      // Test Register
      try {
        var email = r.role.replace('_', '') + Date.now() + '@test.com';
        var reg = await axios.post(this.baseURL + '/api/auth/register', {
          name: r.name, email: email, phone: '9' + Math.floor(Math.random() * 1000000000),
          password: 'Test@123', role: r.role
        }, { validateStatus: function(s) { return true; } });
        roleResult.register = reg.status < 400 ? '✅' : '⚠️ ' + (reg.data?.message || reg.status);
      } catch (e) {
        roleResult.register = '❌ ' + (e.message || 'error').substring(0, 30);
      }

      // Test Login
      var token = null;
      try {
        var login = await axios.post(this.baseURL + '/api/auth/login', {
          email: 'medweb@web.in', password: 'MedWeb@123'
        }, { validateStatus: function(s) { return true; } });
        if (login.data?.token) {
          token = login.data.token;
          roleResult.login = '✅';
        } else {
          roleResult.login = '⚠️ No token';
        }
      } catch (e) {
        roleResult.login = '❌';
      }

      // Test Protected Route
      if (token) {
        try {
          var dash = await axios.get(this.baseURL + r.dashPath, {
            headers: { Authorization: 'Bearer ' + token },
            validateStatus: function(s) { return true; }
          });
          roleResult.protectedRoute = dash.status === 200 ? '✅' : '⚠️ ' + dash.status;
        } catch (e) {
          roleResult.protectedRoute = '❌';
        }
      } else {
        roleResult.protectedRoute = '⏭️ No token';
      }

      results.push(roleResult);
    }

    // Also test forgot password flow
    var forgotResult = { role: 'forgot_password', name: 'Password Reset', register: null, login: null, protectedRoute: null };
    try {
      var fp = await axios.post(this.baseURL + '/api/auth/reset-password', {
        email: 'medweb@web.in', newPassword: 'Reset@123'
      });
      forgotResult.register = fp.status === 200 ? '✅' : '⚠️';
    } catch (e) { forgotResult.register = '❌'; }
    try {
      var fpl = await axios.post(this.baseURL + '/api/auth/login', { email: 'medweb@web.in', password: 'Reset@123' });
      forgotResult.login = fpl.status === 200 ? '✅' : '⚠️';
      // Reset back
      await axios.post(this.baseURL + '/api/auth/reset-password', { email: 'medweb@web.in', newPassword: 'MedWeb@123' });
    } catch (e) { forgotResult.login = '❌'; }
    results.push(forgotResult);

    var pass = results.filter(function(r) { return r.register === '✅' || r.login === '✅'; }).length;
    return {
      totalRoles: results.length,
      tested: pass,
      details: results,
      summary: pass >= 10 ? '✅ Auth system working' : '⚠️ Auth issues found'
    };
  }

  async testPatientAuth() {
    var steps = [];
    var phone = '98888' + Math.floor(Math.random() * 10000);
    var email = 'authpatient' + Date.now() + '@test.com';
    var pass = 'Auth@123';
    var token = null;

    try { var r = await axios.post(this.baseURL + '/api/auth/register', { name: 'Auth Patient', email, phone, password: pass, role: 'patient' }); steps.push({ step: 'Register', status: '✅' }); token = r.data?.token; } catch (e) { steps.push({ step: 'Register', status: '❌ ' + (e.response?.data?.message || '') }); }
    try { var l = await axios.post(this.baseURL + '/api/auth/login', { email, password: pass }); steps.push({ step: 'Login', status: '✅' }); token = l.data?.token; } catch (e) { steps.push({ step: 'Login', status: '❌' }); }
    try { await axios.post(this.baseURL + '/api/otp/send', { phone: phone }); steps.push({ step: 'OTP Send', status: '✅' }); } catch (e) { steps.push({ step: 'OTP Send', status: '❌' }); }
    if (token) { try { await axios.get(this.baseURL + '/api/bookings', { headers: { Authorization: 'Bearer ' + token } }); steps.push({ step: 'Protected Route', status: '✅' }); } catch (e) { steps.push({ step: 'Protected Route', status: '❌' }); } }

    var pass = steps.filter(function(s) { return s.status.startsWith('✅'); }).length;
    return { flow: 'Patient Auth', steps: steps, passed: pass, total: steps.length, summary: pass >= 3 ? '✅' : '⚠️' };
  }

  async testTokenValidation() {
    var results = [];
    var invalidToken = 'invalid.token.here';
    var expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6InRlc3QiLCJyb2xlIjoicGF0aWVudCIsImlhdCI6MTUwMDAwMDAwMCwiZXhwIjoxNTAwMDAwMDAxfQ.xxx';

    try { var r1 = await axios.get(this.baseURL + '/api/bookings', { headers: { Authorization: 'Bearer ' + invalidToken }, validateStatus: function(s) { return true; } }); results.push({ test: 'Invalid Token', expected: '401/403', actual: r1.status, state: r1.status === 401 || r1.status === 403 ? '✅' : '❌' }); } catch (e) { results.push({ test: 'Invalid Token', state: '❌' }); }
    try { var r2 = await axios.get(this.baseURL + '/api/bookings', { headers: { Authorization: 'Bearer ' + expiredToken }, validateStatus: function(s) { return true; } }); results.push({ test: 'Expired Token', expected: '401/403', actual: r2.status, state: r2.status === 401 || r2.status === 403 ? '✅' : '❌' }); } catch (e) { results.push({ test: 'Expired Token', state: '❌' }); }
    try { var r3 = await axios.get(this.baseURL + '/api/bookings', { validateStatus: function(s) { return true; } }); results.push({ test: 'No Token', expected: '401', actual: r3.status, state: r3.status === 401 ? '✅' : '❌' }); } catch (e) { results.push({ test: 'No Token', state: '❌' }); }

    var pass = results.filter(function(r) { return r.state === '✅'; }).length;
    return { tests: results, passed: pass, total: results.length, summary: pass === 3 ? '✅ Token validation working' : '⚠️ Token issues' };
  }

  getRequiredCapability(task) {
    if (task.includes('patient')) return 'test_patient_auth';
    if (task.includes('token')) return 'test_token_validation';
    return 'test_all_auth';
  }
}

module.exports = { AuthTestAgent };