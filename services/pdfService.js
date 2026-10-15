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
   * Generate premium payment receipt PDF
   */
  async generateReceipt(policyData) {
    try {
      const html = this.getReceiptTemplate();
      const compiledTemplate = handlebars.compile(html);

      const data = {
        policyNumber: policyData.policyNumber,
        planName: policyData.policyName || policyData.planName,
        companyName: policyData.companyId?.name || 'Insurance Company',
        primaryInsured: policyData.primaryInsured || {},
        members: policyData.members || [],
        formattedPremium: this.formatCurrency(policyData.premiumAmount),
        formattedGst: this.formatCurrency(policyData.gstAmount || 0),
        formattedTotal: this.formatCurrency(policyData.totalAmount || policyData.premiumAmount),
        formattedSumInsured: this.formatCurrency(policyData.sumInsured),
        receiptNumber: 'RCPT' + Date.now().toString().slice(-10),
        receiptDate: new Date().toLocaleDateString('en-IN', {
          day: '2-digit', month: 'long', year: 'numeric'
        }),
        startDate: policyData.startDate ? new Date(policyData.startDate).toLocaleDateString('en-IN', {
          day: '2-digit', month: 'long', year: 'numeric'
        }) : '',
        endDate: policyData.endDate ? new Date(policyData.endDate).toLocaleDateString('en-IN', {
          day: '2-digit', month: 'long', year: 'numeric'
        }) : '',
        paymentId: policyData.paymentId || policyData.paymentHistory?.[0]?.razorpayPaymentId || '—',
        companyAddress: policyData.companyId?.address || '',
        companyEmail: policyData.companyId?.email || '',
        companyPhone: policyData.companyId?.phone || '',
      };

      const filled = compiledTemplate(data);
      const pdf = await this.generatePDF(filled);
      const pdfUrl = await this.uploadToCloud(pdf, 'receipt-' + policyData.policyNumber);

      return { success: true, pdf, pdfUrl, receiptNumber: data.receiptNumber };
    } catch (error) {
      console.error('Receipt PDF error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Generate member card PDF
   */
  async generateMemberCard(policyData) {
    try {
      const html = this.getMemberCardTemplate();
      const compiledTemplate = handlebars.compile(html);

      const qrCodeData = await this.generateQRCode({
        policyNumber: policyData.policyNumber,
        planName: policyData.policyName,
        insuredName: policyData.primaryInsured?.name,
      });

      const members = (policyData.members || []).map((m) => ({
        ...m,
        isPrimary: m.isPrimary || m.relation === 'self',
        dobFormatted: m.dateOfBirth ? new Date(m.dateOfBirth).toLocaleDateString('en-IN') : '—',
      }));

      const data = {
        policyNumber: policyData.policyNumber,
        planName: policyData.policyName || policyData.planName,
        companyName: policyData.companyId?.name || 'Insurance Company',
        companyLogo: policyData.companyId?.logo || '',
        companyPhone: policyData.companyId?.phone || '1800-XXX-XXXX',
        sumInsured: this.formatCurrency(policyData.sumInsured),
        startDate: policyData.startDate ? new Date(policyData.startDate).toLocaleDateString('en-IN') : '',
        endDate: policyData.endDate ? new Date(policyData.endDate).toLocaleDateString('en-IN') : '',
        members,
        qrCode: qrCodeData,
        validTill: policyData.endDate ? new Date(policyData.endDate).toLocaleDateString('en-IN') : '',
      };

      const filled = compiledTemplate(data);
      const pdf = await this.generatePDF(filled);
      const pdfUrl = await this.uploadToCloud(pdf, 'card-' + policyData.policyNumber);

      return { success: true, pdf, pdfUrl };
    } catch (error) {
      console.error('Member card PDF error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Receipt HTML template
   */
  getReceiptTemplate() {
    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; background: white; color: #1e293b; padding: 40px; }
        .container { max-width: 800px; margin: 0 auto; border: 1px solid #e2e8f0; padding: 40px; }
        .header { text-align: center; border-bottom: 3px solid #2563eb; padding-bottom: 20px; margin-bottom: 30px; }
        .header h1 { color: #2563eb; font-size: 26px; margin-bottom: 5px; }
        .company { font-size: 14px; color: #64748b; margin-top: 8px; }
        .receipt-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 25px; padding: 15px; background: #f8fafc; border-radius: 8px; }
        .meta-item .label { font-size: 12px; color: #64748b; font-weight: bold; }
        .meta-item .value { font-size: 15px; color: #1e293b; margin-top: 3px; }
        .section { margin: 25px 0; }
        .section h2 { font-size: 16px; color: #2563eb; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 15px; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { padding: 10px 12px; text-align: left; border-bottom: 1px solid #e2e8f0; font-size: 14px; }
        th { background: #f1f5f9; font-weight: bold; color: #475569; }
        .total-row { background: #eff6ff; font-weight: bold; }
        .total-row td { font-size: 16px; color: #2563eb; border-top: 2px solid #2563eb; }
        .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 12px; color: #64748b; }
        .stamp { display: inline-block; margin-top: 20px; padding: 10px 30px; border: 2px dashed #10b981; color: #10b981; font-weight: bold; border-radius: 8px; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>PREMIUM PAYMENT RECEIPT</h1>
          <div class="company">{{companyName}}</div>
        </div>

        <div class="receipt-meta">
          <div class="meta-item"><div class="label">RECEIPT NUMBER</div><div class="value">{{receiptNumber}}</div></div>
          <div class="meta-item"><div class="label">RECEIPT DATE</div><div class="value">{{receiptDate}}</div></div>
          <div class="meta-item"><div class="label">POLICY NUMBER</div><div class="value">{{policyNumber}}</div></div>
          <div class="meta-item"><div class="label">PLAN</div><div class="value">{{planName}}</div></div>
        </div>

        <div class="section">
          <h2>Insured Details</h2>
          <div class="receipt-meta">
            <div class="meta-item"><div class="label">PRIMARY INSURED</div><div class="value">{{primaryInsured.name}}</div></div>
            <div class="meta-item"><div class="label">AGE / GENDER</div><div class="value">{{primaryInsured.age}} / {{primaryInsured.gender}}</div></div>
            <div class="meta-item"><div class="label">MEMBERS COVERED</div><div class="value">{{members.length}}</div></div>
            <div class="meta-item"><div class="label">SUM INSURED</div><div class="value">{{formattedSumInsured}}</div></div>
          </div>
        </div>

        <div class="section">
          <h2>Payment Details</h2>
          <table>
            <thead><tr><th>Description</th><th>Amount</th></tr></thead>
            <tbody>
              <tr><td>Base Premium</td><td>{{formattedPremium}}</td></tr>
              <tr><td>GST</td><td>{{formattedGst}}</td></tr>
              <tr class="total-row"><td>TOTAL PAID</td><td>{{formattedTotal}}</td></tr>
            </tbody>
          </table>
        </div>

        <div class="section">
          <h2>Policy Period</h2>
          <div class="receipt-meta">
            <div class="meta-item"><div class="label">VALID FROM</div><div class="value">{{startDate}}</div></div>
            <div class="meta-item"><div class="label">VALID TILL</div><div class="value">{{endDate}}</div></div>
            <div class="meta-item"><div class="label">PAYMENT ID</div><div class="value">{{paymentId}}</div></div>
          </div>
        </div>

        <div style="text-align:center;">
          <div class="stamp">✓ PAID</div>
        </div>

        <div class="footer">
          <p>This is a computer-generated receipt. No signature required.</p>
          <p>{{companyName}} | {{companyEmail}} | {{companyPhone}}</p>
        </div>
      </div>
    </body>
    </html>
    `;
  }

  /**
   * Member card HTML template — wallet-sized (85.6 x 54 mm scaled up)
   */
  getMemberCardTemplate() {
    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; background: white; padding: 20px; }
        .card {
          width: 500px; margin: 20px auto; padding: 20px;
          border: 2px solid #2563eb; border-radius: 12px;
          background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
          page-break-inside: avoid;
        }
        .card-header {
          display: flex; justify-content: space-between; align-items: center;
          border-bottom: 2px solid #2563eb; padding-bottom: 10px; margin-bottom: 15px;
        }
        .card-header h2 { color: #2563eb; font-size: 16px; }
        .card-header .company { font-size: 12px; color: #64748b; }
        .card-body { display: flex; gap: 15px; }
        .card-left { flex: 1; }
        .card-right { width: 100px; text-align: center; }
        .card-right img { width: 100px; height: 100px; border: 2px solid white; border-radius: 8px; }
        .field { margin-bottom: 8px; }
        .field .label { font-size: 10px; color: #64748b; font-weight: bold; text-transform: uppercase; }
        .field .value { font-size: 14px; color: #1e293b; font-weight: bold; }
        .policy-num { font-family: monospace; font-size: 16px; color: #2563eb; letter-spacing: 1px; }
        .card-footer {
          margin-top: 15px; padding-top: 10px; border-top: 1px dashed #2563eb;
          text-align: center; font-size: 11px; color: #64748b;
        }
        .page-break { page-break-after: always; }
      </style>
    </head>
    <body>
      {{#each members}}
      <div class="card">
        <div class="card-header">
          <div>
            <h2>HEALTH INSURANCE CARD</h2>
            <div class="company">{{../companyName}}</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:10px; color:#64748b;">VALID TILL</div>
            <div style="font-size:14px; font-weight:bold; color:#2563eb;">{{../validTill}}</div>
          </div>
        </div>

        <div class="card-body">
          <div class="card-left">
            <div class="field">
              <div class="label">Insured Name</div>
              <div class="value">{{name}}</div>
            </div>
            <div class="field">
              <div class="label">Policy Number</div>
              <div class="policy-num">{{../policyNumber}}</div>
            </div>
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 10px;">
              <div class="field">
                <div class="label">Relation</div>
                <div class="value">{{relation}}</div>
              </div>
              <div class="field">
                <div class="label">Age / Gender</div>
                <div class="value">{{age}} / {{gender}}</div>
              </div>
            </div>
            <div class="field">
              <div class="label">Sum Insured</div>
              <div class="value">{{../sumInsured}}</div>
            </div>
          </div>

          <div class="card-right">
            {{#if ../qrCode}}
            <img src="{{../qrCode}}" alt="QR" />
            {{/if}}
            <div style="font-size:9px; color:#64748b; margin-top:5px;">Scan to verify</div>
          </div>
        </div>

        <div class="card-footer">
          For emergencies or cashless claims, call {{../companyPhone}} | Show this card at network hospitals
        </div>
      </div>
      {{#unless @last}}<div class="page-break"></div>{{/unless}}
      {{/each}}
    </body>
    </html>
    `;
  }

  /**
   * Generate settlement receipt PDF
   */
  async generateSettlementReceipt(claimData) {
    try {
      const html = this.getSettlementReceiptTemplate();
      const compiledTemplate = handlebars.compile(html);

      const data = {
        claimNumber: claimData.claimNumber,
        policyNumber: claimData.policyNumber,
        planName: claimData.planName,
        companyName: claimData.companyName || 'Insurance Company',
        claimantName: claimData.claimantName || 'Policyholder',
        hospitalName: claimData.hospitalName,
        hospitalAddress: claimData.hospitalAddress,
        admissionDate: claimData.admissionDate ? new Date(claimData.admissionDate).toLocaleDateString('en-IN') : '',
        dischargeDate: claimData.dischargeDate ? new Date(claimData.dischargeDate).toLocaleDateString('en-IN') : '',
        diagnosis: claimData.diagnosis || '—',
        treatment: claimData.treatment || '—',
        claimedAmount: this.formatCurrency(claimData.amount),
        approvedAmount: this.formatCurrency(claimData.approvedAmount || claimData.settlementAmount),
        settlementAmount: this.formatCurrency(claimData.settlementAmount || claimData.approvedAmount),
        settlementDate: claimData.settlementDate ? new Date(claimData.settlementDate).toLocaleDateString('en-IN') : new Date().toLocaleDateString('en-IN'),
        settlementReference: claimData.settlementReference || '—',
        settlementMode: claimData.settlementMode || 'bank_transfer',
        receiptNumber: 'SETTLE' + Date.now().toString().slice(-10),
        generatedDate: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
      };

      const filled = compiledTemplate(data);
      const pdf = await this.generatePDF(filled);
      const pdfUrl = await this.uploadToCloud(pdf, 'settlement-' + claimData.claimNumber);
      return { success: true, pdf, pdfUrl };
    } catch (error) {
      console.error('Settlement receipt PDF error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Settlement receipt HTML template
   */
  getSettlementReceiptTemplate() {
    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; background: white; color: #1e293b; padding: 40px; }
        .container { max-width: 800px; margin: 0 auto; border: 1px solid #e2e8f0; padding: 40px; }
        .header { text-align: center; border-bottom: 3px solid #10b981; padding-bottom: 20px; margin-bottom: 30px; }
        .header h1 { color: #10b981; font-size: 26px; margin-bottom: 5px; }
        .company { font-size: 14px; color: #64748b; margin-top: 8px; }
        .receipt-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 25px; padding: 15px; background: #f8fafc; border-radius: 8px; }
        .meta-item .label { font-size: 12px; color: #64748b; font-weight: bold; }
        .meta-item .value { font-size: 15px; color: #1e293b; margin-top: 3px; }
        .section { margin: 25px 0; }
        .section h2 { font-size: 16px; color: #10b981; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 15px; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { padding: 10px 12px; text-align: left; border-bottom: 1px solid #e2e8f0; font-size: 14px; }
        th { background: #f1f5f9; font-weight: bold; color: #475569; }
        .total-row { background: #ecfdf5; font-weight: bold; }
        .total-row td { font-size: 16px; color: #10b981; border-top: 2px solid #10b981; }
        .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 12px; color: #64748b; }
        .stamp { display: inline-block; margin-top: 20px; padding: 10px 30px; border: 2px dashed #10b981; color: #10b981; font-weight: bold; border-radius: 8px; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>CLAIM SETTLEMENT RECEIPT</h1>
          <div class="company">{{companyName}}</div>
        </div>

        <div class="receipt-meta">
          <div class="meta-item"><div class="label">RECEIPT NUMBER</div><div class="value">{{receiptNumber}}</div></div>
          <div class="meta-item"><div class="label">DATE</div><div class="value">{{generatedDate}}</div></div>
          <div class="meta-item"><div class="label">CLAIM NUMBER</div><div class="value">{{claimNumber}}</div></div>
          <div class="meta-item"><div class="label">POLICY NUMBER</div><div class="value">{{policyNumber}}</div></div>
        </div>

        <div class="section">
          <h2>Claimant Details</h2>
          <div class="receipt-meta">
            <div class="meta-item"><div class="label">NAME</div><div class="value">{{claimantName}}</div></div>
            <div class="meta-item"><div class="label">PLAN</div><div class="value">{{planName}}</div></div>
          </div>
        </div>

        <div class="section">
          <h2>Hospitalisation Details</h2>
          <div class="receipt-meta">
            <div class="meta-item"><div class="label">HOSPITAL</div><div class="value">{{hospitalName}}</div></div>
            <div class="meta-item"><div class="label">ADDRESS</div><div class="value">{{hospitalAddress}}</div></div>
            <div class="meta-item"><div class="label">ADMISSION</div><div class="value">{{admissionDate}}</div></div>
            <div class="meta-item"><div class="label">DISCHARGE</div><div class="value">{{dischargeDate}}</div></div>
            <div class="meta-item"><div class="label">DIAGNOSIS</div><div class="value">{{diagnosis}}</div></div>
            <div class="meta-item"><div class="label">TREATMENT</div><div class="value">{{treatment}}</div></div>
          </div>
        </div>

        <div class="section">
          <h2>Settlement Details</h2>
          <table>
            <thead><tr><th>Description</th><th>Amount</th></tr></thead>
            <tbody>
              <tr><td>Claimed Amount</td><td>{{claimedAmount}}</td></tr>
              <tr><td>Approved Amount</td><td>{{approvedAmount}}</td></tr>
              <tr class="total-row"><td>SETTLED AMOUNT</td><td>{{settlementAmount}}</td></tr>
            </tbody>
          </table>
        </div>

        <div class="section">
          <h2>Payment Reference</h2>
          <div class="receipt-meta">
            <div class="meta-item"><div class="label">SETTLEMENT DATE</div><div class="value">{{settlementDate}}</div></div>
            <div class="meta-item"><div class="label">REFERENCE</div><div class="value">{{settlementReference}}</div></div>
            <div class="meta-item"><div class="label">MODE</div><div class="value">{{settlementMode}}</div></div>
          </div>
        </div>

        <div style="text-align:center;">
          <div class="stamp">✓ SETTLED</div>
        </div>

        <div class="footer">
          <p>This is a computer-generated settlement receipt. No signature required.</p>
          <p>For queries, contact: {{companyName}}</p>
        </div>
      </div>
    </body>
    </html>
    `;
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