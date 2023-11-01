#!/usr/bin/env node

/**
 * Initialize Express and register top level routes.
 */ 

let express = require('express')
let router = express.Router()

const staticRouter = require('./static')
router.get('/',staticRouter)

const managementRouter = require('./manage-api')
router.use('/lrda-users/manage', managementRouter)

const lrdaRouter = require('./lrda-users')
router.use('/lrda-users', lrdaRouter)

module.exports = router
