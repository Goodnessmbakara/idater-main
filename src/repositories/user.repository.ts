import { Types } from 'mongoose';
import userModel, { IUser } from '../models/user.model';
import { SocketService } from '../services/socket.service';

export class UserRepository {
  async updateProfile(userId: string, userData: Partial<IUser>): Promise<IUser> {
    try {
      const updatedUser = await userModel.findByIdAndUpdate(userId, userData, {
        new: true,
        runValidators: true,
      });

      if (!updatedUser) {
        throw new Error('User not found');
      }

      return updatedUser.toJSON();
    } catch (error) {
      throw new Error(`Error updating user profile: ${error.message}`);
    }
  }

  async getUserDetails(userId: string): Promise<IUser> {
    try {
      const user = await userModel.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }
      return user;
    } catch (error) {
      throw new Error(`Error fetching user details: ${error.message}`);
    }
  }

  async findPotentialMatches(userId: string): Promise<IUser[]> {
    try {
      const user = await userModel.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Build query to exclude:
      // 1. Current user
      // 2. Admin users
      // 3. Users they've liked
      // 4. Users they've disliked
      // 5. Users they've matched with
      const query = {
        $and: [
          { _id: { $ne: new Types.ObjectId(userId) } },
          { role: { $ne: 'admin' } },
          { _id: { $nin: user.likes } },
          { _id: { $nin: user.dislikes } },
          { _id: { $nin: user.matches } },
          { gender: { $exists: true, $ne: null } },
          { profileImage: { $exists: true, $ne: null } },
          { dateOfBirth: { $exists: true, $ne: null } },
          { firstName: { $exists: true, $ne: null } },
          { lastName: { $exists: true, $ne: null } },
          { interest: { $exists: true, $ne: null } },
        ]
      };

      // Get random potential matches
      // Limit to 10 users at a time
      const potentialMatches = await userModel.aggregate([
        { $match: query },
        { $sample: { size: 10 } },
        {
          $project: {
            password: 0, // Exclude sensitive data
            __v: 0,
            likes: 0,
            dislikes: 0
          }
        }
      ]);

      return potentialMatches;
    } catch (error) {
      console.error('Error in findPotentialMatches:', error);
      throw new Error(`Error finding potential matches: ${error.message}`);
    }
  }

  async addToLikes(userId: string, targetUserId: string): Promise<void> {
    try {
      // First check if user hasn't already liked or matched with target
      const user = await userModel.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const targetUserObjectId = new Types.ObjectId(targetUserId);
      const userObjectId = new Types.ObjectId(userId);

      if (user.likes.includes(targetUserObjectId) || user.matches.includes(targetUserObjectId)) {
        throw new Error('Already liked or matched with this user');
      }

      // Remove from dislikes if present
      if (user.dislikes.includes(targetUserObjectId)) {
        await userModel.findByIdAndUpdate(userId, {
          $pull: { dislikes: targetUserObjectId }
        });
      }

      // Add to likes
      await userModel.findByIdAndUpdate(userId, {
        $addToSet: { likes: targetUserObjectId },
        $currentDate: { updatedAt: true }
      }, { new: true });

      // Check if it's a mutual like
      const targetUser = await userModel.findById(targetUserId);
      if (targetUser?.likes.includes(userObjectId)) {
        // Create match
        await this.createMatch(userId, targetUserId);
      }
    } catch (error) {
      console.error('Error in addToLikes:', error);
      throw new Error(`Error adding to likes: ${error.message}`);
    }
  }

  async addToDisikes(userId: string, targetUserId: string): Promise<void> {
    try {
      // First check if user hasn't already disliked
      const user = await userModel.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const targetUserObjectId = new Types.ObjectId(targetUserId);
      const userObjectId = new Types.ObjectId(userId);

      if (user.dislikes.includes(targetUserObjectId)) {
        throw new Error('Already disliked this user');
      }

      // Remove from likes if present
      if (user.likes.includes(targetUserObjectId)) {
        await userModel.findByIdAndUpdate(userId, {
          $pull: { likes: targetUserObjectId }
        });
      }

      // Remove from matches if present
      if (user.matches.includes(targetUserObjectId)) {
        await Promise.all([
          userModel.findByIdAndUpdate(userId, {
            $pull: { matches: targetUserObjectId }
          }),
          userModel.findByIdAndUpdate(targetUserId, {
            $pull: { matches: userObjectId }
          })
        ]);
      }

      // Add to dislikes
      await userModel.findByIdAndUpdate(userId, {
        $addToSet: { dislikes: targetUserId },
        $currentDate: { updatedAt: true }
      });
    } catch (error) {
      console.error('Error in addToDisikes:', error);
      throw new Error(`Error adding to dislikes: ${error.message}`);
    }
  }

  async createMatch(userId1: string, userId2: string): Promise<void> {
    try {
      await Promise.all([
        userModel.findByIdAndUpdate(userId1, {
          $addToSet: { matches: userId2 }
        }),
        userModel.findByIdAndUpdate(userId2, {
          $addToSet: { matches: userId1 }
        })
      ]);

      // Emit match notification to both users
      SocketService.emitMatch(userId1, userId2, {
        matchId: `${userId1}-${userId2}`,
        timestamp: new Date()
      });
    } catch (error) {
      throw new Error(`Error creating match: ${error.message}`);
    }
  }

  async getMutualMatches(userId: string): Promise<IUser[]> {
    try {
      const user = await userModel.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }
      
      const mutualMatches = await userModel.find({
        _id: { $in: user.matches }
      });
      
      return mutualMatches;
    } catch (error) {
      throw new Error(`Error getting mutual matches: ${error.message}`);
    }
  }

  async updateOnlineStatus(userId: string, isOnline: boolean): Promise<void> {
    let retries = 3;
    while (retries--) {
      try {
        await userModel.findByIdAndUpdate(userId, {
          isOnline,
          lastSeen: isOnline ? undefined : new Date()
        });
        return;
      } catch (error) {
        if (retries === 0) throw new Error(`Error updating online status: ${error.message}`);
        await new Promise(res => setTimeout(res, 1000)); // wait 1s before retry
      }
    }
  }
  

  async recordProfileView(userId: string, viewerId: string): Promise<void> {
    try {
      const user = await userModel.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Add profile view
      await userModel.findByIdAndUpdate(userId, {
        $push: {
          profileViews: {
            viewerId,
            timestamp: new Date()
          }
        }
      });

      // Notify the user about profile view
      SocketService.emitToUser(userId, 'profile:viewed', {
        viewerId,
        timestamp: new Date()
      });
    } catch (error) {
      throw new Error(`Error recording profile view: ${error.message}`);
    }
  }

  async getRecentProfileViews(userId: string): Promise<any[]> {
    try {
      const user = await userModel.findById(userId)
        .populate('profileViews.viewerId', 'firstName lastName profileImage');
      
      return user?.profileViews.sort((a, b) => 
        b.timestamp.getTime() - a.timestamp.getTime()
      ).slice(0, 10) || [];
    } catch (error) {
      throw new Error(`Error fetching profile views: ${error.message}`);
    }
  }
}
