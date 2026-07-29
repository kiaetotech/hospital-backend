// utils/encryption.js
import crypto from 'crypto';

const algorithm = 'aes-256-gcm';
const key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');

export class EncryptionService {
  // Encrypt sensitive data (HIPAA compliant)
  static encrypt(text) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return {
      encrypted,
      iv.toString('hex'),
      authTag.toString('hex')
    };
  }

  static decrypt(encryptedData) {
    const { encrypted, iv, authTag } = encryptedData;
    const decipher = crypto.createDecipheriv(
      algorithm,
      key,
      Buffer.from(iv, 'hex')
    );
    
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  // Hash data for compliance (GDPR right to be forgotten)
  static hashForAnonymization(data) {
    return crypto
      .createHash('sha256')
      .update(data + process.env.HASH_SALT)
      .digest('hex');
  }
}

