import { Request } from 'express';

declare global {
  namespace Express {
    interface Request {
      user?: any; // Replace 'any' with your User type
    }
  }
} 

declare module 'express'
declare module 'swagger-ui-express'
declare module 'swagger-jsdoc'
declare module 'jsonwebtoken'
declare module 'bcryptjs'
declare module 'node'