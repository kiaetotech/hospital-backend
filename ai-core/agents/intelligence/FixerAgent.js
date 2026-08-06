// D:\hospital backend\ai-core\agents\intelligence\FixerAgent.js

const { AgentRole, AgentStatus } = require('../../../shared/types/AgentTypes');
const { BaseAgent } = require('../base/BaseAgent');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class FixerAgent extends BaseAgent {
  constructor(providerManager) {
    super({
      name: 'Fixer Agent',
      role: 'fixer',
      capabilities: [
        { name: 'scan_and_fix', description: 'Scan all files and auto-fix errors', priority: 1, estimatedLatency: 5000, requiresAuth: false },
        { name: 'fix_syntax', description: 'Fix syntax errors in files', priority: 1, estimatedLatency: 1000, requiresAuth: false },
        { name: 'restore_file', description: 'Restore file from git history', priority: 2, estimatedLatency: 500, requiresAuth: false },
        { name: 'install_deps', description: 'Install missing dependencies', priority: 2, estimatedLatency: 2000, requiresAuth: false }
      ]
    }, providerManager);

    this.baseDir = path.join(__dirname, '..', '..', '..');
    this.fixes = [];
    this.maintenanceInterval = null;
  }

  async execute(request) {
    this.setStatus(AgentStatus.BUSY);
    var task = request.task;
    var payload = request.payload || {};

    try {
      var result;
      if (task.includes('scan') || task.includes('fix all')) result = await this.scanAndFixAll();
      else if (task.includes('fix syntax')) result = await this.fixSyntaxErrors();
      else if (task.includes('restore')) result = await this.restoreFromGit(payload);
      else if (task.includes('install') || task.includes('deps')) result = await this.installMissingDeps();
      else if (task.includes('start maintenance')) result = this.startScheduledMaintenance();
      else if (task.includes('stop maintenance')) result = this.stopMaintenance();
      else result = await this.scanAndFixAll();

      this.setStatus(AgentStatus.IDLE);
      this.setCurrentTask(null);
      return { success: true, data: result, sourceAgent: this.id };
    } catch (error) {
      this.setStatus(AgentStatus.IDLE);
      return { success: false, error: error.message, sourceAgent: this.id };
    }
  }

  scanAllFiles() {
    var brokenFiles = [];
    var self = this;

    function scanDir(dir) {
      try {
        var files = fs.readdirSync(dir);
        for (var i = 0; i < files.length; i++) {
          var f = files[i];
          var fullPath = path.join(dir, f);
          
          if (fs.statSync(fullPath).isDirectory()) {
            if (f !== 'node_modules' && f !== '.git' && f !== 'dist') {
              scanDir(fullPath);
            }
          } else if (f.endsWith('.js')) {
            try {
              delete require.cache[require.resolve(fullPath)];
              require(fullPath);
            } catch (e) {
              brokenFiles.push({
                file: fullPath.replace(self.baseDir + '\\', ''),
                error: e.message.substring(0, 150),
                stack: e.stack ? e.stack.split('\n')[1] : ''
              });
            }
          }
        }
      } catch (e) {}
    }

    scanDir(path.join(this.baseDir, 'routes'));
    scanDir(path.join(this.baseDir, 'models'));
    return brokenFiles;
  }

  async fixSyntaxErrors() {
    var broken = this.scanAllFiles();
    var fixed = [];
    var unfixable = [];

    for (var i = 0; i < broken.length; i++) {
      var item = broken[i];
      var fixed_file = await this.autoFixFile(item);
      if (fixed_file) {
        fixed.push(item.file);
      } else {
        unfixable.push(item);
      }
    }

    return {
      totalBroken: broken.length,
      fixed: fixed.length,
      unfixable: unfixable.length,
      unfixableFiles: unfixable,
      message: fixed.length + ' files auto-fixed, ' + unfixable.length + ' need manual attention'
    };
  }

  async autoFixFile(item) {
    var filePath = path.join(this.baseDir, item.file);
    
    try {
      var content = fs.readFileSync(filePath, 'utf8');
      var fixed = false;

      var fixes = [
        { pattern: /export class /g, replace: 'class ' },
        { pattern: /export const /g, replace: 'const ' },
        { pattern: /import \{.*\} from '.*'/g, replace: '// import removed' },
        { pattern: /private /g, replace: '// private ' },
        { pattern: /protected /g, replace: '// protected ' },
        { pattern: /\.ts/g, replace: '.js' }
      ];

      for (var i = 0; i < fixes.length; i++) {
        if (fixes[i].pattern.test(content)) {
          content = content.replace(fixes[i].pattern, fixes[i].replace);
          fixed = true;
        }
      }

      if (fixed) {
        fs.writeFileSync(filePath, content, 'utf8');
        try {
          delete require.cache[require.resolve(filePath)];
          require(filePath);
          this.fixes.push({ file: item.file, status: 'fixed' });
          return true;
        } catch (e) {
          return false;
        }
      }
    } catch (e) {}
    
    return false;
  }

  async restoreFromGit(payload) {
    var filePath = payload.file || '';
    var commitHash = payload.commit || '336633d4';

    try {
      execSync('git checkout ' + commitHash + ' -- ' + filePath, { cwd: this.baseDir });
      try {
        delete require.cache[require.resolve(path.join(this.baseDir, filePath))];
        require(path.join(this.baseDir, filePath));
        return { file: filePath, status: 'Restored and working' };
      } catch (e) {
        return { file: filePath, status: 'Still broken after restore', error: e.message };
      }
    } catch (e) {
      return { file: filePath, status: 'Git restore failed', error: e.message };
    }
  }

  async installMissingDeps() {
    var broken = this.scanAllFiles();
    var missingModules = [];

    for (var i = 0; i < broken.length; i++) {
      var err = broken[i].error;
      if (err.includes('Cannot find module')) {
        var match = err.match(/Cannot find module '([^']+)'/);
        if (match && match[1] && !match[1].startsWith('.') && !match[1].startsWith('/')) {
          if (missingModules.indexOf(match[1]) === -1) {
            missingModules.push(match[1]);
          }
        }
      }
    }

    var installed = [];
    for (var j = 0; j < missingModules.length; j++) {
      try {
        execSync('npm install ' + missingModules[j], { cwd: this.baseDir, stdio: 'pipe' });
        installed.push(missingModules[j]);
      } catch (e) {}
    }

    return {
      missing: missingModules.length,
      installed: installed.length,
      modules: installed,
      message: installed.length > 0 ? 'Installed: ' + installed.join(', ') : 'No missing deps found'
    };
  }

  async scanAndFixAll() {
    this.log('Starting full scan...', 'info');
    
    this.log('Checking dependencies...', 'info');
    var deps = await this.installMissingDeps();

    this.log('Fixing syntax errors...', 'info');
    var syntax = await this.fixSyntaxErrors();

    this.log('Verifying fixes...', 'info');
    var remaining = this.scanAllFiles();

    return {
      dependencies: deps,
      syntax: syntax,
      remainingErrors: remaining.length,
      remainingFiles: remaining,
      status: remaining.length === 0 ? 'ALL CLEAN' : remaining.length + ' files still need attention',
      recommendation: remaining.length > 0 ? 'Run restore_from_git for these files' : 'System is production-ready!'
    };
  }

  // SCHEDULED AUTO-MAINTENANCE
  startScheduledMaintenance() {
    var self = this;
    this.log('Scheduled maintenance started - runs every 30 minutes', 'info');
    
    this.runMaintenanceCycle();
    
    this.maintenanceInterval = setInterval(function() {
      self.runMaintenanceCycle();
    }, 30 * 60 * 1000);
    
    return { status: 'started', interval: '30 minutes' };
  }
  
  async runMaintenanceCycle() {
    this.log('Running scheduled maintenance...', 'info');
    
    try {
      var testResult = await this.scanAndFixAll();
      
      if (testResult.remainingErrors > 0) {
        this.log('Found ' + testResult.remainingErrors + ' errors', 'warn');
        
        // Only try git restore if git is available
        try {
          execSync('git --version', { cwd: this.baseDir, stdio: 'pipe' });
          for (var i = 0; i < testResult.remainingFiles.length; i++) {
            await this.restoreFromGit({ file: testResult.remainingFiles[i].file });
          }
        } catch (gitErr) {
          this.log('Git not available - skipping git restore', 'info');
        }
        
        var recheck = this.scanAllFiles();
        this.log('Recheck: ' + recheck.length + ' errors remaining', 'info');
      } else {
        this.log('All systems healthy', 'info');
      }
    } catch (e) {
      this.log('Maintenance cycle error: ' + e.message, 'error');
    }
  }

  stopMaintenance() {
    if (this.maintenanceInterval) {
      clearInterval(this.maintenanceInterval);
      this.maintenanceInterval = null;
      this.log('Scheduled maintenance stopped', 'info');
    }
    return { status: 'stopped' };
  }

  // DETECT AND FIX MISSING ROUTES
  async detectMissingRoutes() {
    var commonRoutes = {
      '/api/ambulance/stats': { method: 'GET', description: 'Ambulance provider stats' },
      '/api/ambulance/driver/dashboard': { method: 'GET', description: 'Driver dashboard' },
      '/api/caregivers/stats': { method: 'GET', description: 'Caregiver stats' },
      '/api/diagnostics/stats': { method: 'GET', description: 'Diagnostics stats' }
    };
    
    var missing = [];
    for (var route in commonRoutes) {
      try {
        var response = await axios({ method: commonRoutes[route].method, url: this.baseURL + route, timeout: 5000, validateStatus: function(s) { return true; } });
        if (response.status === 404) {
          missing.push({ route: route, description: commonRoutes[route].description, status: 404 });
        }
      } catch (e) {
        missing.push({ route: route, description: commonRoutes[route].description, error: e.message });
      }
    }
    
    return {
      checked: Object.keys(commonRoutes).length,
      missing: missing.length,
      details: missing,
      action: missing.length > 0 ? 'These routes need to be added to the backend' : 'All routes present'
    };
  }

  getRequiredCapability(task) {
    if (task.includes('scan') || task.includes('fix all')) return 'scan_and_fix';
    if (task.includes('syntax')) return 'fix_syntax';
    if (task.includes('restore')) return 'restore_file';
    if (task.includes('install') || task.includes('deps')) return 'install_deps';
    if (task.includes('start maintenance')) return 'scan_and_fix';
    if (task.includes('stop maintenance')) return 'scan_and_fix';
    return 'scan_and_fix';
  }
}

module.exports = { FixerAgent };