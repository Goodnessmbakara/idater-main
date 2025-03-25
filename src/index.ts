import express, { Express } from "express";
import mongoose from "mongoose";
import "dotenv/config";
import cors from 'cors'
import { Server as SocketIOServer } from 'socket.io';
import { createServer, Server as HTTPServer } from 'http';
import authrouter from "./routes/auth";
import userrouter from "./routes/user";
import swaggerUi from 'swagger-ui-express';
import swaggerJsDoc from 'swagger-jsdoc';
import { config } from "./config";
import { responseMiddleware } from "./middleware/response.middleware";
import { errorMiddleware } from "./middleware/error.middleware";
import { SocketService } from './services/socket.service';
import chatRouter from "./routes/chat";
import { initializeSocket } from "./socket";
import adminRouter from "./routes/admin";

declare module 'express-serve-static-core' {
  interface Request {
    coinsRequired?: number;
  }
}

class DatingApp {
  private app: Express;
  private httpServer: HTTPServer;
  private io: SocketIOServer;
  private port: number;

  constructor() {
    this.app = express();
    this.httpServer = createServer(this.app);
    this.io = new SocketIOServer(this.httpServer, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST']
      }
    });
    this.port = config.app.port;

    this.initializeMiddleware();
    this.connectToDatabase();
    this.initializeSwagger();
    this.initializeRoutes();
    this.initializeWebSockets();
  }

  initializeMiddleware() {
    this.app.use(cors({
      origin: '*'
    }))
    this.app.use(express.json());
    this.app.use(responseMiddleware);
  }

  connectToDatabase() {
    mongoose
      .connect(config.database.uri)
      .then(() => console.log("Connected to MongoDB"))
      .catch((error) => console.error("MongoDB connection error:", error));
  }

  initializeSwagger() {
    const swaggerOptions = {
      definition: {
        openapi: '3.0.0',
        info: {
          title: config.app.name,
          version: '1.0.0',
          description: 'API Documentation',
        },
        servers: [
          {
            url: `http://localhost:${this.port}`,
          },
          {
            url: `https://idater.onrender.com/`,
          },
        ],
        components: {
          securitySchemes: {
            bearerAuth: {
              type: 'http',
              scheme: 'bearer',
              bearerFormat: 'JWT',
              description: 'Enter your JWT token in the format: Bearer <token>'
            }
          }
        },
        security: [{
          bearerAuth: []
        }]
      },
      apis: ['./src/routes/*.ts'],
    };

    const swaggerDocs = swaggerJsDoc(swaggerOptions);
    this.app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));
  }

  initializeRoutes() {
    this.app.use("/auth", authrouter);
    this.app.use("/user", userrouter);
    this.app.use("/chat", chatRouter);
    this.app.use("/admin", adminRouter);
    this.app.use('*', (req, res) => {
      res.sendError('Route not found', 404);
    });
    this.app.use(errorMiddleware);
  }

  private initializeWebSockets() {
    initializeSocket(this.io);
    SocketService.initialize(this.io);
  }

  listen() {
    this.httpServer.listen(this.port, () => {
      console.log(`Server running on port ${this.port}`);
      console.log(`Swagger documentation available at http://localhost:${this.port}/docs`);
      console.log(`WebSocket server is running`);
    });
  }

  addMiddleware(middleware: (req: any, res: any, next: any) => void) {
    this.app.use(middleware);
  }

  addRoute(path: any, router: any) {
    this.app.use(path, router);
  }
}


const app = new DatingApp();

app.addMiddleware((req, res, next) => {
  console.log(`${req.method} request to ${req.url}`);
  next();
});

app.listen();
