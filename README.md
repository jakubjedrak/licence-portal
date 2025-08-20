# License Portal

A production-ready web application for reporting unused software licenses and accounts. Built with Node.js, Express, and MySQL.

## Features

- **User Authentication**: Secure login/registration with email domain validation (@zf-lifetec.com)
- **Role-based Access Control**: Employee, License Admin, and System Admin roles
- **Ticket System**: Submit and track license release requests with attachments
- **Software Catalog**: Comprehensive catalog with cost information and deactivation instructions
- **Multi-language Support**: Available in Polish, English, German, and Spanish
- **Dashboard & Reporting**: Real-time statistics and savings tracking
- **Admin Panel**: User management, catalog administration, and system monitoring
- **Notification System**: In-app notifications and mock email alerts
- **File Uploads**: Secure file attachment handling (PDF, JPG, PNG)
- **Audit Logging**: Track all system activities for compliance

## Technology Stack

- **Backend**: Node.js + Express.js
- **Database**: MySQL with Sequelize ORM
- **Frontend**: EJS templates + Bootstrap 5
- **Authentication**: Passport.js + bcrypt
- **Internationalization**: i18next
- **File Uploads**: Multer
- **Security**: Helmet, rate limiting, input validation

## Prerequisites

- Node.js 16.0.0 or higher
- MySQL 8.0 or higher
- npm 8.0.0 or higher

## Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/jakubjedrak/licence-portal.git
   cd licence-portal
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment configuration**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` file with your database credentials:
   ```env
   NODE_ENV=development
   PORT=3000
   
   DB_HOST=localhost
   DB_PORT=3306
   DB_NAME=licence_portal
   DB_USER=root
   DB_PASSWORD=your_password
   
   SESSION_SECRET=your-super-secret-session-key
   ```

4. **Database setup**
   ```bash
   # Create database
   mysql -u root -p
   CREATE DATABASE licence_portal CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   EXIT;
   
   # Run migrations
   npm run migrate
   
   # Seed demo data (optional)
   npm run seed
   ```

5. **Start the application**
   ```bash
   # Development mode
   npm run dev
   
   # Production mode
   npm start
   ```

6. **Access the application**
   - Open http://localhost:3000 in your browser
   - Register with an @zf-lifetec.com email address
   - Or use demo accounts (see Demo Accounts section)

## Demo Accounts

After running the seeders, you can login with these demo accounts:

| Email | Password | Role |
|-------|----------|------|
| admin@zf-lifetec.com | Password123! | System Admin |
| license.admin@zf-lifetec.com | Password123! | License Admin |
| john.doe@zf-lifetec.com | Password123! | Employee |
| jane.smith@zf-lifetec.com | Password123! | Employee |
| bob.wilson@zf-lifetec.com | Password123! | Employee |

## Usage

### For Employees

1. **Register/Login**: Create account with @zf-lifetec.com email
2. **Submit Ticket**: Report unused licenses with detailed information
3. **Track Progress**: Monitor ticket status and add comments
4. **View Dashboard**: See personal statistics and recent activity

### For License Admins

1. **Manage Tickets**: Review, assign, and process license requests
2. **Update Status**: Change ticket status and add internal comments
3. **Confirm Savings**: Enter confirmed savings after license deactivation
4. **Bulk Actions**: Process multiple tickets simultaneously

### For System Admins

1. **User Management**: Activate/deactivate users and manage roles
2. **Catalog Management**: Add/edit software items and pricing
3. **System Monitoring**: View audit logs and system statistics
4. **Generate Reports**: Export data for analysis and compliance

## API Documentation

The application provides RESTful API endpoints:

### Authentication Required
- `GET /api/notifications` - Get user notifications
- `PATCH /api/notifications/:id/read` - Mark notification as read
- `GET /api/tickets/search` - Search tickets
- `GET /api/catalog/:id` - Get catalog item details
- `GET /api/dashboard/stats` - Get dashboard statistics

### Admin Only
- `GET /api/users/search` - Search users
- `PATCH /admin/users/:id/role` - Update user role
- `PATCH /admin/users/:id/status` - Toggle user active status

### Public
- `GET /api/health` - Health check
- `GET /api/version` - Application version info

## Database Schema

### Key Tables

- **users**: User accounts with authentication and roles
- **catalog_items**: Software/service catalog with pricing
- **tickets**: License release requests with workflow
- **comments**: Ticket communication and updates
- **notifications**: In-app notification system
- **audit_logs**: System activity tracking
- **email_queue**: Mock email notification storage

### Relationships

- Users can have many Tickets and Comments
- Tickets belong to Users and CatalogItems
- Tickets can have many Comments and Attachments
- Users receive Notifications

## Security Features

- **Authentication**: Session-based with secure password hashing
- **Authorization**: Role-based access control
- **Input Validation**: Server-side validation for all forms
- **File Upload Security**: Type and size validation
- **Rate Limiting**: Prevents abuse and brute force attacks
- **CSRF Protection**: Cross-site request forgery prevention
- **XSS Protection**: Content Security Policy headers
- **Audit Logging**: Track all sensitive operations

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| NODE_ENV | Environment mode | development |
| PORT | Server port | 3000 |
| DB_HOST | Database host | localhost |
| DB_NAME | Database name | licence_portal |
| SESSION_SECRET | Session encryption key | (required) |
| EMAIL_DOMAIN | Allowed email domain | zf-lifetec.com |
| DEFAULT_LANGUAGE | Default UI language | pl |

### Supported Languages

- **pl** - Polish (default)
- **en** - English
- **de** - German
- **es** - Spanish

## Development

### Available Scripts

- `npm start` - Start production server
- `npm run dev` - Start development server with nodemon
- `npm test` - Run tests
- `npm run lint` - Run ESLint
- `npm run migrate` - Run database migrations
- `npm run migrate:undo` - Undo last migration
- `npm run seed` - Run database seeders
- `npm run seed:undo` - Undo database seeders

### Adding New Features

1. **Database Changes**: Create migrations in `/migrations`
2. **Models**: Update Sequelize models in `/models`
3. **Routes**: Add routes in `/routes`
4. **Views**: Create EJS templates in `/views`
5. **Translations**: Update language files in `/locales`
6. **Styles**: Add CSS to `/public/css`
7. **JavaScript**: Add client-side JS to `/public/js`

## Deployment

### Production Setup

1. **Server Requirements**
   - Ubuntu 20.04+ or similar Linux distribution
   - Node.js 16+ and npm
   - MySQL 8.0+
   - Nginx (recommended for reverse proxy)

2. **Environment Configuration**
   ```bash
   NODE_ENV=production
   PORT=3000
   SESSION_SECRET=your-super-secure-random-key
   DB_HOST=your-db-host
   DB_PASSWORD=your-secure-password
   ```

3. **Process Management**
   ```bash
   # Install PM2
   npm install -g pm2
   
   # Start application
   pm2 start server.js --name "licence-portal"
   
   # Enable startup script
   pm2 startup
   pm2 save
   ```

4. **Nginx Configuration**
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;
       
       location / {
           proxy_pass http://localhost:3000;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
   }
   ```

### Docker Deployment

A `Dockerfile` and `docker-compose.yml` can be created for containerized deployment:

```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

## Troubleshooting

### Common Issues

1. **Database Connection Error**
   - Check MySQL service is running
   - Verify database credentials in `.env`
   - Ensure database exists and has proper charset

2. **Permission Denied**
   - Check file permissions for uploads directory
   - Ensure proper ownership of application files

3. **Session Issues**
   - Verify SESSION_SECRET is set in production
   - Check if cookies are being blocked

4. **Translation Missing**
   - Ensure all language files are complete
   - Check language code in user profile

### Logs

Application logs are output to console. In production, redirect to files:

```bash
pm2 start server.js --name "licence-portal" --log /var/log/licence-portal.log
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support and questions:
- Create an issue on GitHub
- Contact the development team
- Check the documentation wiki

## Changelog

### Version 1.0.0
- Initial release
- User authentication and authorization
- Ticket management system
- Software catalog
- Multi-language support
- Admin panel
- Dashboard and reporting
- Notification system
- File upload functionality
- Audit logging