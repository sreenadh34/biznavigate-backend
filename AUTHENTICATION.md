# Authentication System Documentation

## Overview

This application implements a comprehensive JWT-based authentication system with the following features:
- Email/Password registration and login
- JWT access tokens (short-lived, 15 minutes)
- JWT refresh tokens (long-lived, 7 days)
- Secure password hashing using bcrypt
- Token refresh mechanism
- Route protection with JWT guards
- Multi-tenant support

## Architecture

### Components

1. **Auth Module** (`src/features/auth/`)
   - Controllers: Handle HTTP requests for authentication
   - Services: Business logic for signup, login, token generation
   - DTOs: Data validation and transfer objects
   - JWT Strategy: Passport.js strategy for token validation

2. **JWT Guards** (`src/common/guards/`)
   - JwtAuthGuard: Protects routes requiring authentication
   - TenantGuard: Ensures multi-tenant data isolation

3. **Database Schema**
   - `users` table includes:
     - `password`: Hashed password (bcrypt)
     - `refresh_token`: Hashed refresh token
     - `is_active`: Account status flag

## API Endpoints

### Base URL
All auth endpoints are available at: `http://localhost:8000/auth`

### 1. Signup
**POST** `/auth/signup`

Register a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123",
  "name": "John Doe",
  "business_id": "00000000-0000-0000-0000-000000000001",
  "role_id": "00000000-0000-0000-0000-000000000001"
}
```

**Response (201 Created):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "user_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "email": "user@example.com",
    "name": "John Doe",
    "business_id": "00000000-0000-0000-0000-000000000001",
    "role_id": "00000000-0000-0000-0000-000000000001"
  }
}
```

**Errors:**
- `409 Conflict`: User with this email already exists
- `400 Bad Request`: Invalid business_id or role_id

---

### 2. Login
**POST** `/auth/login`

Login with email and password.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123"
}
```

**Response (200 OK):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "user_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "email": "user@example.com",
    "name": "John Doe",
    "business_id": "00000000-0000-0000-0000-000000000001",
    "role_id": "00000000-0000-0000-0000-000000000001"
  }
}
```

**Errors:**
- `401 Unauthorized`: Invalid credentials or inactive account

---

### 3. Refresh Token
**POST** `/auth/refresh`

Get a new access token using a refresh token.

**Request Body:**
```json
{
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response (200 OK):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "user_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "email": "user@example.com",
    "name": "John Doe",
    "business_id": "00000000-0000-0000-0000-000000000001",
    "role_id": "00000000-0000-0000-0000-000000000001"
  }
}
```

**Errors:**
- `401 Unauthorized`: Invalid or expired refresh token

---

### 4. Logout
**POST** `/auth/logout`

**Headers:**
```
Authorization: Bearer <access_token>
```

Invalidate the refresh token (logout).

**Response (200 OK):**
```json
{
  "message": "Logged out successfully"
}
```

**Errors:**
- `401 Unauthorized`: Missing or invalid access token

---

## Using Authentication in Your Application

### 1. Frontend Flow

#### Initial Login/Signup
```javascript
// Login
const response = await fetch('http://localhost:8000/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'password123'
  })
});

const { access_token, refresh_token, user } = await response.json();

// Store tokens securely
localStorage.setItem('access_token', access_token);
localStorage.setItem('refresh_token', refresh_token);
```

#### Making Authenticated Requests
```javascript
const response = await fetch('http://localhost:8000/api/v1/leads', {
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('access_token')}`
  }
});
```

#### Handling Token Expiration
```javascript
async function makeAuthenticatedRequest(url, options = {}) {
  let response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${localStorage.getItem('access_token')}`
    }
  });

  // If access token expired, refresh it
  if (response.status === 401) {
    const refreshResponse = await fetch('http://localhost:8000/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        refresh_token: localStorage.getItem('refresh_token')
      })
    });

    if (refreshResponse.ok) {
      const { access_token, refresh_token } = await refreshResponse.json();
      localStorage.setItem('access_token', access_token);
      localStorage.setItem('refresh_token', refresh_token);

      // Retry original request with new token
      response = await fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          'Authorization': `Bearer ${access_token}`
        }
      });
    } else {
      // Refresh token expired, redirect to login
      window.location.href = '/login';
    }
  }

  return response;
}
```

### 2. Protecting Routes in NestJS

#### Option 1: Controller-level Protection
```typescript
import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';

@Controller('leads')
@UseGuards(JwtAuthGuard, TenantGuard) // Protect all routes in this controller
export class LeadController {
  @Get()
  findAll() {
    // This route requires authentication
    return 'Protected route';
  }
}
```

#### Option 2: Route-level Protection
```typescript
import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('leads')
export class LeadController {
  @Get('public')
  getPublicData() {
    // This route is public
    return 'Public data';
  }

  @Get('private')
  @UseGuards(JwtAuthGuard) // Protect specific route
  getPrivateData() {
    // This route requires authentication
    return 'Private data';
  }
}
```

#### Accessing User Data in Controllers
```typescript
import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('profile')
@UseGuards(JwtAuthGuard)
export class ProfileController {
  @Get()
  getProfile(@Request() req) {
    // Access authenticated user from request
    const user = req.user;
    // user contains: user_id, email, name, business_id, tenant_id, role_id
    return user;
  }
}
```

## Environment Variables

Add these to your `.env` file:

```env
# JWT Configuration
JWT_ACCESS_SECRET=your-super-secret-access-key-change-this-in-production
JWT_REFRESH_SECRET=your-super-secret-refresh-key-change-this-in-production
JWT_ACCESS_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=7d
```

**Important for Production:**
- Generate strong random secrets using: `openssl rand -base64 32`
- Never commit secrets to version control
- Use environment-specific secret management (e.g., AWS Secrets Manager, HashiCorp Vault)

## Security Features

1. **Password Hashing**: Passwords are hashed using bcrypt with salt rounds of 10
2. **Refresh Token Hashing**: Refresh tokens are hashed before storage in the database
3. **Token Expiration**: Access tokens expire in 15 minutes, refresh tokens in 7 days
4. **Account Status**: Inactive accounts cannot login
5. **Validation**: Input validation using class-validator on all DTOs
6. **Multi-tenant Isolation**: TenantGuard ensures users only access their tenant's data

## JWT Payload Structure

```typescript
{
  user_id: string;      // User's unique ID
  email: string;        // User's email
  name: string;         // User's name
  business_id: string;  // Business the user belongs to
  tenant_id: string;    // Tenant for multi-tenant isolation
  role_id: string;      // User's role for authorization
  iat: number;          // Issued at timestamp
  exp: number;          // Expiration timestamp
}
```

## Testing the API

### Using cURL

**Signup:**
```bash
curl -X POST http://localhost:8000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "name": "Test User",
    "business_id": "00000000-0000-0000-0000-000000000001",
    "role_id": "00000000-0000-0000-0000-000000000001"
  }'
```

**Login:**
```bash
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

**Access Protected Route:**
```bash
curl http://localhost:8000/api/v1/leads \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Using Swagger UI

1. Navigate to: `http://localhost:8000/api/docs`
2. Click "Authorize" button (top right)
3. Enter your access token in the format: `Bearer <token>`
4. Click "Authorize"
5. All subsequent requests will include the token

## Migration from Mock Authentication

The existing routes are already protected with `JwtAuthGuard`. The guard has been updated from a mock implementation to real JWT validation using Passport.js.

### What Changed:
- **Before**: Mock user was injected regardless of token validity
- **After**: Real JWT validation with proper authentication

### What Stayed the Same:
- All existing route guards remain in place
- The `request.user` object structure is identical
- No changes needed to existing controllers using `@Request() req`

## Troubleshooting

### Common Issues

**"Invalid credentials" on login**
- Verify email exists in database
- Check password is correct
- Ensure user `is_active = true`

**"User not found or inactive" with valid token**
- User may have been deactivated
- Check database: `SELECT is_active FROM users WHERE user_id = '...'`

**"Invalid refresh token"**
- Refresh token may have expired (7 days)
- User may have logged out (refresh token deleted)
- Token may have been tampered with

**401 Unauthorized on all requests**
- Verify token is in Authorization header: `Authorization: Bearer <token>`
- Check token hasn't expired
- Verify JWT_ACCESS_SECRET matches between token generation and validation

## Next Steps

1. **Role-Based Authorization**: Implement permission checks based on `role_id`
2. **Password Reset**: Add forgot password / reset password functionality
3. **Email Verification**: Require email verification before account activation
4. **2FA**: Add two-factor authentication for enhanced security
5. **Rate Limiting**: Add rate limiting to prevent brute force attacks
6. **Audit Logging**: Log all authentication events for security monitoring
