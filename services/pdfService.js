const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const handlebars = require('handlebars');
const QRCode = require('qrcode');

class PDFService {
  constructor() {
    this.templatesDir = path.join(__dirname, '../templates/policies');
    this.ensureTemplateDirectory();
  }

  ensureTemplateDirectory() {
    if (!fs.existsSync(this.templatesDir)) {
      fs.mkdirSync(this.templatesDir, { recursive: true });
    }
  }

  /**
   * Generate policy document PDF
   */
  async generatePolicyPDF(policyData) {
    try {
      // Load template
      const templatePath = path.join(this.templatesDir, 'policy-template.hbs');
      let templateHtml;
      
      if (fs.existsSync(templatePath)) {
        templateHtml = fs.readFileSync(templatePath, 'utf8');
      } else {
        templateHtml = this.getDefaultTemplate();
      }

      // Compile template
      const compiledTemplate = handlebars.compile(templateHtml);

      // Generate QR code
      const qrCodeData = await this.generateQRCode({
        policyNumber: policyData.policyNumber,
        planName: policyData.planName,
        insuredName: policyData.primaryInsured?.name
      });

      // Prepare data
      const data = {
        ...policyData,
        qrCode: qrCodeData,
        formattedPremium: this.formatCurrency(policyData.premiumAmount),
        formattedSumInsured: this.formatCurrency(policyData.sumInsured),
        policyNumber: policyData.policyNumber || this.generatePolicyNumber(),
        issueDate: new Date().toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'long',
          year: 'numeric'
        }),
        startDate: policyData.startDate ? new Date(policyData.startDate).toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'long',
          year: 'numeric'
        }) : '',
        endDate: policyData.endDate ? new Date(policyData.endDate).toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'long',
          year: 'numeric'
        }) : '',
        companyName: policyData.companyId?.name || 'Insurance Company',
        companyLogo: policyData.companyId?.logo || '',
        features: policyData.features || [],
        inclusions: policyData.inclusions || [],
        exclusions: policyData.exclusions || [],
        members: policyData.members || [],
        primaryInsured: policyData.primaryInsured || {},
        nominee: policyData.nominee || {}
      };

      // Generate HTML
      const html = compiledTemplate(data);

      // Generate PDF
      const pdf = await this.generatePDF(html);

      // Upload to cloud storage (optional)
      const pdfUrl = await this.uploadToCloud(pdf, policyData.policyNumber);

      return {
        success: true,
        pdf: pdf,
        pdfUrl: pdfUrl,
        policyNumber: data.policyNumber
      };

    } catch (error) {
      console.error('PDF generation error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Generate PDF from HTML
   */
  async generatePDF(html) {
    const browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      headless: true
    });

    try {
      const page = await browser.newPage();
      await page.setContent(html, {
        waitUntil: 'networkidle0'
      });

      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '40px',
          bottom: '40px',
          left: '40px',
          right: '40px'
        }
      });

      return pdf;

    } finally {
      await browser.close();
    }
  }

  /**
   * Generate QR code
   */
  async generateQRCode(data) {
    try {
      const qrData = JSON.stringify({
        policyNumber: data.policyNumber,
        planName: data.planName,
        insuredName: data.insuredName,
        verificationUrl: `${process.env.FRONTEND_URL}/verify-policy/${data.policyNumber}`
      });
      
      const qrCode = await QRCode.toDataURL(qrData);
      return qrCode;
    } catch (error) {
      console.error('QR Code generation error:', error);
      return '';
    }
  }

  /**
   * Generate policy number
   */
  generatePolicyNumber() {
    const prefix = 'POL';
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `${prefix}${timestamp}${random}`;
  }

  /**
   * Format currency
   */
  formatCurrency(amount) {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount || 0);
  }

  /**
   * Upload PDF to cloud storage
   */
  async uploadToCloud(pdf, policyNumber) {
    // If using cloudinary
    // const result = await cloudinary.uploader.upload(pdf, {
    //   resource_type: 'raw',
    //   public_id: `policies/${policyNumber}`
    // });
    // return result.secure_url;

    // For now, return a local URL
    const fileName = `policy-${policyNumber}.pdf`;
    const filePath = path.join(__dirname, '../public/policies', fileName);
    
    if (!fs.existsSync(path.dirname(filePath))) {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
    }

    fs.writeFileSync(filePath, pdf);
    return `${process.env.FRONTEND_URL}/policies/${fileName}`;
  }

  /**
   * Get default HTML template
   */
  getDefaultTemplate() {
    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
          font-family: Arial, sans-serif;
          background: white;
          color: #1e293b;
          padding: 40px;
        }
        .policy-container {
          max-width: 1000px;
          margin: 0 auto;
          border: 1px solid #e2e8f0;
          padding: 40px;
        }
        .header {
          text-align: center;
          border-bottom: 3px solid #2563eb;
          padding-bottom: 20px;
          margin-bottom: 30px;
        }
        .header h1 {
          color: #2563eb;
          font-size: 28px;
          margin-bottom: 5px;
        }
        .header .policy-number {
          font-size: 14px;
          color: #64748b;
        }
        .section {
          margin: 20px 0;
        }
        .section h2 {
          font-size: 18px;
          color: #2563eb;
          border-bottom: 1px solid #e2e8f0;
          padding-bottom: 10px;
          margin-bottom: 15px;
        }
        .grid-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
        }
        .info-item {
          margin-bottom: 10px;
        }
        .info-item .label {
          font-weight: bold;
          font-size: 14px;
          color: #64748b;
        }
        .info-item .value {
          font-size: 16px;
          color: #1e293b;
        }
        .features-list {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }
        .features-list li {
          list-style: none;
          padding: 5px 10px;
          background: #f1f5f9;
          border-radius: 4px;
          font-size: 14px;
        }
        .footer {
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #e2e8f0;
          text-align: center;
          font-size: 12px;
          color: #64748b;
        }
        .disclaimer {
          font-size: 10px;
          color: #94a3b8;
          margin-top: 10px;
          text-align: center;
        }
        .qr-section {
          text-align: center;
          margin-top: 20px;
        }
        .qr-section img {
          max-width: 150px;
        }
      </style>
    </head>
    <body>
      <div class="policy-container">
        <div class="header">
          <h1>INSURANCE POLICY</h1>
          <div class="policy-number">Policy Number: {{policyNumber}}</div>
          <div>Issue Date: {{issueDate}}</div>
        </div>

        <div class="section">
          <h2>Policy Summary</h2>
          <div class="grid-2">
            <div class="info-item">
              <div class="label">Plan Name</div>
              <div class="value">{{planName}}</div>
            </div>
            <div class="info-item">
              <div class="label">Company</div>
              <div class="value">{{companyName}}</div>
            </div>
            <div class="info-item">
              <div class="label">Sum Insured</div>
              <div class="value">{{formattedSumInsured}}</div>
            </div>
            <div class="info-item">
              <div class="label">Premium</div>
              <div class="value">{{formattedPremium}}</div>
            </div>
            <div class="info-item">
              <div class="label">Start Date</div>
              <div class="value">{{startDate}}</div>
            </div>
            <div class="info-item">
              <div class="label">End Date</div>
              <div class="value">{{endDate}}</div>
            </div>
          </div>
        </div>

        <div class="section">
          <h2>Insured Details</h2>
          <div class="grid-2">
            <div class="info-item">
              <div class="label">Name</div>
              <div class="value">{{primaryInsured.name}}</div>
            </div>
            <div class="info-item">
              <div class="label">Age</div>
              <div class="value">{{primaryInsured.age}}</div>
            </div>
            <div class="info-item">
              <div class="label">Gender</div>
              <div class="value">{{primaryInsured.gender}}</div>
            </div>
          </div>
          {{#if members.length}}
          <h3 style="margin-top: 15px;">Family Members</h3>
          <div class="grid-2">
            {{#each members}}
            <div class="info-item">
              <div class="label">{{relation}}</div>
              <div class="value">{{name}} ({{age}} yrs)</div>
            </div>
            {{/each}}
          </div>
          {{/if}}
        </div>

        <div class="section">
          <h2>Key Features</h2>
          <ul class="features-list">
            {{#each features}}
            <li>✅ {{this}}</li>
            {{/each}}
          </ul>
        </div>

        <div class="section">
          <h2>Terms & Conditions</h2>
          <div class="grid-2">
            <div>
              <h3>Inclusions</h3>
              <ul>
                {{#each inclusions}}
                <li>✅ {{this}}</li>
                {{/each}}
              </ul>
            </div>
            <div>
              <h3>Exclusions</h3>
              <ul>
                {{#each exclusions}}
                <li>❌ {{this}}</li>
                {{/each}}
              </ul>
            </div>
          </div>
        </div>

        {{#if qrCode}}
        <div class="qr-section">
          <h3>Verify Policy</h3>
          <img src="{{qrCode}}" alt="Policy QR Code" />
          <p style="font-size: 12px; color: #64748b; margin-top: 5px;">
            Scan to verify policy authenticity
          </p>
        </div>
        {{/if}}

        <div class="footer">
          <p>This is a computer-generated policy. No signature required.</p>
          <p>For claims, contact: {{companyName}} | Phone: 1800-XXX-XXXX</p>
          <div class="disclaimer">
            Insurance is a subject matter of solicitation. Please read policy wordings carefully.
          </div>
        </div>
      </div>
    </body>
    </html>
    `;
  }
}

module.exports = new PDFService();