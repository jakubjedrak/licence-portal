const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const config = require('../config/config');

// Configure storage
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, config.upload.path);
  },
  filename: function(req, file, cb) {
    // Generate unique filename
    const uniqueSuffix = crypto.randomBytes(16).toString('hex');
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${uniqueSuffix}${ext}`);
  }
});

// File filter
const fileFilter = function(req, file, cb) {
  if (config.upload.allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF, JPG, and PNG files are allowed.'), false);
  }
};

// Configure multer
const upload = multer({
  storage: storage,
  limits: {
    fileSize: config.upload.maxFileSize
  },
  fileFilter: fileFilter
});

// Error handler middleware for multer
function handleUploadError(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      req.flash('error_msg', req.t('upload.file_too_large'));
    } else {
      req.flash('error_msg', req.t('upload.upload_error'));
    }
    return res.redirect('back');
  } else if (err) {
    req.flash('error_msg', err.message);
    return res.redirect('back');
  }
  next();
}

module.exports = {
  upload,
  handleUploadError
};