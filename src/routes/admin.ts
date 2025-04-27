import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { AdminRepository } from '../repositories/admin.repository';
import { adminMiddleware } from '../middleware/admin.middeware';

const adminRouter = Router();
const adminRepository = new AdminRepository();
/**
 * @swagger
 * /admin/users/{userId}:
 *   put:
 *     summary: Edit user details (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the user to edit
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               email:
 *                 type: string
 *               phone:
 *                 type: string
 *               coins:
 *                 type: number
 *     responses:
 *       200:
 *         description: User updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _id:
 *                   type: string
 *                 firstName:
 *                   type: string
 *                 lastName:
 *                   type: string
 *                 email:
 *                   type: string
 *                 phone:
 *                   type: string
 *                 coins:
 *                   type: number
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error while updating user
 */
adminRouter.put('/users/:userId',
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      const user = await adminRepository.editUser(req.params.userId, req.body);
      res.sendSuccess(user);
    } catch (error) {
      res.sendError('Error updating user', 500);
    }
  });

/**
 * @swagger
 * /admin/reports:
 *   get:
 *     summary: Get all user reports (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, resolved, dismissed]
 *         description: Filter reports by status
 *     responses:
 *       200:
 *         description: List of reports retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   _id: 
 *                     type: string
 *                   reporter:
 *                     type: object
 *                   reportedUser:
 *                     type: object
 *                   status:
 *                     type: string
 *                   adminNotes:
 *                     type: string
 *       500:
 *         description: Server error while fetching reports
 */
adminRouter.get('/reports',
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      const reports = await adminRepository.getAllReports(req.query.status as any);
      res.sendSuccess(reports);
    } catch (error) {
      res.sendError('Error fetching reports', 500);
    }
  });

/**
 * @swagger
 * /admin/reports/{reportId}:
 *   put:
 *     summary: Update report status (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: reportId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the report to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [resolved, dismissed]
 *                 description: New status for the report
 *               adminNotes:
 *                 type: string
 *                 description: Optional notes from admin about the status change
 *     responses:
 *       200:
 *         description: Report status updated successfully
 *       404:
 *         description: Report not found
 *       500:
 *         description: Server error while updating report
 */
adminRouter.put('/reports/:reportId',
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      const { status, adminNotes } = req.body;
      const report = await adminRepository.updateReportStatus(
        req.params.reportId,
        status,
        adminNotes
      );
      res.sendSuccess(report);
    } catch (error) {
      res.sendError('Error updating report', 500);
    }
  });

/**
 * @swagger
 * /admin/users/{userId}/coins:
 *   post:
 *     summary: Add coins to user (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               coins:
 *                 type: number
 *                 description: Number of coins to add
 */
adminRouter.post('/users/:userId/coins',
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      const { coins } = req.body;
      if (!coins || coins <= 0) {
        return res.sendError('Invalid coin amount', 400);
      }
      const user = await adminRepository.addUserCoins(req.params.userId, coins);
      res.sendSuccess(user);
    } catch (error) {
      res.sendError('Error adding coins', 500);
    }
  });


adminRouter.post('/users/:userId/subscribe',
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      // const { coins } = req.body;
      // if (!coins || coins <= 0) {
      //   return res.sendError('Invalid coin amount', 400);
      // }
      const user = await adminRepository.subScribeUser(req.params.userId);
      res.sendSuccess(user);
    } catch (error) {
      res.sendError('Error Subscribing user', 500);
    }
  });

  adminRouter.post('/users/:userId/unsubscribe',
    authMiddleware,
    adminMiddleware,
    async (req, res) => {
      try {
        // const { coins } = req.body;
        // if (!coins || coins <= 0) {
        //   return res.sendError('Invalid coin amount', 400);
        // }
        const user = await adminRepository.unSubScribeUser(req.params.userId);
        res.sendSuccess(user);
      } catch (error) {
        res.sendError('Error unsubscribing user', 500);
      }
    });

/**
 * @swagger
 * /admin/dashboard:
 *   get:
 *     summary: Get admin dashboard statistics
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     description: Returns various statistics for the admin dashboard including total users, users with coins, pending reports, total reports and total coins in circulation
 *     responses:
 *       200:
 *         description: Dashboard statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalUsers:
 *                   type: number
 *                   description: Total number of users in the system
 *                 usersWithCoins:
 *                   type: number
 *                   description: Number of users who have coins
 *                 pendingReports:
 *                   type: number
 *                   description: Number of reports pending review
 *                 totalReports:
 *                   type: number
 *                   description: Total number of reports
 *                 totalCoins:
 *                   type: number
 *                   description: Total coins in circulation
 *       401:
 *         description: Unauthorized - Invalid or missing authentication token
 *       403:
 *         description: Forbidden - User is not an admin
 *       500:
 *         description: Server error while fetching dashboard stats
 */
adminRouter.get('/dashboard',
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      const stats = await adminRepository.getDashboardStats();
      res.sendSuccess(stats);
    } catch (error) {
      res.sendError('Error fetching dashboard stats', 500);
    }
  });

/**
 * @swagger
 * /admin/users:
 *   get:
 *     summary: Get all users with pagination and search (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of users
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin only
 */
adminRouter.get('/users',
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;

      const { users, total } = await adminRepository.getAllUsers(page, limit);

      res.sendSuccess({
        users,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      res.sendError('Error fetching users', 500);
    }
  });

/**
 * @swagger
 * /admin/users/{userId}/details:
 *   get:
 *     summary: Get detailed user information (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Detailed user information
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin only
 *       404:
 *         description: User not found
 */
adminRouter.get('/users/:userId/details',
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      const user = await adminRepository.getUserById(req.params.userId);
      res.sendSuccess(user);
    } catch (error) {
      if (error.message === 'User not found') {
        return res.sendError('User not found', 404);
      }
      res.sendError('Error fetching user details', 500);
    }
  });

/**
 * @swagger
 * /admin/users/{userId}:
 *   delete:
 *     summary: Delete a user (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 */
adminRouter.delete('/users/:userId',
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      const user = await adminRepository.deleteUser(req.params.userId);
      res.sendSuccess(user);
    } catch (error) {
      res.sendError('Error deleting user', 500);
    }
  });

export default adminRouter;
