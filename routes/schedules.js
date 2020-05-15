'use strict';
const express = require('express');
const router = express.Router();
const authenticationEnsurer = require('./authentication-ensurer');
const uuid = require('uuid');
const Schedule = require('../models/schedule');
const Candidate = require('../models/candidate');
const User = require('../models/user');
const Availability = require('../models/availability');

//認証されていればnew.pugをレンダリング
router.get('/new',authenticationEnsurer,(req,res,next)=>{
  res.render('new', { user: req.user });
});

router.post('/',authenticationEnsurer,(req,res,next)=>{
  const scheduleId = uuid.v4();
  const updatedAt = new Date();
  Schedule.create({
    scheduleId: scheduleId,
    scheduleName: req.body.scheduleName.slice(0, 255) || '（名称未設定）',
    memo: req.body.memo.slice(0, 500),
    createdBy: req.user.id,
    updatedAt
  }).then((schedule) => {
    const candidates = req.body.candidates
      .trim()//余分な空白削除
      .split('\n')//候補の分割
      .map((s) => s.trim())//各候補の空白削除
      .filter((s) => s !== "")//空の候補は除外
    　.map((candidateName) => {
        return {
          candidateName,
          scheduleId: schedule.scheduleId
      };
    });
    //bulkCreate：引数の配列を全てinsertしてくれる
    Candidate.bulkCreate(candidates).then(() => {
      res.redirect('/schedules/' + schedule.scheduleId);
    });
  });
});

router.get('/:scheduleId', authenticationEnsurer, (req, res, next) => {
  Schedule.findOne({
    include: [
      {
        model: User,
        attributes: ['userId', 'username']
      }],
    where: {
      scheduleId: req.params.scheduleId
    },
    order: [['"updatedAt"', 'DESC']]
  }).then((schedule) => {
    if (schedule) {
      Candidate.findAll({
        where: { scheduleId: schedule.scheduleId },
        order: [['"candidateId"', 'ASC']]
      }).then((candidates) => {
        Availability.findAll({
          include:[
            {model:User,attributes: ['userId', 'username']}
          ],
          where: { scheduleId: schedule.scheduleId },
          order: [[User, 'username', 'ASC'], ['"candidateId"', 'ASC']]
        }).then((availabilities)=>{
          // 出欠 MapMap(キー:ユーザー ID, 値:出欠Map(キー:候補 ID, 値:出欠)) を作成する
          const availabilityMapMap = new Map();// key: userId, value: Map(key: candidateId, availability)
          availabilities.forEach((availability)=>{
            const map = availabilityMapMap.get(availability.user.userId) || new Map()
            map.set(availability.candidateId,availability.availability);
            availabilityMapMap.set(availability.user.userId,map);
          });

          // 閲覧ユーザーと出欠に紐づくユーザーからユーザー Map (キー:ユーザー ID, 値:ユーザー) を作る
          const userMap = new Map(); // key: userId, value: User
          userMap.set(parseInt(req.user.id), {
              isSelf: true,
              userId: parseInt(req.user.id),
              username: req.user.username
          });
          availabilities.forEach((availability) => {
            userMap.set(availability.user.userId, {
              isSelf: parseInt(req.user.id) === availability.user.userId, // 閲覧ユーザー自身であるかを含める
              userId: availability.user.userId,
              username: availability.user.username
            });
          });

          // 全ユーザー、全候補で二重ループしてそれぞれの出欠の値がない場合には、「欠席」を設定する
          const users = Array.from(userMap).map((keyValue) => keyValue[1]);//value(連想配列部分)を取得
          users.forEach((user) => {
            candidates.forEach((candidate) => {
              const map = availabilityMapMap.get(user.userId) || new Map();
              const availability = map.get(candidate.candidateId) || 0; // デフォルト値は 0 を利用
              map.set(candidate.candidateId, availability);
              availabilityMapMap.set(user.userId, map);
            });
          });

          res.render('schedule', {
              user: req.user,
              schedule,
              candidates,
              users,
              availabilityMapMap
            });
        });
      });
    } else {
      const err = new Error('指定された予定は見つかりません');
      err.status = 404;
      next(err);
    }
  });
});

module.exports = router;