import 'dotenv/config';

export const config = {
  app: {
    name: process.env.APP_NAME || 'MyApp',
    env: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '5000', 10),
  },
  
  database: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017',
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true
    }
  },

  auth: {
    jwtSecret: process.env.JWT_SECRET,
    tokenExpiry: '24h',
    googleClientId: process.env.GOOGLE_CLIENT_ID,
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET
  },
  twillio :{
    authToken: process.env.TWILLIO_AUTH_TOKEN, 
    accountSid: process.env.TWILLIO_ACCOUNT_SID
  },
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET
  },
  coins: {
    perMessage: 1
  },
  callMeBot: {
    apiKey: process.env.CALL_ME_BOT_API_KEY,
    phone: process.env.CALL_ME_BOT_PHONE
  }
};
