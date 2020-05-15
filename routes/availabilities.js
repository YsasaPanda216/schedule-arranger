'use strict';
const express = require ('express');
const router = express.Router();
const authenticationEnsurer = require('./authentication-ensurer');
const Availability = require('../models/availability');

router.post('/:scheduleId/users/:userId/candidates/:candidateId', authenticationEnsurer, (req, res, next) => {
  let availability = req.body.availability ? parseInt(req.body.availability) : 0;

  Availability.upsert({
    scheduleId: req.params.scheduleId,
    userId: req.params.userId,
    candidateId: req.params.candidateId,
    availability
  }).then(() => {
    res.json({ status: 'OK', availability});
  });
});

module.exports = router;