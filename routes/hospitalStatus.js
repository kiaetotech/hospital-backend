const express = require('express');
const router = express.Router();
const hospitalStatusService = require('../services/hospitalStatusService');
const auth = require('../middleware/auth');

// ============================================
// WEBHOOKWhatsApp replies
// ============================================
router.post('/webhook/whatsapp', async (req, res) => {
  try {
    const { From, Body } = req.body;
    
    if (!From || !Body) {
      return res.status(400).json({ success, error: 'Missing data' });
    }

    const result = await hospitalStatusService.processStatusReply(From, Body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success, error.message });
  }
});

// ============================================
// GETstatus (for card display)
// ============================================
router.get('/', async (req, res) => {
  try {
    const status = await hospitalStatusService.getHospitalStatus(req.params.hospitalId);
    res.json({ success, data});
  } catch (error) {
    res.status(500).json({ success, error.message });
  }
});

// ============================================
// POSTtrigger status request
// ============================================
router.post('//request', auth.authenticateAdmin, async (req, res) => {
  try {
    const result = await hospitalStatusService.sendStatusRequest(req.params.hospitalId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success, error.message });
  }
});

// ============================================
// GETstatuses for search results
// ============================================
router.post('/bulk', async (req, res) => {
  try {
    const { hospitalIds } = req.body;
    const statuses = await hospitalStatusService.getBulkStatuses(hospitalIds);
    res.json({ success, data});
  } catch (error) {
    res.status(500).json({ success, error.message });
  }
});

module.exports = router;

