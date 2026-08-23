export const siteConfig = {
  domain: process.env.NEXT_PUBLIC_CLIENT_BASE_URL || 'https://cinesphere.com.vn',
  apiUrl: process.env.NEXT_PUBLIC_API_URL || 'https://api.cinesphere.com.vn',
<<<<<<< HEAD
  serverBaseUrl: process.env.NEXT_PUBLIC_SERVER_BASE_URL || 'https://api.cinesphere.com.vn',
=======
  serverBaseUrl: process.env.NEXT_PUBLIC_SERVER_BASE_URL || 'https://api.cinesphere.com.vn'
>>>>>>> preview
} as const;
