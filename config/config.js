require('dotenv').config();

module.exports = {
  // Server configuration
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Database configuration
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    name: process.env.DB_NAME || 'licence_portal',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || ''
  },
  
  // Session configuration
  session: {
    secret: process.env.SESSION_SECRET || 'your-super-secret-session-key',
    name: 'licence-portal-session',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  },
  
  // File upload configuration
  upload: {
    path: process.env.UPLOAD_PATH || './uploads',
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 10485760, // 10MB
    allowedTypes: ['image/jpeg', 'image/png', 'application/pdf']
  },
  
  // Email configuration
  email: {
    from: process.env.EMAIL_FROM || 'noreply@zf-lifetec.com',
    allowedDomain: process.env.EMAIL_DOMAIN || 'zf-lifetec.com'
  },
  
  // Internationalization
  i18n: {
    defaultLanguage: process.env.DEFAULT_LANGUAGE || 'pl',
    supportedLanguages: (process.env.SUPPORTED_LANGUAGES || 'pl,en,de,es').split(',')
  },
  
  // Security
  bcrypt: {
    saltRounds: 12
  },
  
  // Rate limiting
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
  }
};