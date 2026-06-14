const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const ImportLog = require('../models/ImportLog');
const Group = require('../models/Group');
const { importCSVRows } = require('../utils/csvImporter');
const { protect } = require('../middleware/auth');

// @desc    Get all import logs
// @route   GET /api/import/logs
// @access  Private
router.get('/logs', protect, async (req, res) => {
  try {
    const logs = await ImportLog.findAll({
      order: [['rowNumber', 'ASC']]
    });
    
    const response = logs.map(l => {
      const json = l.toJSON();
      return { ...json, _id: json.id };
    });
    
    res.json(response);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error retrieving import logs' });
  }
});

// @desc    Clear import logs (for resetting the demo)
// @route   DELETE /api/import/logs
// @access  Private
router.delete('/logs', protect, async (req, res) => {
  try {
    await ImportLog.destroy({ where: {} });
    res.json({ message: 'All import logs cleared' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error clearing import logs' });
  }
});

// @desc    Resolve a specific import log
// @route   POST /api/import/logs/:id/resolve
// @access  Private
router.post('/logs/:id/resolve', protect, async (req, res) => {
  try {
    const log = await ImportLog.findByPk(req.params.id);
    if (!log) {
      return res.status(404).json({ message: 'Import log not found' });
    }

    log.status = 'resolved';
    log.actionTaken = `${log.actionTaken} (Manually Resolved)`;
    await log.save();

    const json = log.toJSON();
    res.json({ ...json, _id: json.id });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error resolving import log' });
  }
});

// @desc    Import local file (Expenses Export.csv) from workspace
// @route   POST /api/import/local
// @access  Private
router.post('/local', protect, async (req, res) => {
  try {
    const { groupId } = req.body;
    if (!groupId) {
      return res.status(400).json({ message: 'groupId is required' });
    }

    // Verify group exists
    const group = await Group.findByPk(groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    const filePath = path.join(__dirname, '../../Expenses Export.csv');
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'Expenses Export.csv file not found in workspace root' });
    }

    const rows = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => {
        // Clean keys to lowercase and trim spaces
        const cleanedRow = {};
        Object.keys(data).forEach(key => {
          cleanedRow[key.trim().toLowerCase()] = data[key];
        });
        rows.push(cleanedRow);
      })
      .on('end', async () => {
        try {
          const report = await importCSVRows(groupId, rows, req.user.id);
          res.json({ message: 'Local CSV imported successfully', report });
        } catch (err) {
          console.error(err);
          res.status(500).json({ message: 'Error processing CSV rows', error: err.message });
        }
      });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error during local import' });
  }
});

// @desc    Import JSON array of rows (parsed from client CSV file upload)
// @route   POST /api/import/json
// @access  Private
router.post('/json', protect, async (req, res) => {
  try {
    const { groupId, rows } = req.body;
    if (!groupId || !Array.isArray(rows)) {
      return res.status(400).json({ message: 'groupId and rows array are required' });
    }

    // Verify group exists
    const group = await Group.findByPk(groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Clean rows keys just in case
    const cleanedRows = rows.map(r => {
      const cleaned = {};
      Object.keys(r).forEach(key => {
        cleaned[key.trim().toLowerCase()] = r[key];
      });
      return cleaned;
    });

    const report = await importCSVRows(groupId, cleanedRows, req.user.id);
    res.json({ message: 'JSON rows imported successfully', report });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error during JSON import' });
  }
});

module.exports = router;
