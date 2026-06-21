class ComplianceService {
  constructor() {
    this.irdaRegistration = process.env.IRDAI_REGISTRATION || 'REG-2024-XXXX';
    this.aggregatorName = process.env.AGGREGATOR_NAME || 'Your Platform Name';
    this.grievanceEmail = process.env.GRIEVANCE_EMAIL || 'grievance@yourplatform.com';
    this.grievancePhone = process.env.GRIEVANCE_PHONE || '1800-XXX-XXXX';
  }

  /**
   * Get all compliance disclosures
   */
  getDisclosures() {
    return {
      irda: {
        registration: this.irdaRegistration,
        status: 'Valid',
        aggregatorName: this.aggregatorName
      },
      disclaimer: {
        text: 'Insurance is a subject matter of solicitation. Please read policy wordings carefully before purchasing.',
        lastUpdated: new Date().toISOString()
      },
      commission: {
        disclosure: 'We receive commission from insurance companies for policies sold through our platform.',
        rate: 'Up to 15% of the premium'
      },
      grievance: {
        email: this.grievanceEmail,
        phone: this.grievancePhone,
        hours: 'Monday to Saturday, 9:00 AM - 6:00 PM IST'
      },
      refund: {
        policy: 'Free-look period of 15 days from policy issuance. Full refund if cancelled within this period.',
        process: 'Refund processed within 7-10 working days'
      }
    };
  }

  /**
   * Get compliance HTML for pages
   */
  getComplianceHTML() {
    return `
      <div class="compliance-banner">
        <div class="container">
          <div class="compliance-content">
            <p>
              <strong>IRDAI Registration:</strong> ${this.irdaRegistration} | 
              <strong>Aggregator:</strong> ${this.aggregatorName}
            </p>
            <p>
              <strong>Grievance Officer:</strong> ${this.grievanceEmail} | 
              <strong>Phone:</strong> ${this.grievancePhone}
            </p>
            <p class="disclaimer">
              Insurance is a subject matter of solicitation. 
              <a href="/disclaimer">Read More</a>
            </p>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Get plan disclosure
   */
  getPlanDisclosure(plan) {
    return {
      planName: plan.planName,
      companyName: plan.companyId?.name,
      claimSettlementRatio: plan.claimProcess?.claimSettlementRatio || 'N/A',
      networkHospitals: plan.totalNetworkHospitals || 0,
      waitingPeriod: plan.preExistingWaiting || 48,
      irdaApproved: true,
      lastUpdated: new Date().toISOString(),
      termsLink: '/terms-and-conditions',
      privacyLink: '/privacy-policy'
    };
  }

  /**
   * Get user consent requirements
   */
  getUserConsent() {
    return {
      marketing: {
        required: false,
        description: 'Agree to receive marketing communications'
      },
      dataSharing: {
        required: true,
        description: 'Agree to share data with insurance companies for policy processing'
      },
      terms: {
        required: true,
        description: 'Agree to Terms and Conditions'
      },
      privacy: {
        required: true,
        description: 'Agree to Privacy Policy'
      }
    };
  }

  /**
   * Validate policy application for compliance
   */
  validateApplication(data) {
    const issues = [];

    // Check age limits
    if (data.age < 18) {
      issues.push('Age must be 18 or above');
    }
    if (data.age > 80) {
      issues.push('Age must be 80 or below');
    }

    // Check sum insured
    if (data.sumInsured < 100000) {
      issues.push('Minimum sum insured is ₹1,00,000');
    }

    // Check member details
    if (data.members && data.members.length > 0) {
      data.members.forEach((member, index) => {
        if (member.age < 18) {
          issues.push(`Member ${index + 1}: Age must be 18 or above`);
        }
      });
    }

    return {
      isValid: issues.length === 0,
      issues
    };
  }

  /**
   * Get audit trail data
   */
  getAuditTrail(userId, action, details) {
    return {
      userId,
      action,
      details,
      timestamp: new Date().toISOString(),
      ipAddress: '', // Set from request
      userAgent: '', // Set from request
      sessionId: '' // Set from request
    };
  }

  /**
   * Generate compliance report
   */
  generateComplianceReport(startDate, endDate) {
    // This would pull data from database
    // For now, return structure
    return {
      reportPeriod: {
        startDate: startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        endDate: endDate || new Date()
      },
      metrics: {
        totalPolicies: 0,
        totalPremium: 0,
        totalCommission: 0,
        totalClaims: 0,
        resolvedGrievances: 0
      },
      compliance: {
        irdaReports: 'Submitted',
        auditLogs: 'Complete',
        dataPrivacy: 'Compliant',
        customerConsent: 'All policies have consent'
      }
    };
  }

  /**
   * Get policy wording page
   */
  getPolicyWording(policyType) {
    const wordings = {
      individual: `
        <h1>Individual Health Insurance Policy</h1>
        <p>This policy covers the individual insured against hospitalization expenses...</p>
        <h2>Coverage Details</h2>
        <ul>
          <li>Hospitalization expenses</li>
          <li>Pre-hospitalization (30 days)</li>
          <li>Post-hospitalization (60 days)</li>
          <li>ICU charges</li>
          <li>Daycare procedures</li>
        </ul>
        <h2>Exclusions</h2>
        <ul>
          <li>Pre-existing diseases (waiting period applies)</li>
          <li>Cosmetic procedures</li>
          <li>Experimental treatments</li>
        </ul>
      `,
      family_floater: `
        <h1>Family Floater Health Insurance Policy</h1>
        <p>This policy covers the entire family under a single sum insured...</p>
        <h2>Coverage Details</h2>
        <ul>
          <li>All family members covered</li>
          <li>Shared sum insured</li>
          <li>Maternity coverage (optional)</li>
          <li>Newborn baby coverage</li>
        </ul>
      `
    };

    return wordings[policyType] || wordings.individual;
  }
}

module.exports = new ComplianceService();