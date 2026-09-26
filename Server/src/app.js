import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import userRoutes from '../modules/users/users.routes.js';
import authRoutes from '../modules/auth/auth.routes.js';
import activityRoutes from '../modules/activity/activity.routes.js';

const app = express();

app.use(cors({
  origin: 'http://localhost:5173',  
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/users', userRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/activity', activityRoutes);

app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'The API has been working successfully',
    endpoints: {
      users: '/api/users',
      auth: '/api/auth'
    }
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`
  });
});

export default app;