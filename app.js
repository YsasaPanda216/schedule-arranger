var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var helmet = require('helmet');

var session = require('express-session');
var passport = require('passport');

//モデルの読み込み
var User = require('./models/user');
var Schedule = require('./models/schedule');
var Availability = require('./models/availability');
var Candidate = require('./models/candidate');
var Comment = require('./models/comment');

//User.sync()（※TBL作成）が終わった後にthenが実行される
User.sync().then(()=>{
  //scheduleがuserに対してrelationを張る
  Schedule.belongsTo(User,{foreignKey:'createdBy'});
  //scheduleテーブル作成。順番に注意
  Schedule.sync();
  Comment.belongsTo(User, {foreignKey: 'userId'});
  Comment.sync();
  Availability.belongsTo(User, {foreignKey: 'userId'});
  Candidate.sync().then(() => {
    Availability.belongsTo(Candidate, {foreignKey: 'candidateId'});
    Availability.sync();
  });
});

var GitHubStrategy = require('passport-github2').Strategy;
var GITHUB_CLIENT_ID = 'f3a53237e2956b8ab80d';
var GITHUB_CLIENT_SECRET = '6654c093d88fa3db45b4c59059141044d6463d0d';

//ユーザーの情報をデータとして保存する処理
passport.serializeUser(function (user, done) {
  done(null, user);
});

//保存されたデータをユーザーの情報として読み出す際の処理
passport.deserializeUser(function (obj, done) {
  done(null, obj);
});

//accessToken:認可済みのトークンを使い回せるように
//refreshToken:有効期限が過ぎたらトークンを再発行される
//profile:githubからのユーザーデータが保存される
passport.use(new GitHubStrategy({
  clientID: GITHUB_CLIENT_ID,
  clientSecret: GITHUB_CLIENT_SECRET,
  callbackURL: 'http://localhost:8000/auth/github/callback'
},
  function (accessToken, refreshToken, profile, done) {
    process.nextTick(function () {
      User.upsert({
        userId:profile.id,
        username:profile.username
      }).then(()=>{
        done(null, profile);
      });
    });
  }
));

var indexRouter = require('./routes/index');
var loginRouter = require('./routes/login');
var logoutRouter = require('./routes/logout');
var schedulesRouter = require('./routes/schedules');
var availabilitiesRouter = require('./routes/availabilities');

var app = express();
app.use(helmet());

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({ secret: 'c522ba5b730a4017', resave: false, saveUninitialized: false }));
app.use(passport.initialize());
app.use(passport.session());

app.use('/', indexRouter);
app.use('/login', loginRouter);
app.use('/logout', logoutRouter);
//先にschedulesRouter→availabilitiesRouter
app.use('/schedules',schedulesRouter);
app.use('/schedules', availabilitiesRouter);
app.get('/auth/github',
  passport.authenticate('github', { scope: ['user:email'] }),
  function (req, res) {
});

app.get('/auth/github/callback',
  passport.authenticate('github', { failureRedirect: '/login' }),
  function (req, res) {
    res.redirect('/');
});

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;