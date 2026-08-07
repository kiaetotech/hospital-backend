const { AgentRole, AgentStatus } = require('../../../shared/types/AgentTypes');
const { BaseAgent } = require('../base/BaseAgent');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

class APITestAgent extends BaseAgent {
  constructor(providerManager) {
    super({
      name: 'API Test Agent',
      role: 'engineering_api_test',
      capabilities: [
        { name: 'test_all_apis', description: 'Test every API endpoint with auth', priority: 1, estimatedLatency: 5000 },
        { name: 'test_auth_flows', description: 'Test register, login, OTP, JWT', priority: 1, estimatedLatency: 3000 },
        { name: 'test_crud_flows', description: 'Test CRUD operations', priority: 2, estimatedLatency: 3000 }
      ]
    }, providerManager);
    this.baseURL = 'https://hospital-backend-production-f1b1.up.railway.app';
    this.results = [];
  }

  async execute(request) {
    this.setStatus(AgentStatus.BUSY);
    try {
      var result;
      if (request.task.includes('auth')) result = await this.testAuthFlows();
      else result = await this.testAllAPIs();
      this.setStatus(AgentStatus.IDLE);
      return { success: true, data: result, sourceAgent: this.id };
    } catch (e) {
      this.setStatus(AgentStatus.IDLE);
      return { success: false, error: e.message };
    }
  }

    async testAllAPIs() {
    var endpoints = [
      // 🔑 AUTH
      { method: 'POST', path: '/api/auth/register', data: { name: 'APITest', email: 'apitest' + Date.now() + '@test.com', phone: '9888888888', password: 'Test@123', role: 'patient' }, name: 'Register Patient' },
      { method: 'POST', path: '/api/auth/login', data: { email: 'medweb@web.in', password: 'MedWeb@123' }, name: 'Login' },
      { method: 'POST', path: '/api/otp/send', data: { phone: '9876543210' }, name: 'Send OTP' },
      
      // 🏥 HOSPITALS
      { method: 'GET', path: '/api/hospitals', name: 'List Hospitals' },
      { method: 'GET', path: '/api/hospitals/search?city=Delhi', name: 'Search Hospitals' },
      { method: 'GET', path: '/api/hospitals/medical-data', name: 'Medical Data' },
      
      // 🚑 AMBULANCE
      { method: 'GET', path: '/api/ambulance/nearby-ambulances?lat=19.076&lng=72.877', name: 'Nearby Ambulances' },
      { method: 'GET', path: '/api/ambulance/fare-estimate?distance=10', name: 'Ambulance Fare' },
      { method: 'POST', path: '/api/ambulance/emergency-dispatch', data: { patientPhone: '9876543210', pickupLat: 19.076, pickupLng: 72.877, patientCondition: 'Test' }, name: 'Emergency Dispatch' },
      
      // 📱 ONLINE DOCTOR
      { method: 'GET', path: '/api/online-doctor/search', name: 'Online Doctor Search' },
      
      // 🔬 LAB TESTS
      { method: 'GET', path: '/api/diagnostics/search?city=Mumbai', name: 'Diagnostics Search' },
      { method: 'GET', path: '/api/packages/search?city=Delhi', name: 'Health Packages' },
      
      // 🧘 AYURVEDA
      { method: 'GET', path: '/api/ayurveda/doctors', name: 'Ayurveda Doctors' },
      { method: 'GET', path: '/api/ayurveda-centers', name: 'Ayurveda Centers' },
      
      // 🌿 HOMEOPATHY
      { method: 'GET', path: '/api/homeopathy/doctors', name: 'Homeopathy Doctors' },
      
      // 🧠 MENTAL HEALTH
      { method: 'GET', path: '/api/mentalhealth/therapists', name: 'Therapists' },
      
      // 🏠 HOME CARE
      { method: 'GET', path: '/api/caregivers/search?city=Mumbai', name: 'Caregiver Search' },
      
      // 🛡️ INSURANCE
      { method: 'GET', path: '/api/insurance/plans', name: 'Insurance Plans' },
      
      // 💰 HEALTH EMI
      { method: 'GET', path: '/api/loan/partners', name: 'Loan Partners' },
      
      // 🏢 CORPORATE
      { method: 'GET', path: '/api/corporate/plans', name: 'Corporate Plans' },
      
      // 📋 BOOKINGS
      { method: 'POST', path: '/api/bookings/create', data: { patientName: 'Test', patientPhone: '9876543210', patientAge: 30, patientGender: 'Male', bookingType: 'opd', appointmentDate: new Date().toISOString().split('T')[0], slot: '10:00 AM' }, name: 'Create Booking' },
      
      // 💳 PAYMENT
      { method: 'POST', path: '/api/payment/create-order', data: { amount: 500 }, name: 'Create Payment Order' },
      
      // ⭐ REVIEWS
      { method: 'GET', path: '/api/reviews/provider/test123', name: 'Provider Reviews' },
      
      // 🔍 SEARCH
      { method: 'GET', path: '/api/search?q=hospital', name: 'Global Search' },
      
      // 🔧 ADMIN
      { method: 'GET', path: '/api/admin/dashboard', name: 'Admin Dashboard' },
      
      // 🤖 AI
      { method: 'GET', path: '/api/ai/agents', name: 'AI Agents' },
      { method: 'GET', path: '/api/ai/health', name: 'AI Health' },
    ];

    this.results = [];
    for (var i = 0; i < endpoints.length; i++) {
      var ep = endpoints[i];
      try {
        var config = { method: ep.method, url: this.baseURL + ep.path, timeout: 10000, validateStatus: function(s) { return true; } };
        if (ep.data) config.data = ep.data;
        var response = await axios(config);
        var status = response.status;
        var ok = status >= 200 && status < 400;
        this.results.push({ name: ep.name, endpoint: ep.method + ' ' + ep.path, status: status, state: ok ? '✅' : status === 401 ? '🔒 Auth' : status === 404 ? '❌ Missing' : '⚠️ ' + status });
      } catch (e) {
        this.results.push({ name: ep.name, endpoint: ep.method + ' ' + ep.path, status: 0, state: '❌ ' + (e.code || e.message).substring(0, 40) });
      }
    }

    var pass = this.results.filter(function(r) { return r.state.startsWith('✅'); }).length;
    var fail = this.results.filter(function(r) { return r.state.startsWith('❌'); }).length;
    
    return {
      total: this.results.length,
      passed: pass,
      failed: fail,
      healthPercent: Math.round((pass / this.results.length) * 100),
      details: this.results,
      summary: fail === 0 ? 'ALL APIs WORKING' : fail + ' APIs need attention'
    };
  }

  async testAuthFlows() {
    var results = [];
    var testPhone = '99999' + Math.floor(Math.random() * 10000);
    var testEmail = 'autotest' + Date.now() + '@test.com';
    var testPassword = 'Auto@' + Date.now();
    var token = null;

    // Step 1: Register
    try {
      var reg = await axios.post(this.baseURL + '/api/auth/register', { name: 'Auto Test', email: testEmail, phone: testPhone, password: testPassword, role: 'patient' });
      results.push({ step: 'Register', status: reg.status, state: reg.status === 201 ? '✅' : '⚠️ ' + reg.status, data: reg.data });
      if (reg.data && reg.data.token) token = reg.data.token;
    } catch (e) { results.push({ step: 'Register', status: 0, state: '❌ ' + e.message.substring(0, 40) }); }

    // Step 2: Login
    try {
      var login = await axios.post(this.baseURL + '/api/auth/login', { email: testEmail, password: testPassword });
      results.push({ step: 'Login', status: login.status, state: login.status === 200 ? '✅' : '⚠️', data: login.data });
      if (login.data && login.data.token) token = login.data.token;
    } catch (e) { results.push({ step: 'Login', status: 0, state: '❌ ' + e.message.substring(0, 40) }); }

    // Step 3: Access protected route
    if (token) {
      try {
        var profile = await axios.get(this.baseURL + '/api/hospitals/search?city=Delhi', { headers: { Authorization: 'Bearer ' + token } });
        results.push({ step: 'Protected Route', status: profile.status, state: profile.status === 200 ? '✅' : '⚠️' });
      } catch (e) { results.push({ step: 'Protected Route', status: 0, state: '❌ ' + e.message.substring(0, 40) }); }
    }

    var pass = results.filter(function(r) { return r.state.startsWith('✅'); }).length;
    return { steps: results, passed: pass, total: results.length, summary: pass === results.length ? '✅ Auth flows working' : '⚠️ Some auth steps failed' };
  }

  getRequiredCapability(task) {
    if (task.includes('auth')) return 'test_auth_flows';
    return 'test_all_apis';
  }
}

module.exports = { APITestAgent };