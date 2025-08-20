const express = require('express');
const path = require('path');
const session = require('express-session');
const passport = require('passport');
const flash = require('connect-flash');
const helmet = require('helmet');
const compression = require('compression');
const cors = require('cors');
const methodOverride = require('method-override');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const i18next = require('i18next');
const Backend = require('i18next-fs-backend');
const middleware = require('i18next-http-middleware');

const config = require('./config/config');
const db = require('./models');

// Initialize Express app
const app = express();

// Trust proxy for rate limiting and security
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      imgSrc: ["'self'", "data:", "https:"],
      fontSrc: ["'self'", "https://cdn.jsdelivr.net"]
    }
  }
}));

// Rate limiting
const limiter = rateLimit(config.rateLimit);
app.use(limiter);

// Compression and CORS
app.use(compression());
app.use(cors());

// Logging
if (config.nodeEnv !== 'test') {
  app.use(morgan('combined'));
}

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(methodOverride('_method'));

// Static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Session configuration
app.use(session(config.session));

// Flash messages
app.use(flash());

// Passport configuration
require('./config/passport')(passport);
app.use(passport.initialize());
app.use(passport.session());

// Initialize i18next
i18next
  .use(Backend)
  .use(middleware.LanguageDetector)
  .init({
    fallbackLng: config.i18n.defaultLanguage,
    supportedLngs: config.i18n.supportedLanguages,
    backend: {
      loadPath: path.join(__dirname, 'locales/{{lng}}/{{ns}}.json')
    },
    detection: {
      order: ['session', 'querystring', 'header'],
      caches: ['session']
    }
  });

app.use(middleware.handle(i18next));

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Global middleware for template variables
app.use((req, res, next) => {
  res.locals.user = req.user || null;
  res.locals.success_msg = req.flash('success_msg');
  res.locals.error_msg = req.flash('error_msg');
  res.locals.error = req.flash('error');
  res.locals.currentLanguage = req.language;
  res.locals.supportedLanguages = config.i18n.supportedLanguages;
  res.locals.t = req.t;
  res.locals.moment = require('moment');
  next();
});

// Routes
app.use('/', require('./routes/index'));
app.use('/auth', require('./routes/auth'));
app.use('/dashboard', require('./routes/dashboard'));
app.use('/tickets', require('./routes/tickets'));
app.use('/catalog', require('./routes/catalog'));
app.use('/admin', require('./routes/admin'));
app.use('/api', require('./routes/api'));

// 404 handler
app.use((req, res, next) => {
  const error = new Error('Page not found');
  error.status = 404;
  next(error);
});

// Error handler
app.use((error, req, res, next) => {
  console.error(error);
  
  const status = error.status || 500;
  const message = config.nodeEnv === 'production' && status === 500 
    ? 'Internal Server Error' 
    : error.message;
  
  res.status(status);
  
  if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
    res.json({ error: message });
  } else {
    res.render('error', { 
      title: req.t('error.title'),
      message: message,
      status: status
    });
  }
});

// Start server
const PORT = config.port;

db.sequelize.authenticate()
  .then(() => {
    console.log('Database connection established successfully.');
    
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT} in ${config.nodeEnv} mode`);
    });
  })
  .catch(err => {
    console.error('Unable to connect to the database:', err);
    process.exit(1);
  });

module.exports = app;