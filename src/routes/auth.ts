import { Router } from 'express';
import { AuthRepositoryImpl } from '../repositories/auth.repository';


const authrouter = Router();
const authRepository = new AuthRepositoryImpl();



const validateEmailAndPassword = (email: string, password: string, res: any) => {
  if (!email && !password) {
    res.status(400).json({
      error: 'Either phone number or both email and password are required'
    });
    return false;
  }

  if (email && !password) {
    res.status(400).json({
      error: 'Password is required when email is provided'
    });
    return false;
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.sendError('Please provide a valid email address', 400);
    return false;
  }

  return true;
};

const validatePhoneAndPassword = (phoneNumber: string, password: string, res: any) => {
  if (!phoneNumber || !password) {
    res.sendError('Phone number and password are required', 400);
    return false;
  }

  if (!/^\+?[\d\s\(\)\-\.]+$/.test(phoneNumber)) {
    res.sendError('Invalid phone number format', 400);
    return false;
  }

  if (password.length < 8) {
    res.sendError('Password must be at least 8 characters long', 400);
    return false;
  }

  return true;
};

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register a new user; send email + password or just phoneNumber
 *     tags: [Auth]
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - phoneNumber
 * 
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               phoneNumber:
 *                 type: string
 *     responses:
 *       200:
 *         description: User successfully registered
 */
authrouter.post('/register', async (req, res, next) => {
  try {
    const { email, password, phoneNumber } = req.body;

    if (email) {
      if (!validateEmailAndPassword(email, password, res)) {
        return;
      }
      const user = await authRepository.signUpWithEmail(email, password);
      const token = await authRepository.loginWithEmail(user, password);
      return res.sendSuccess({
        message: 'User registered successfully',
        token,
        user: {
          id: user.id,
          email: user.email
        }
      }, 201);
    }

    if (phoneNumber) {
      if (!validatePhoneAndPassword(phoneNumber, password, res)) {
        return;
      }
      const { verificationId } = await authRepository.signUpWithPhone(phoneNumber, password);
      return res.sendSuccess({ verificationId }, 201);
    }

    throw new Error("Invalid registration data; provide email+password or phone+password");
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                   description: JWT token for authentication
 */
authrouter.post('/login', async (req, res) => {
  try {
    const { email, password, phoneNumber } = req.body;

    if (email) {
      if (!validateEmailAndPassword(email, password, res)) {
        return;
      }
      const user = await authRepository.verifyCredentials(email, password, null);
      const token = await authRepository.loginWithEmail(user, password);
      return res.sendSuccess({ 
        token, 
        user: { 
          id: user.id, 
          email: user.email 
        } 
      });
    }

    if (phoneNumber) {
      if (!validatePhoneAndPassword(phoneNumber, password, res)) {
        return;
      }
      const token = await authRepository.loginWithPhone(phoneNumber, password);
      return res.sendSuccess({ token });
    }

    res.sendError('Invalid login credentials', 400);
  } catch (error) {
    console.error('Login error:', error);
    res.sendError(error.message || 'Error during login', 500);
  }
});

/**
 * @swagger
 * /auth/signup/otp:
 *   post:
 *     summary: Complete phone signup by verifying OTP
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - verificationId
 *               - otp
 *             properties:
 *               verificationId:
 *                 type: string
 *                 description: Verification ID received from signup request
 *               otp:
 *                 type: string
 *                 description: One-time password received via SMS
 *     responses:
 *       200:
 *         description: Signup successful
 */
authrouter.post('/signup/otp', async (req, res) => {
  try {
    const { verificationId, otp } = req.body;

    if (!verificationId || !otp) {
      res.sendError('Verification ID and OTP are required', 400);
      return;
    }

    const { user, token } = await authRepository.completePhoneSignup(verificationId, otp);

    res.sendSuccess({
      token,
      user
    });
  } catch (error) {
    console.error('Phone signup completion error:', error);
    res.sendError('Error completing phone signup', 500);
  }
});

authrouter.post('/google-signin', async (req, res) => {
  const { idToken } = req.body;
  const { user, token } = await authRepository.signInWithGoogle(idToken);
  res.json({ user, token });
}); 
//TODO change password, update password, forgot password

export default authrouter;
