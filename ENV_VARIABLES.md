# Environment Variables Configuration

This document lists all the environment variables used by the application. Create a `.env` file in the root directory with these variables.

## 2FA Configuration

### REACT_APP_2FA_API_KEY
- **Description**: API key for authenticating with the 2FA service
- **Required**: Yes (if 2FA is enabled)
- **Example**: `your-2fa-api-key-here`

### REACT_APP_2FA_URL
- **Description**: Base URL for the 2FA service API
- **Required**: Yes (if 2FA is enabled)
- **Example**: `https://2fa.bservices-api.org.pk`

## User Data Tracking

### REACT_APP_BSERVICES_API_KEY
- **Description**: API key for authenticating with the user data tracking service (bservices API)
- **Required**: Yes (for user data tracking feature)
- **Example**: `your-bservices-api-key-here`

### REACT_APP_USER_DATA_API_URL
- **Description**: Base URL for the user data tracking service API
- **Required**: No (optional, defaults to `https://bservices-api.org.pk`)
- **Example**: `https://bservices-api.org.pk`

## Admin API Configuration

### REACT_APP_ADMIN_API_URL
- **Description**: Base URL for the admin API (used for fetching ministries and designations)
- **Required**: No (optional, defaults to `https://admin.beep.gov.pk`)
- **Example**: `https://admin.beep.gov.pk`

## DevTools Configuration

### REACT_APP_ENV
- **Description**: Application environment setting. Controls DevTools blocking feature.
  - `prod` or `production`: DevTools are blocked
  - `dev` or `development`: DevTools are allowed
- **Required**: No (defaults to production if not set)
- **Example**: `prod` or `dev`

### NODE_ENV
- **Description**: Node environment setting. Also used for DevTools blocking if `REACT_APP_ENV` is not set.
  - `production`: DevTools are blocked
  - `development`: DevTools are allowed
- **Required**: No (set automatically by build tools)
- **Example**: `production` or `development`

## Example .env File

```env
# 2FA Configuration
REACT_APP_2FA_API_KEY=your-2fa-api-key-here
REACT_APP_2FA_URL=https://2fa.bservices-api.org.pk

# User Data Tracking
REACT_APP_BSERVICES_API_KEY=your-bservices-api-key-here
REACT_APP_USER_DATA_API_URL=https://bservices-api.org.pk

# Admin API Configuration
REACT_APP_ADMIN_API_URL=https://admin.beep.gov.pk

# Environment (dev or prod)
REACT_APP_ENV=prod
```

## Notes

- **Never commit the `.env` file to version control**. It should be added to `.gitignore`.
- All `REACT_APP_*` variables are injected at build time via webpack's `DefinePlugin`.
- The user data tracking feature automatically collects:
  - Device information (browser, OS, screen resolution)
  - Geolocation (with user permission)
  - User ID and FCM token (if available)
- This data is sent to the backend when a user:
  - Logs in (with or without 2FA)
  - Signs up (registers a new account)

