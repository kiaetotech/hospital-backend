const express = require('express');
const router = express.Router();
const hospitalStatusService = require('../services/hospitalStatusService');
const auth = require('../middleware/auth');

// ============================================
// WEBHOOK: Receive WhatsApp replies
// ============================================
router.post('/webhook/whatsapp', async (req, res) => {
  try {
    const { From, Body } = req.body;
    
    if (!From || !Body) {
      return res.status(400).json({ success: false, error: 'Missing data' });
    }

    const result = await hospitalStatusService.processStatusReply(From, Body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// GET: Hospital status (for card display)
// ============================================
router.get('/:hospitalId', async (req, res) => {
  try {
    const status = await hospitalStatusService.getHospitalStatus(req.params.hospitalId);
    res.json({ success: true, data: status });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// POST: Manually trigger status request
// ============================================
router.post('/:hospitalId/request', auth.authenticateAdmin, async (req, res) => {
  try {
    const result = await hospitalStatusService.sendStatusRequest(req.params.hospitalId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// GET: Bulk statuses for search results
// ============================================
router.post('/bulk', async (req, res) => {
  try {
    const { hospitalIds } = req.body;
    const statuses = await hospitalStatusService.getBulkStatuses(hospitalIds);
    res.json({ success: true, data: statuses });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;