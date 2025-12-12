// src/routes/demo.js
const express = require('express');
const { demoRawLogin } = require('../controllers/authController');
const demoItemsController = require('../controllers/demoItemsController');

const router = express.Router();

// 🔑 Zranitelný login – SQL injection na email
router.post('/raw-login', demoRawLogin);

// 🔍 Zranitelné vyhledávání items
router.get('/items/search-raw', demoItemsController.searchRaw);

// 🔎 Zranitelný detail itemu
router.get('/items/:id-raw', demoItemsController.getItemRaw);

module.exports = router;
