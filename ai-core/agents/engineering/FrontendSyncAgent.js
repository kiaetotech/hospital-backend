const { AgentRole, AgentStatus } = require('../../../shared/types/AgentTypes');
const { BaseAgent } = require('../base/BaseAgent');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

class FrontendSyncAgent extends BaseAgent {
  constructor(providerManager) {
    super({
      name: 'Frontend Sync Agent',
      role: 'engineering_frontend_sync',
      capabilities: [
        { name: 'scan_all_apis', description: 'Scan frontend for API calls, verify backend routes exist', priority: 1, estimatedLatency: 5000 },
        { name: 'find_missing_routes', description: 'List all missing backend routes', priority: 1, estimatedLatency: 3000 },
        { name: 'check_cors', description: 'Verify CORS allows frontend origin', priority: 2, estimatedLatency: 2000 }
      ]
    }, providerManager);
    this.baseURL = 'https://hospital-backend-production-f1b1.up.railway.app';
  }

  async execute(request) {
    this.setStatus(AgentStatus.BUSY);
    try {
      var result;
      if (request.task.includes('missing')) result = await this.findMissingRoutes();
      else if (request.task.includes('cors')) result = await this.checkCORS();
      else result = await this.scanAllAPIs();
      this.setStatus(AgentStatus.IDLE);
      return { success: true, data: result, sourceAgent: this.id };
    } catch (e) {
      this.setStatus(AgentStatus.IDLE);
      return { success: false, error: e.message };
    }
  }

  async scanAllAPIs() {
    var frontendDir = 'D:\\hospital-frontend\\src';
    if (!fs.existsSync(frontendDir)) return { error: 'Frontend directory not found at ' + frontendDir };

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
                var url = matches[j].replace(/['"`]/g, '').split('?')[0].replace(/\/:[a-zA-Z]+/g, '/test123');
                if (url.startsWith('/api/') && url.length > 8 && apiCalls.indexOf(url) === -1) {
                  apiCalls.push({ url: url, file: fp.replace(frontendDir, '') });
                }
              }
            }
          }
        }
      } catch (e) {}
    }

    this.log('Scanning frontend for API calls...', 'info');
    scanDir(frontendDir);

    var results = [];
    for (var k = 0; k < apiCalls.length; k++) {
      try {
        var resp = await axios({ method: 'GET', url: this.baseURL + apiCalls[k].url, timeout: 5000, validateStatus: function(s) { return true; } });
        var state = resp.status === 200 ? '✅' : resp.status === 401 ? '🔒 Auth' : resp.status === 404 ? '❌ MISSING' : '⚠️ ' + resp.status;
        results.push({ frontendFile: apiCalls[k].file, endpoint: apiCalls[k].url, status: resp.status, state: state });
      } catch (e) {
        results.push({ frontendFile: apiCalls[k].file, endpoint: apiCalls[k].url, status: 0, state: '❌ ERROR' });
      }
    }

    var missing = results.filter(function(r) { return r.state.includes('MISSING') || r.state.includes('ERROR'); });
    var pass = results.filter(function(r) { return r.state.startsWith('✅') || r.state.startsWith('🔒'); }).length;

    return {
      totalAPIs: apiCalls.length,
      working: pass,
      missing: missing.length,
      healthPercent: Math.round((pass / apiCalls.length) * 100),
      missingRoutes: missing,
      details: results,
      summary: missing.length === 0 ? '✅ ALL FRONTEND APIs HAVE BACKEND ROUTES' : '❌ ' + missing.length + ' ROUTES MISSING'
    };
  }

  async findMissingRoutes() {
    var scan = await this.scanAllAPIs();
    var missing = scan.details.filter(function(r) { return r.state.includes('MISSING'); });
    return {
      totalMissing: missing.length,
      routes: missing,
      recommendation: missing.length > 0 ? 'Add these routes to the backend or fix frontend API paths' : 'All routes synced'
    };
  }

  async checkCORS() {
    var origins = ['https://hospital-frontend-kiaeto.vercel.app', 'https://hospital-frontend-zeta-rosy.vercel.app', 'http://localhost:3000'];
    var results = [];
    for (var i = 0; i < origins.length; i++) {
      try {
        var r = await axios({ method: 'OPTIONS', url: this.baseURL + '/api/auth/login', headers: { 'Origin': origins[i], 'Access-Control-Request-Method': 'POST' }, timeout: 5000, validateStatus: function(s) { return true; } });
        results.push({ origin: origins[i], status: r.status, allowed: r.headers['access-control-allow-origin'] ? true : false, state: r.status === 204 ? '✅' : '❌' });
      } catch (e) { results.push({ origin: origins[i], state: '❌' }); }
    }
    var allOK = results.every(function(r) { return r.state === '✅'; });
    return { origins: results, summary: allOK ? '✅ CORS configured correctly' : '❌ CORS issues found' };
  }

  getRequiredCapability(task) {
    if (task.includes('missing')) return 'find_missing_routes';
    if (task.includes('cors')) return 'check_cors';
    return 'scan_all_apis';
  }
}

module.exports = { FrontendSyncAgent };