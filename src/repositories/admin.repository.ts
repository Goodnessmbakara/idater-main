import userModel, { IUser } from '../models/user.model';
import reportModel, { IReport } from '../models/report.model';

export class AdminRepository {
  async editUser(userId: string, userData: Partial<IUser>): Promise<IUser> {
    try {
      const updatedUser = await userModel.findByIdAndUpdate(userId, userData, {
        new: true,
        runValidators: true
      });

      if (!updatedUser) {
        throw new Error('User not found');
      }

      return updatedUser;
    } catch (error) {
      throw new Error(`Error updating user: ${error.message}`);
    }
  }

  async getAllReports(status?: 'pending' | 'resolved' | 'dismissed'): Promise<IReport[]> {
    try {
      const query = status ? { status } : {};
      return await reportModel
        .find(query)
        .populate('reporter', 'firstName lastName email')
        .populate('reportedUser', 'firstName lastName email')
        .sort({ createdAt: -1 });
    } catch (error) {
      throw new Error(`Error fetching reports: ${error.message}`);
    }
  }

  async updateReportStatus(
    reportId: string,
    status: 'resolved' | 'dismissed',
    adminNotes?: string
  ): Promise<IReport> {
    try {
      const report = await reportModel.findByIdAndUpdate(
        reportId,
        { status, adminNotes },
        { new: true }
      );

      if (!report) {
        throw new Error('Report not found');
      }

      return report;
    } catch (error) {
      throw new Error(`Error updating report: ${error.message}`);
    }
  }

  async addUserCoins(userId: string, coins: number): Promise<IUser> {
    try {
      const user = await userModel.findByIdAndUpdate(
        userId,
        { $inc: { coins : coins } },
        { new: true }
      );
      

      if (!user) {
        throw new Error('User not found');
      }

      

      return user
    } catch (error) {
      throw new Error(`Error adding coins: ${error.message}`);
    }
  }

  async deductUserCoins(userId: string, coins: number): Promise<IUser> {
    try {
      const user = await userModel.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      if (user.coins < coins) {
        throw new Error('Insufficient coins');
      }

      user.coins -= coins;
      await user.save();

      return user;
    } catch (error) {
      throw new Error(`Error deducting coins: ${error.message}`);
    }
  }

  async getDashboardStats(): Promise<any> {
    try {
      const [
        totalUsers,
        usersWithCoins,
        pendingReports,
        totalReports,
        totalCoins
      ] = await Promise.all([
        userModel.countDocuments(),
        userModel.countDocuments({ coins: { $gt: 0 } }),
        reportModel.countDocuments({ status: 'pending' }),
        reportModel.countDocuments(),
        userModel.aggregate([
          {
            $group: {
              _id: null,
              totalCoins: { $sum: '$coins' }
            }
          }
        ]).then(result => result[0]?.totalCoins || 0)
      ]);

      return {
        totalUsers,
        usersWithCoins,
        pendingReports,
        totalReports,
        totalCoins
      };
    } catch (error) {
      throw new Error(`Error getting dashboard stats: ${error.message}`);
    }
  }

  async getAllUsers(
    page: number = 1,
    limit: number = 50,
  ): Promise<{ users: IUser[], total: number }> {
    try {
      
  
      const query = { role: { $ne: 'admin' } };
      const [users, total] = await Promise.all([
        userModel
          .find(query)
          .select('-password')
          .sort({ coins: -1 })
          .skip((page - 1) * limit)
          .limit(limit),
        userModel.countDocuments(query)
      ]);

      return { users, total };
    } catch (error) {
      throw new Error(`Error fetching users: ${error.message}`);
    }
  }

  async getUserById(userId: string): Promise<IUser> {
    try {
      const user = await userModel
        .findById(userId)
        .select('-password');

      if (!user) {
        throw new Error('User not found');
      }

      return user;
    } catch (error) {
      throw new Error(`Error fetching user: ${error.message}`);
    }
  }
  async deleteUser(userId: string): Promise<IUser> {
    try {
      const user = await userModel.findByIdAndDelete(userId);

      if (!user) {
        throw new Error('User not found');
      }

      return user;
    } catch (error) {
      throw new Error(`Error deleting user: ${error.message}`);
    }
  }

}
