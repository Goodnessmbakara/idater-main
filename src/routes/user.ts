import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware";
import { UserRepository } from "../repositories/user.repository"; // Import UserRepository
import { CloudinaryService } from '../services/cloudinary.service';
import { uploadMiddleware } from "../middleware/upload.middleware";
import { ProfileService } from '../services/profile.service';

const userRepository = new UserRepository(); 
const userRouter = Router();
const cloudinaryService = new CloudinaryService();
const profileService = new ProfileService();

/**
 * @swagger
 * /user/me:
 *   get:
 *     summary: Get current user details
 *     description: Retrieves the details of the currently authenticated user
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 firstName:
 *                   type: string
 *                 email:
 *                   type: string
 *                 lastName:
 *                   type: string
 *                 location:
 *                   type: string
 *                 phone:
 *                   type: string
 *                 bio:
 *                   type: string
 *                 gender:
 *                   type: string
 *                 dateOfBirth:
 *                   type: string
 *                   format: date
 *                 interest:
 *                   type: string
 *                   enum: ['dating', 'hookup']
 *                 about:
 *                   type: string
 *                 completedProfile:
 *                   type: boolean
 *                   description: Whether all required profile fields are filled
 *                 profileCompletion:
 *                   type: string
 *                   description: Percentage of profile completion
 *                   example: "75%"
 *                 missingFields:
 *                   type: array
 *                   items:
 *                     type: string
 *                   description: List of fields that need to be filled
 *       401:
 *         description: Unauthorized - Invalid or missing authentication token
 *       500:
 *         description: Internal server error
 */
userRouter.get('/me', authMiddleware, async (req, res) => {
    try {
      const userId = req.user.userId; 
      const user = await userRepository.getUserDetails(userId); 
      const profileStatus = profileService.getProfileStatus(user);
      
      const userJson = user.toJSON();
      delete userJson.password;
      
      res.json({
        ...userJson,
        ...profileStatus
      });
    } catch (error) {
      res.sendError('Error fetching user data', 500);
    }
});

/**
 * @swagger
 * /user/{userId}/profile:
 *   get:
 *     summary: Get user profile by ID
 *     description: Retrieves the profile details of a user by their ID
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the user to fetch
 *     responses:
 *       200:
 *         description: User profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 firstName:
 *                   type: string
 *                 lastName:
 *                   type: string
 *                 bio:
 *                   type: string
 *                 gender:
 *                   type: string
 *                 dateOfBirth:
 *                   type: string
 *                   format: date
 *                 interest:
 *                   type: string
 *                   enum: ['dating', 'hookup']
 *                 about:
 *                   type: string
 *                 profileImage:
 *                   type: string
 *       401:
 *         description: Unauthorized - Invalid or missing authentication token
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
userRouter.get('/:userId/profile', authMiddleware, async (req, res) => {
    try {
      const { userId } = req.params;
      const user = await userRepository.getUserDetails(userId);
      
      if (!user) {
        return res.sendError('User not found', 404);
      }

      const userProfile = {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        bio: user.bio,
        gender: user.gender,
        dateOfBirth: user.dateOfBirth,
        interest: user.interest,
        about: user.about,
        profileImage: user.profileImage
      };
      
      res.sendSuccess(userProfile);
    } catch (error) {
      res.sendError('Error fetching user profile', 500);
    }
});


/**
 * @swagger
 * /user/update:
 *   put:
 *     summary: Update user details
 *     description: Update the current user's profile information including profile image
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               email:
 *                 type: string
 *               location:
 *                 type: string
 *               phone:
 *                 type: string
 *               bio:
 *                 type: string
 *               gender:
 *                 type: string
 *               dateOfBirth:
 *                 type: string
 *                 format: date
 *               interest:
 *                 type: string
 *                 enum: ['dating', 'hookup']
 *               about:
 *                 type: string
 *               profileImage:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: User details updated successfully
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
userRouter.put('/update', 
  authMiddleware, 
  uploadMiddleware.single('profileImage'), 
  async (req, res) => {
    try {
        const userId = req.user.userId;
        const updateData = { ...req.body };
        
        delete updateData.email;
        delete updateData.phone;

        if (req.file) {
            const imageUrl = await cloudinaryService.uploadImage(req.file);
            updateData.profileImage = imageUrl;
        }

        const updatedUser = await userRepository.updateProfile(userId, updateData);
        const { password, ...userResponse } = updatedUser;
        
        res.sendSuccess(userResponse);
    } catch (error) {
        console.error('Update error:', error);
        res.sendError('Error updating user data', 500);
    }
});

/**
 * @swagger
 * /user/matches/potential:
 *   get:
 *     summary: Get potential matches
 *     description: Get a list of 10 random potential matches, excluding already liked or disliked users
 *     tags: [Matches]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of potential matches
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
userRouter.get('/matches/potential', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const potentialMatches = await userRepository.findPotentialMatches(userId);
    res.sendSuccess(potentialMatches);
  } catch (error) {
    res.sendError('Error fetching potential matches', 500);
  }
});

/**
 * @swagger
 * /user/matches/like/{targetUserId}:
 *   post:
 *     summary: Like a user
 *     description: Like a potential match and create a match if mutual
 *     tags: [Matches]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: targetUserId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Like recorded successfully
 *       201:
 *         description: Match created successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
userRouter.post('/matches/like/:targetUserId', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { targetUserId } = req.params;

    // Add to likes
    await userRepository.addToLikes(userId, targetUserId);

    // Check if it's a mutual like
    const targetUser = await userRepository.getUserDetails(targetUserId);
    const isMatch = targetUser.likes.includes(userId);

    if (isMatch) {
      // Create a match if mutual
      await userRepository.createMatch(userId, targetUserId);
      res.sendSuccess({ message: 'Match created!', isMatch: true }, 201);
    } else {
      res.sendSuccess({ message: 'Like recorded', isMatch: false });
    }
  } catch (error) {
    res.sendError('Error processing like', 500);
  }
});

/**
 * @swagger
 * /user/matches/dislike/{targetUserId}:
 *   post:
 *     summary: Dislike a user
 *     description: Dislike a potential match
 *     tags: [Matches]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: targetUserId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Dislike recorded successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
userRouter.post('/matches/dislike/:targetUserId', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { targetUserId } = req.params;
    
    await userRepository.addToDisikes(userId, targetUserId);
    res.sendSuccess({ message: 'Dislike recorded' });
  } catch (error) {
    res.sendError('Error processing dislike', 500);
  }
});

/**
 * @swagger
 * /user/matches:
 *   get:
 *     summary: Get mutual matches
 *     description: Get a list of all mutual matches for the current user
 *     tags: [Matches]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of mutual matches
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
userRouter.get('/matches', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const matches = await userRepository.getMutualMatches(userId);
    res.sendSuccess(matches);
  } catch (error) {
    res.sendError('Error fetching matches', 500);
  }
});

/**
 * @swagger
 * /user/profile-views:
 *   get:
 *     summary: Get recent profile views
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 */
userRouter.get('/profile-views', authMiddleware, async (req, res) => {
  try {
    const views = await userRepository.getRecentProfileViews(req.user.userId);
    res.sendSuccess(views);
  } catch (error) {
    res.sendError('Error fetching profile views', 500);
  }
});

export default userRouter


