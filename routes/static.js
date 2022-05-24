#!/usr/bin/env node

/**
 * This module is used to define the routes of static resources available in `/public`
 * but also under `/lrda-users` paths.
 * 
 * @author cubap 
 */
const express = require('express')
const router = express.Router()
const path = require('path')

// public also available at `/lrda-users`
router.use(express.static(path.join(__dirname, '../public')))

// Set default API response
router.get('/', function (req, res) {
    res.redirect(301, 'profile.html')
})

// Export API routes
module.exports = router
