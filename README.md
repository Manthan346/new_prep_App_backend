# Placement Readiness System - Backend

A comprehensive backend API for a placement readiness management system built with Express.js, MongoDB, and JWT authentication.

## Features

- **Complete User Management**: Admin, Teacher, and Student roles with proper authentication
- **Subject Management**: Admin can create subjects, teachers are assigned to subjects
- **Test Management**: Teachers can create tests, manage results, and track student performance
- **Marks Entry System**: Bulk marks entry with automatic grade calculation
- **Dashboard Analytics**: Role-based dashboards with relevant statistics
- **Secure Authentication**: JWT-based authentication with role-based access control

## Quick Setup

### Prerequisites

- Node.js (v16 or higher)
- MongoDB (local or cloud)

### Installation

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables:
```bash
cp .env.example .env
# Edit .env with your settings
```

3. Start MongoDB (if running locally)

4. Initialize admin user:
```bash
npm run init-admin
```

5. Start the server:
```bash
# Development
npm run dev

# Production
npm start
```

## Environment Variables

```
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb://localhost:27017/placement_system
JWT_SECRET=your_super_secret_jwt_key_here
JWT_EXPIRE=7d
ADMIN_EMAIL=admin@placement.com
ADMIN_PASSWORD=admin123
FRONTEND_URL=http://localhost:5173
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - Student registration
- `GET /api/auth/profile` - Get user profile
- `PUT /api/auth/profile` - Update user profile

### Admin Routes (Admin Only)
- `GET /api/admin/users` - Get all users
- `GET /api/admin/teachers` - Get all teachers
- `GET /api/admin/subjects` - Get all subjects
- `POST /api/admin/teachers` - Create teacher
- `POST /api/admin/subjects` - Create subject
- `PUT /api/admin/users/:id` - Update user
- `DELETE /api/admin/users/:id` - Delete user
- `GET /api/admin/dashboard` - Admin dashboard stats

### Test Management
- `GET /api/tests` - Get all tests
- `POST /api/tests` - Create test (Teacher/Admin)
- `PUT /api/tests/:id` - Update test
- `DELETE /api/tests/:id` - Delete test
- `GET /api/tests/:id/results` - Get test results
- `POST /api/tests/:id/marks` - Submit marks

### Student Routes
- `GET /api/students` - Get all students
- `GET /api/students/dashboard` - Student dashboard
- `GET /api/students/results` - Student's test results
- `GET /api/students/:id/performance` - Student performance

## Database Models

### User Model
```javascript
{
  name: String,
  email: String (unique),
  password: String (hashed),
  role: ['admin', 'teacher', 'student'],
  // Student fields
  rollNumber: String,
  department: String,
  year: Number,
  // Teacher fields
  employeeId: String,
  subjects: [ObjectId], // References to Subject
  // Common
  phone: String,
  address: String,
  isActive: Boolean
}
```

### Subject Model
```javascript
{
  name: String,
  code: String (unique),
  description: String,
  department: String,
  credits: Number,
  teachers: [ObjectId], // References to User
  createdBy: ObjectId,
  isActive: Boolean
}
```

### Test Model
```javascript
{
  title: String,
  subject: ObjectId, // Reference to Subject
  testType: ['quiz', 'midterm', 'final', 'assignment'],
  maxMarks: Number,
  passingMarks: Number,
  testDate: Date,
  duration: Number, // minutes
  description: String,
  createdBy: ObjectId,
  isActive: Boolean
}
```

### TestResult Model
```javascript
{
  test: ObjectId, // Reference to Test
  student: ObjectId, // Reference to User
  marksObtained: Number,
  percentage: Number, // Auto-calculated
  grade: String, // Auto-calculated (A+, A, B+, etc.)
  isPassed: Boolean, // Auto-calculated
  remarks: String,
  gradedBy: ObjectId,
  gradedAt: Date
}
```

## Security Features

- JWT Authentication with secure token-based authentication
- Password Hashing using bcryptjs
- Role-based Access Control with different permissions for each role
- Input Validation using express-validator
- CORS Configuration for frontend integration
- Comprehensive Error Handling middleware

## Default Admin Access

- **Email**: `admin@placement.com`
- **Password**: `admin123`

**⚠️ Please change the default password after first login!**

## Development

### Running Tests
```bash
npm test
```

### Code Linting
```bash
npm run lint
```

### Database Seeding
```bash
npm run seed
```

## Production Deployment

1. Set `NODE_ENV=production`
2. Use a secure JWT_SECRET (minimum 32 characters)
3. Configure MongoDB URI for production
4. Set up proper CORS for your frontend domain
5. Use PM2 or similar for process management

## License

This project is licensed under the MIT License.
