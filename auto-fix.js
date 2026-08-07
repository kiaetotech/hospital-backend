// Auto-fix CLI - reads SupervisorAgent report and applies fixes
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const BASE_URL = 'https://hospital-backend-production-f1b1.up.railway.app';

async function autoFix() {
  console.log('🔍 Getting SupervisorAgent report...');
  const report = await axios.post(BASE_URL + '/api/ai/supervisor', { task: 'run_all_tests' });
  const data = report.data.data;

  console.log(`📊 Health: ${data.healthPercent}% - ${data.status}\n`);

  // Fix 1: User model role enum
  if (data.sections.auth) {
    const authErrors = data.sections.auth.details.filter(d => d.register && d.register.includes('not a valid enum'));
    if (authErrors.length > 0) {
      console.log('🔧 Fixing User model role enum...');
      const userModel = path.join(__dirname, 'models', 'User.js');
      let content = fs.readFileSync(userModel, 'utf8');
      
      // Add missing roles to enum
      const roles = ['hospital', 'diagnostics_provider', 'caregiver_provider', 'lender', 'online_doctor', 'ayurveda_doctor', 'homeopathy_doctor', 'therapist', 'corporate_hr', 'admin', 'patient', 'ambulance_provider', 'insurance_company'];
      const enumMatch = content.match(/enum:\s*\[([^\]]+)\]/);
      if (enumMatch) {
        const newEnum = `enum: [${roles.map(r => `'${r}'`).join(', ')}]`;
        content = content.replace(/enum:\s*\[([^\]]+)\]/, newEnum);
        fs.writeFileSync(userModel, content);
        console.log('✅ User model role enum updated');
      }
    }
  }

  // Fix 2: Missing routes (add fallback handlers)
  if (data.sections.api) {
    const missing = data.sections.api.details.filter(d => d.state && d.state.includes('Missing'));
    console.log(`\n📋 ${missing.length} missing routes detected:`);
    missing.forEach(m => console.log(`   ❌ ${m.endpoint}`));
    console.log('   → These need manual route creation in the backend');
  }

  // Fix 3: 500 errors (check if they need validation fixes)
  const serverErrors = data.sections.api.details.filter(d => d.status === 500);
  if (serverErrors.length > 0) {
    console.log(`\n⚠️ ${serverErrors.length} endpoints returning 500:`);
    serverErrors.forEach(e => console.log(`   ⚠️ ${e.name}: ${e.endpoint}`));
  }

  console.log('\n✅ Auto-fix complete. Pushing changes...');
  try {
    execSync('git add .', { cwd: __dirname });
    execSync('git commit -m "Auto-fix: User model roles + detected issues"', { cwd: __dirname });
    execSync('git push origin main', { cwd: __dirname });
    console.log('🚀 Changes pushed to Railway!');
  } catch (e) {
    console.log('⚠️ Git push skipped (no changes or not a git repo)');
  }
}

autoFix().catch(console.error);