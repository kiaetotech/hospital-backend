const crypto = require('crypto');
const axios = require('axios');
const path = require('path');
const fs = require('fs');

class SignatureService {
  constructor() {
    this.providers = {
      esign: {
        apiUrl: process.env.ESIGN_API_URL || 'https://api.esign.in/v1',
        apiKey: process.env.ESIGN_API_KEY,
        apiSecret: process.env.ESIGN_API_SECRET
      },
      aadhaar: {
        apiUrl: process.env.AADHAAR_API_URL || 'https://api.aadhaar.gov.in/v1',
        apiKey: process.env.AADHAAR_API_KEY,
        apiSecret: process.env.AADHAAR_API_SECRET
      }
    };
  }

  /**
   * Generate digital signature
   */
  async generateSignature(data) {
    try {
      const { method, userId, documentData } = data;

      switch (method) {
        case 'aadhaar':
          return await this.signWithAadhaar(data);
        case 'manual':
          return await this.signManually(data);
        default:
          return await this.signWithAadhaar(data);
      }

    } catch (error) {
      console.error('Signature generation error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Sign with Aadhaar eSign
   */
  async signWithAadhaar(data) {
    try {
      const { userId, aadhaarNumber, otp, documentId } = data;

      // Step 1: Verify Aadhaar
      const verifyResponse = await this.verifyAadhaar(aadhaarNumber, userId);
      if (!verifyResponse.success) {
        return verifyResponse;
      }

      // Step 2: Send OTP
      const otpResponse = await this.sendAadhaarOTP(aadhaarNumber);
      if (!otpResponse.success) {
        return otpResponse;
      }

      // Step 3: Verify OTP
      if (otp) {
        const verifyOTPResponse = await this.verifyAadhaarOTP(aadhaarNumber, otp);
        if (!verifyOTPResponse.success) {
          return verifyOTPResponse;
        }
      }

      // Step 4: Generate signature
      const signature = this.generateSignatureHash(userId, documentId, aadhaarNumber);

      // Step 5: Store signature
      const signedDocument = await this.storeSignedDocument(documentId, signature);

      return {
        success: true,
        signature: signature,
        signedDocument: signedDocument,
        method: 'aadhaar',
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('Aadhaar signature error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Manual signature (mouse/touch)
   */
  async signManually(data) {
    try {
      const { userId, documentId, signatureData, name, date } = data;

      // Generate signature hash
      const signature = this.generateSignatureHash(userId, documentId, name, signatureData);

      // Store signature
      const signedDocument = await this.storeSignedDocument(documentId, signature, {
        name: name,
        date: date || new Date().toISOString(),
        signatureData: signatureData
      });

      return {
        success: true,
        signature: signature,
        signedDocument: signedDocument,
        method: 'manual',
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('Manual signature error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Verify Aadhaar
   */
  async verifyAadhaar(aadhaarNumber, userId) {
    try {
      // Simulate Aadhaar verification
      if (aadhaarNumber.length !== 12) {
        return {
          success: false,
          error: 'Invalid Aadhaar number'
        };
      }

      // Check if Aadhaar is valid (basic validation)
      const isValid = this.validateAadhaar(aadhaarNumber);
      
      return {
        success: isValid,
        message: isValid ? 'Aadhaar verified' : 'Invalid Aadhaar'
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Send Aadhaar OTP
   */
  async sendAadhaarOTP(aadhaarNumber) {
    try {
      // Simulate sending OTP
      const otp = Math.floor(100000 + Math.random() * 900000);
      
      // Store OTP (in production, use Redis)
      // await redisClient.set(`aadhaar_otp:${aadhaarNumber}`, otp, 'EX', 300);
      
      return {
        success: true,
        message: 'OTP sent successfully',
        otp: otp // Remove in production
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Verify Aadhaar OTP
   */
  async verifyAadhaarOTP(aadhaarNumber, otp) {
    try {
      // Simulate OTP verification
      // const storedOTP = await redisClient.get(`aadhaar_otp:${aadhaarNumber}`);
      const storedOTP = '123456'; // Mock

      if (otp === storedOTP) {
        return {
          success: true,
          message: 'OTP verified'
        };
      } else {
        return {
          success: false,
          error: 'Invalid OTP'
        };
      }

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Validate Aadhaar number
   */
  validateAadhaar(aadhaarNumber) {
    if (aadhaarNumber.length !== 12) return false;
    if (!/^\d{12}$/.test(aadhaarNumber)) return false;
    
    // Verhoeff algorithm check (simplified)
    return true;
  }

  /**
   * Generate signature hash
   */
  generateSignatureHash(userId, documentId, ...args) {
    const data = `${userId}${documentId}${args.join('')}${Date.now()}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Store signed document
   */
  async storeSignedDocument(documentId, signature, metadata = {}) {
    // Store in database or file system
    const docPath = path.join(__dirname, '../signed-documents', `${documentId}.json`);
    
    const documentData = {
      documentId: documentId,
      signature: signature,
      metadata: metadata,
      timestamp: new Date().toISOString()
    };

    // Ensure directory exists
    const dir = path.dirname(docPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(docPath, JSON.stringify(documentData, null, 2));

    return {
      id: documentId,
      url: `${process.env.FRONTEND_URL}/signed-documents/${documentId}.json`,
      signature: signature
    };
  }

  /**
   * Verify signature
   */
  verifySignature(documentId, signature) {
    try {
      const docPath = path.join(__dirname, '../signed-documents', `${documentId}.json`);
      
      if (!fs.existsSync(docPath)) {
        return {
          valid: false,
          error: 'Document not found'
        };
      }

      const documentData = JSON.parse(fs.readFileSync(docPath, 'utf8'));
      
      return {
        valid: documentData.signature === signature,
        document: documentData
      };

    } catch (error) {
      return {
        valid: false,
        error: error.message
      };
    }
  }
}

module.exports = new SignatureService();