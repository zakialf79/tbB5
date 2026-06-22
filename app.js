require('dotenv').config();
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var session = require('express-session');
var MySQLStore = require('express-mysql-session')(session);

var apiRouter = require('./routes/api');
var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var reimburseRouter = require('./routes/reimburse');
var laporanRouter = require('./routes/laporan');
// 👇 INI TAMBAHANMU: Import route reimburse
var reimburseRoutes = require('./routes/reimburseRoutes'); 
const { notFoundHandler, errorHandler } = require('./middlewares/error');

var app = express(); // <--- Variabel app dibuat di sini

// ========================================================
// LOG DETEKTIF DARURAT (Aman di bawah inisialisasi app)
// ========================================================
app.use((req, res, next) => {
    console.log(`\n[DETEKTIF] Ada request masuk -> Method: ${req.method} | URL: ${req.url}`);
    next();
});

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// 👇 INI TAMBAHANMU: Membuka akses folder statis untuk file nota (multer)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Session configuration
const sessionStore = new MySQLStore({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  schema: {
    tableName: 'sessions',
    columnNames: {
      session_id: 'id',
      expires: 'last_activity',
      data: 'payload'
    }
  }
});

app.use(session({
  key: 'session_cookie_name',
  secret: process.env.SESSION_SECRET || 'secret',
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 // 1 day
  }
}));

app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/reimburse', reimburseRouter);
app.use('/laporan', laporanRouter);

// catch 404 and forward to error handler
app.use(notFoundHandler);

// error handler
app.use(errorHandler);

module.exports = app;